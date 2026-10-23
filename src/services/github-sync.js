// Keeps content/ on GitHub the same as whats published on the site. Theres no queue: every time the content
// changes it works out what the files should be, compares that with the files on the branch, and makes one commit
// with only the differences. If GitHub is down the next run catches up on its own, nothing can get lost or out of
// order, and a run with nothing to do makes no commit.
//
// Only published content goes to GitHub, the repository is public, so drafts and anythin scheduled for later
// stay in the database. references.yml never goes (it has private contact details). Every commit message ends in
// [skip ci] so it doesnt trigger the deploy, the site allready has the change and a restart for a typo fix would
// be silly.
import { createHash } from "node:crypto";
import { PRIVATE_DOCUMENTS } from "../admin/schemas.js";
import { isLive } from "./content-service.js";
import { documentToFile, entryToFile, repoPath } from "./content-records.js";

// The files the sync is allowed to touch. Anything else in the repository is never changed or deleted
const MANAGED = /^content\/(?:(?:projects|writing|tools|pages)\/(?!_)[a-z0-9-]+\.md|legal\/[a-z0-9-]+\.hbs|data\/[a-z0-9-]+\.yml)$/;
// A run that wants to delete more than this many files stops and asks, an empty database must never empty the repo
const MAX_DELETES = 5;
const RETRY_MINUTES = [1, 5, 15, 60];

/** The sha GitHub gives a file with this text, so unchanged files can be skipped without downloading them */
export function gitBlobSha(text) {
  const body = Buffer.from(text, "utf8");
  return createHash("sha1").update(`blob ${body.length}\0`).update(body).digest("hex");
}

/** Every file content/ should hold right now, path -> text */
export function desiredFiles({ entries, documents }, now = new Date()) {
  const files = new Map();
  for (const entry of entries) {
    if (!isLive(entry, now)) continue;
    files.set(repoPath("entry", entry), entryToFile(entry));
  }
  for (const [name, data] of Object.entries(documents)) {
    if (name.startsWith("_") || PRIVATE_DOCUMENTS.includes(name) || data === null) continue;
    files.set(repoPath("document", { name }), documentToFile(name, data));
  }
  return files;
}

export class SyncError extends Error {}

export class GitHubSync {
  /**
   * @param {object} deps
   * @param {{ token: string, repo: string, branch: string }} deps.settings
   * @param {import("../repositories/content-repository.js").ContentRepository} deps.repository
   * @param {import("./content-service.js").ContentService} deps.content
   * @param {object} [deps.logger]
   * @param {typeof fetch} [deps.fetch]
   */
  constructor({ settings, repository, content, logger, fetch: fetchImpl = globalThis.fetch }) {
    this.settings = settings;
    this.repository = repository;
    this.content = content;
    this.logger = logger;
    this.fetch = fetchImpl;
    this.status = { state: this.enabled ? "waiting" : "off", lastRun: null, lastCommit: null, lastError: null, pending: [], blocked: null };
    this.timer = null;
    this.running = null;
    this.failures = 0;
  }

  get enabled() { return Boolean(this.settings.token && this.settings.repo && this.repository); }

  /** Starts listening for content changes. A change waits a few seconds so a burst of saves is one commit */
  start() {
    if (!this.enabled) return;
    this.unsubscribe = this.content.onChange(() => this.schedule(4000));
    this.schedule(15000);
  }

  stop() {
    clearTimeout(this.timer);
    this.unsubscribe?.();
  }

  schedule(ms) {
    clearTimeout(this.timer);
    this.timer = setTimeout(() => { this.run().catch(() => {}); }, ms);
    this.timer.unref?.();
  }

  async api(path, { method = "GET", body } = {}) {
    const response = await this.fetch(`https://api.github.com/repos/${this.settings.repo}${path}`, {
      method,
      headers: {
        authorization: `Bearer ${this.settings.token}`,
        accept: "application/vnd.github+json",
        "x-github-api-version": "2022-11-28",
        "user-agent": "reece.page-content-sync",
        ...(body ? { "content-type": "application/json" } : {})
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(20000)
    });
    const text = await response.text();
    let json;
    try { json = text ? JSON.parse(text) : null; } catch { json = null; }
    if (!response.ok) {
      const error = new SyncError(`GitHub answered ${response.status}${json?.message ? `: ${json.message}` : ""}`);
      error.status = response.status;
      throw error;
    }
    return json;
  }

  /**
   * Works out the differences and commits them. allowManyDeletes is for the Sync now button after the admin
   * showed what would be deleted
   */
  async run({ allowManyDeletes = false } = {}) {
    if (!this.enabled) return this.status;
    if (this.running) return this.running;
    this.running = this.runOnce({ allowManyDeletes }).finally(() => { this.running = null; });
    return this.running;
  }

  async runOnce({ allowManyDeletes }) {
    this.status.state = "running";
    try {
      // Content from the database only, if its not readable right now theres nothing safe to compare against
      const records = await this.repository.readAll();
      if (!records.entries.length) throw new SyncError("The database has no content, nothing was sent so the repository isnt emptied by mistake");
      const desired = desiredFiles(records);

      for (let attempt = 1; attempt <= 3; attempt += 1) {
        const branch = this.settings.branch;
        const ref = await this.api(`/git/ref/heads/${encodeURIComponent(branch)}`);
        const head = ref.object.sha;
        const commit = await this.api(`/git/commits/${head}`);
        const tree = await this.api(`/git/trees/${commit.tree.sha}?recursive=1`);
        if (tree.truncated) throw new SyncError("The repository is too big to compare in one go");

        const existing = new Map(tree.tree.filter((item) => item.type === "blob" && MANAGED.test(item.path)).map((item) => [item.path, item.sha]));
        const changes = [];
        for (const [path, text] of desired) {
          if (!MANAGED.test(path)) continue;
          if (existing.get(path) !== gitBlobSha(text)) changes.push({ path, mode: "100644", type: "blob", content: text, kind: existing.has(path) ? "update" : "add" });
        }
        const deletes = [...existing.keys()].filter((path) => !desired.has(path) && !PRIVATE_DOCUMENTS.some((name) => path === `content/data/${name}.yml`));
        if (deletes.length > MAX_DELETES && !allowManyDeletes) {
          this.status.blocked = deletes;
          throw new SyncError(`${deletes.length} files would be deleted on GitHub, thats more than ${MAX_DELETES} at once so it waits for you to press Sync now`);
        }
        for (const path of deletes) changes.push({ path, mode: "100644", type: "blob", sha: null, kind: "delete" });
        this.status.pending = changes.map((change) => `${change.kind} ${change.path}`);
        this.status.blocked = null;

        if (!changes.length) {
          this.markDone(null);
          return this.status;
        }

        const newTree = await this.api("/git/trees", { method: "POST", body: { base_tree: commit.tree.sha, tree: changes.map((change) => ({ path: change.path, mode: change.mode, type: change.type, ...(change.kind === "delete" ? { sha: null } : { content: change.content }) })) } });
        const message = commitMessage(changes);
        const newCommit = await this.api("/git/commits", { method: "POST", body: { message, tree: newTree.sha, parents: [head] } });
        try {
          await this.api(`/git/refs/heads/${encodeURIComponent(branch)}`, { method: "PATCH", body: { sha: newCommit.sha, force: false } });
        } catch (error) {
          // Someone pushed in between (a code deploy), start again from the new head
          if (error.status === 422 && attempt < 3) continue;
          throw error;
        }
        this.logger?.info({ commit: newCommit.sha, files: changes.length }, "content committed to github");
        this.markDone({ sha: newCommit.sha, message, files: changes.length, url: newCommit.html_url || `https://github.com/${this.settings.repo}/commit/${newCommit.sha}` });
        return this.status;
      }
      throw new SyncError("The branch kept moving while committing, will try again");
    } catch (error) {
      this.failures += 1;
      this.status.state = "failed";
      this.status.lastError = { message: error.message, at: new Date() };
      this.logger?.warn({ err: { message: error.message } }, "github content sync failed");
      if (!this.status.blocked) this.schedule(RETRY_MINUTES[Math.min(this.failures - 1, RETRY_MINUTES.length - 1)] * 60000);
      return this.status;
    }
  }

  markDone(commit) {
    this.failures = 0;
    this.status.state = "ok";
    this.status.lastRun = new Date();
    this.status.lastError = null;
    this.status.pending = [];
    if (commit) this.status.lastCommit = { ...commit, at: new Date() };
  }
}

/** "Content: update writing/my-post, add data/timeline [skip ci]", shortened when lots changed */
export function commitMessage(changes) {
  const names = changes.map((change) => `${change.kind} ${change.path.replace(/^content\//, "").replace(/\.(md|yml|hbs)$/, "")}`);
  const shown = names.length > 4 ? `${names.slice(0, 3).join(", ")} and ${names.length - 3} more` : names.join(", ");
  return `Content: ${shown} [skip ci]`;
}
