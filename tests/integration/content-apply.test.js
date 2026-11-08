// Content changes from a code pull request reach the live database on deploy, but only where nobody edited the same
// thing in the admin since. The admin always wins, a clash is listed and left alone
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { buildTestApp } from "../helpers/app.js";
import { applyPlan, databaseText, planApply } from "../../src/services/content-apply.js";
import { canonicalText, recordForPath } from "../../src/services/content-records.js";

const project = (title, extra = "") => `---\ntitle: ${title}\nsummary: A short summary for the list.\nbranch: code\nkind: Personal\nperiod: "2026"\nsort_date: "2026-01"\n${extra}---\n\nSome words.\n`;

async function plan(repository, changes) {
  const current = new Map();
  for (const change of changes) if (recordForPath(change.path)) current.set(change.path, await databaseText(repository, recordForPath(change.path)));
  return planApply(changes, (record, change) => current.get(change.path));
}

test("paths map to the right records and anything else is ignored", () => {
  assert.deepEqual(recordForPath("content/projects/scan-assistant.md"), { kind: "entry", type: "projects", slug: "scan-assistant" });
  assert.deepEqual(recordForPath("content/data/timeline.yml"), { kind: "document", name: "timeline" });
  assert.deepEqual(recordForPath("content/legal/privacy.hbs"), { kind: "entry", type: "legal", slug: "privacy" });
  assert.equal(recordForPath("content/cv/reece-barker-cv.pdf"), null);
  assert.equal(recordForPath("content/projects/_template.md"), null);
});

test("spacing and quoting in a hand written file dont count as a change", () => {
  const a = "# comment\nupdated: '2026-10-12'\nitems:\n  - title: One\n";
  const b = "updated: 2026-10-12\nitems:\n- title: \"One\"\n";
  assert.equal(canonicalText("content/data/now.yml", a), canonicalText("content/data/now.yml", b));
  assert.equal(canonicalText("content/projects/x.md", project("X", "draft: true\n")), null);
});

test("an untouched entry takes the new version, one edited in the admin is left alone", async () => {
  const ctx = await buildTestApp();
  try {
    const repo = ctx.services.contentRepository;
    const contentDir = ctx.config.paths.content;
    const nowFile = readFileSync(path.join(contentDir, "data/now.yml"), "utf8");
    const aboutFile = readFileSync(path.join(contentDir, "pages/about.md"), "utf8");

    // About was edited in the admin after the files were written, now.yml wasnt
    const about = await repo.findEntry("pages", "about");
    await repo.saveEntry({ ...about, body: `${about.body}\n\nA line added in the admin.` });

    const newNow = nowFile.replace(/updated: .*/, "updated: '2030-01-01'");
    const changes = [
      { path: "content/data/now.yml", before: nowFile, after: newNow },
      { path: "content/pages/about.md", before: aboutFile, after: aboutFile.replace("I", "We") },
      { path: "content/projects/brand-new-thing.md", before: null, after: project("A brand new thing") },
      { path: "content/cv/reece-barker-cv.pdf", before: "x", after: "y" }
    ];
    const result = await plan(repo, changes);
    assert.deepEqual(result.apply.map((item) => item.path), ["content/data/now.yml", "content/projects/brand-new-thing.md"]);
    assert.deepEqual(result.conflicts, ["content/pages/about.md"]);
    assert.deepEqual(result.ignored, ["content/cv/reece-barker-cv.pdf"]);

    const done = await applyPlan(repo, result);
    assert.deepEqual(done.failed, []);
    assert.equal((await repo.getDocument("now")).updated, "2030-01-01");
    assert.equal((await repo.findEntry("projects", "brand-new-thing")).status, "published");
    assert.match((await repo.findEntry("pages", "about")).body, /A line added in the admin/);

    // The deploy after that, or a mirror commit from the admin, finds everything allready there
    const again = await plan(repo, changes.slice(0, 1));
    assert.deepEqual(again.same, ["content/data/now.yml"]);
    assert.equal(again.apply.length, 0);
  } finally { await ctx.close(); }
});

test("deletions and drafts are never overwritten or removed", async () => {
  const ctx = await buildTestApp();
  try {
    const repo = ctx.services.contentRepository;
    await repo.saveEntry({ type: "projects", slug: "half-done", title: "Half done", status: "draft", meta: { summary: "Not ready", branch: "code", kind: "Personal", sort_date: "2026-01" }, body: "Draft words." });
    const scan = readFileSync(path.join(ctx.config.paths.content, "projects/scan-assistant.md"), "utf8");
    const result = await plan(repo, [
      { path: "content/projects/half-done.md", before: null, after: project("Half done") },
      { path: "content/projects/scan-assistant.md", before: scan, after: null }
    ]);
    assert.deepEqual(result.conflicts, ["content/projects/half-done.md"]);
    assert.deepEqual(result.deleted, ["content/projects/scan-assistant.md"]);
    assert.equal(result.apply.length, 0);
    await applyPlan(repo, result);
    assert.equal((await repo.findEntry("projects", "half-done")).status, "draft");
    assert.equal((await repo.findEntry("projects", "scan-assistant")).status, "published");
  } finally { await ctx.close(); }
});

test("a file that wouldnt save in the admin is reported, the rest still goes in", async () => {
  const ctx = await buildTestApp();
  try {
    const repo = ctx.services.contentRepository;
    const result = await plan(repo, [
      { path: "content/projects/no-summary.md", before: null, after: "---\ntitle: No summary\n---\n\nWords.\n" },
      { path: "content/projects/fine-one.md", before: null, after: project("Fine one") }
    ]);
    const done = await applyPlan(repo, result);
    assert.deepEqual(done.written, ["content/projects/fine-one.md"], done.failed.join("; "));
    assert.equal(done.failed.length, 1);
    assert.match(done.failed[0], /no-summary/);
    assert.equal(await repo.findEntry("projects", "no-summary"), null);
  } finally { await ctx.close(); }
});

test("every file in content/ reads the same as its database copy, so a real deploy finds no false conflicts", async () => {
  const ctx = await buildTestApp();
  try {
    const repo = ctx.services.contentRepository;
    const root = path.dirname(ctx.config.paths.content);
    const { readdirSync } = await import("node:fs");
    const files = [];
    for (const folder of ["projects", "writing", "pages", "legal", "data"]) {
      for (const name of readdirSync(path.join(ctx.config.paths.content, folder))) files.push(`content/${folder}/${name}`);
    }
    const mismatched = [];
    for (const file of files) {
      const record = recordForPath(file);
      if (!record || (record.kind === "document" && record.name === "references")) continue;
      const text = readFileSync(path.join(root, file), "utf8");
      if (canonicalText(file, text) !== await databaseText(repo, record)) mismatched.push(file);
    }
    assert.deepEqual(mismatched, []);
  } finally { await ctx.close(); }
});
