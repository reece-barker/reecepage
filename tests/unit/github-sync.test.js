// The GitHub sync against a pretend GitHub: only published content goes, unchanged files make no commit, private
// lists never go, lots of deletes wait for a press of Sync now, and a branch that moved is retried
import { test } from "node:test";
import assert from "node:assert/strict";
import { GitHubSync, desiredFiles, gitBlobSha, commitMessage } from "../../src/services/github-sync.js";

const now = new Date("2026-10-20T12:00:00Z");
const entry = (slug, extra = {}) => ({ type: "writing", slug, title: slug, status: "published", publishAt: null, meta: { summary: "s", date: "2026-10-01" }, body: "Hi", ...extra });

test("only live entries and public lists are files", () => {
  const files = desiredFiles({
    entries: [entry("live"), entry("draft", { status: "draft" }), entry("later", { publishAt: new Date("2026-12-01") }), entry("old", { status: "trash" })],
    documents: { timeline: [{ title: "x" }], references: [{ name: "private" }], _internal: {} }
  }, now);
  assert.deepEqual([...files.keys()].sort(), ["content/data/timeline.yml", "content/writing/live.md"]);
  assert.match(files.get("content/writing/live.md"), /^---\ntitle: live\nsummary: s\ndate: ["']2026-10-01["']\n---\n\nHi\n$/);
});

test("the blob sha matches what git would say", () => {
  // echo -n "hello" | git hash-object --stdin
  assert.equal(gitBlobSha("hello"), "b6fc4c620b67d95f953a5c1c1230aaab5db5a1b0");
});

test("commit messages say what changed and skip the deploy", () => {
  assert.equal(commitMessage([{ kind: "update", path: "content/writing/a.md" }]), "Content: update writing/a [skip ci]");
  assert.match(commitMessage(Array.from({ length: 6 }, (_, i) => ({ kind: "add", path: `content/pages/p${i}.md` }))), /and 3 more \[skip ci\]$/);
});

function fakeGitHub(tree) {
  const calls = [];
  let refMoves = 0;
  const fetchImpl = async (url, init = {}) => {
    const path = String(url).replace("https://api.github.com/repos/owner/repo", "");
    calls.push({ method: init.method || "GET", path, body: init.body ? JSON.parse(init.body) : null });
    const json = (data, status = 200) => new Response(JSON.stringify(data), { status });
    if (path === "/git/ref/heads/main") return json({ object: { sha: "head1" } });
    if (path === "/git/commits/head1") return json({ tree: { sha: "tree1" } });
    if (path.startsWith("/git/trees/tree1")) return json({ truncated: false, tree });
    if (path === "/git/trees") return json({ sha: "tree2" });
    if (path === "/git/commits") return json({ sha: "commit2", html_url: "https://github.com/owner/repo/commit/commit2" });
    if (path === "/git/refs/heads/main") {
      refMoves += 1;
      return refMoves === 1 && fakeGitHub.moveOnce ? json({ message: "Update is not a fast forward" }, 422) : json({ ref: "refs/heads/main" });
    }
    return json({ message: "Not Found" }, 404);
  };
  return { fetchImpl, calls };
}

function syncWith(records, tree) {
  const gh = fakeGitHub(tree);
  const sync = new GitHubSync({
    settings: { token: "tok", repo: "owner/repo", branch: "main" },
    repository: { readAll: async () => records },
    content: { onChange: () => () => {} },
    fetch: gh.fetchImpl
  });
  return { sync, gh };
}

test("only changed files are committed, in one commit", async () => {
  const records = { entries: [entry("same"), entry("changed")], documents: {} };
  const files = desiredFiles(records, new Date());
  const tree = [
    { path: "content/writing/same.md", type: "blob", sha: gitBlobSha(files.get("content/writing/same.md")) },
    { path: "content/writing/changed.md", type: "blob", sha: "0000" },
    { path: "README.md", type: "blob", sha: "1111" }
  ];
  const { sync, gh } = syncWith(records, tree);
  const status = await sync.run({ full: true });
  assert.equal(status.state, "ok");
  const made = gh.calls.find((c) => c.method === "POST" && c.path === "/git/trees");
  assert.deepEqual(made.body.tree.map((t) => t.path), ["content/writing/changed.md"]);
  const commit = gh.calls.find((c) => c.method === "POST" && c.path === "/git/commits");
  assert.match(commit.body.message, /\[skip ci\]$/);
  assert.equal(status.lastCommit.sha, "commit2");
});

test("nothing changed means no commit at all", async () => {
  const records = { entries: [entry("same")], documents: {} };
  const files = desiredFiles(records, new Date());
  const { sync, gh } = syncWith(records, [{ path: "content/writing/same.md", type: "blob", sha: gitBlobSha(files.get("content/writing/same.md")) }]);
  assert.equal((await sync.run({ full: true })).state, "ok");
  assert.ok(!gh.calls.some((c) => c.method === "POST"));
});

test("a file thats no longer published is deleted, but lots at once waits", async () => {
  const records = { entries: [entry("keep")], documents: {} };
  const many = Array.from({ length: 7 }, (_, i) => ({ path: `content/writing/gone-${i}.md`, type: "blob", sha: "x" }));
  const { sync, gh } = syncWith(records, many);
  const blocked = await sync.run({ full: true });
  assert.equal(blocked.state, "failed");
  assert.equal(blocked.blocked.length, 7);
  assert.ok(!gh.calls.some((c) => c.method === "POST"));
  sync.stop();
  const done = await sync.run({ allowManyDeletes: true, full: true });
  assert.equal(done.state, "ok");
  const made = gh.calls.find((c) => c.path === "/git/trees" && c.method === "POST");
  assert.equal(made.body.tree.filter((t) => t.sha === null).length, 7);
  // references.yml in the repo is never touched, even though its not "published"
  const keep = desiredFiles(records, new Date()).get("content/writing/keep.md");
  const { sync: other, gh: gh2 } = syncWith(records, [{ path: "content/writing/keep.md", type: "blob", sha: gitBlobSha(keep) }, { path: "content/data/references.yml", type: "blob", sha: "x" }]);
  await other.run({ full: true });
  assert.ok(!gh2.calls.some((c) => c.method === "POST"));
});

test("an empty database never empties the repository", async () => {
  const { sync, gh } = syncWith({ entries: [], documents: {} }, [{ path: "content/writing/a.md", type: "blob", sha: "x" }]);
  const status = await sync.run({ full: true });
  assert.equal(status.state, "failed");
  assert.match(status.lastError.message, /no content/);
  assert.equal(gh.calls.length, 0);
  sync.stop();
});

test("a branch that moved in between is tried again from the new head", async () => {
  fakeGitHub.moveOnce = true;
  try {
    const { sync, gh } = syncWith({ entries: [entry("a")], documents: {} }, []);
    const status = await sync.run({ full: true });
    assert.equal(status.state, "ok");
    assert.equal(gh.calls.filter((c) => c.path === "/git/refs/heads/main").length, 2);
  } finally { fakeGitHub.moveOnce = false; }
});

// What went wrong on 9 November 2026: a restart with a database that still had old content committed it over the
// new content in the repo. Now a start only takes a snapshot, and later runs only send what moved since
test("a start commits nothing, even when the repo has newer content than the database", async () => {
  const records = { entries: [entry("stale")], documents: { now: { updated: "2026-10-12" } } };
  const { sync, gh } = syncWith(records, [
    { path: "content/writing/stale.md", type: "blob", sha: "newer-in-the-repo" },
    { path: "content/data/now.yml", type: "blob", sha: "newer-in-the-repo" }
  ]);
  await sync.prime();
  const status = await sync.run();
  assert.equal(status.state, "ok");
  assert.ok(!gh.calls.some((c) => c.method === "POST"), "nothing may be committed");
});

test("after the snapshot only what changed in the admin is sent", async () => {
  const records = { entries: [entry("stale"), entry("edited")], documents: { now: { updated: "2026-10-12" } } };
  const { sync, gh } = syncWith(records, [
    { path: "content/writing/stale.md", type: "blob", sha: "newer-in-the-repo" },
    { path: "content/writing/edited.md", type: "blob", sha: "old" },
    { path: "content/data/now.yml", type: "blob", sha: "newer-in-the-repo" }
  ]);
  await sync.prime();
  // an edit in the admin: the database read now returns a changed post
  records.entries = [entry("stale"), { ...entry("edited"), body: "Changed in the admin." }];
  const status = await sync.run();
  assert.equal(status.state, "ok");
  const made = gh.calls.find((c) => c.method === "POST" && c.path === "/git/trees");
  assert.deepEqual(made.body.tree.map((t) => t.path), ["content/writing/edited.md"]);
  // and the next run with no new edits sends nothing again
  const before = gh.calls.filter((c) => c.method === "POST").length;
  await sync.run();
  assert.equal(gh.calls.filter((c) => c.method === "POST").length, before);
});
