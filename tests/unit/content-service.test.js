import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { ContentService, ContentError, isLive } from "../../src/services/content-service.js";
import { ROOT_DIR } from "../../src/config/index.js";

let dir;

function write(relative, text) {
  const file = path.join(dir, relative);
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, text);
}

const project = (front, body = "Body text.") => `---\n${front}\n---\n${body}\n`;

before(() => {
  dir = mkdtempSync(path.join(tmpdir(), "rp-content-"));
  write("projects/older.md", project("title: Older\nsummary: An older one\nbranch: code\nkind: Course project\nperiod: 2025\nsort_date: 2025-03\nfeatured: true\norder: 2"));
  write("projects/newer.md", project("title: Newer\nsummary: A newer one\nbranch: earth\nkind: Startup\nperiod: 2026\nsort_date: 2026-09\nfeatured: true\norder: 1",
    "## Why\n\nA [link](https://example.org) and an [inside link](/about).\n\n## Why\n\n![A plan](/x.png \"800x600\")\n\n| a | b |\n|---|---|\n| 1 | 2 |"));
  write("projects/no-page.md", project("title: No page\nsummary: Listed only\nbranch: faith\nkind: Other\nperiod: 2024\nsort_date: 2024\npage: false"));
  write("projects/hidden.md", project("title: Hidden\nsummary: Draft\nbranch: code\nkind: Other\nperiod: 2026\nsort_date: 2026-10\ndraft: true"));
  write("projects/_template.md", "this is ignored");
  write("writing/first-post.md", "---\ntitle: First post\nsummary: Hello\ndate: 2026-10-01\n---\nSome words.\n");
  write("pages/about.md", "---\ntitle: About\n---\n## Hello\n\nText.\n");
  write("data/now.yml", "updated: 2026-10-12\nitems:\n  - one\n");
});

after(() => rmSync(dir, { recursive: true, force: true }));

test("projects are read, sorted newest first and drafts are left out", () => {
  const content = new ContentService({ contentDir: dir });
  assert.deepEqual(content.listProjects().map((p) => p.slug), ["newer", "older", "no-page"]);
  assert.deepEqual(content.listProjects({ branch: "earth" }).map((p) => p.slug), ["newer"]);
  assert.deepEqual(content.featuredProjects().map((p) => p.slug), ["newer", "older"]);
  assert.equal(content.listProjects().find((p) => p.slug === "older").period, "2025");
});

test("only published entries whose publish time has passed are live", () => {
  const now = new Date("2026-10-20T12:00:00Z");
  assert.equal(isLive({ status: "published", publishAt: null }, now), true);
  assert.equal(isLive({ status: "published", publishAt: new Date("2026-10-20T11:59:00Z") }, now), true);
  assert.equal(isLive({ status: "published", publishAt: new Date("2026-10-21T08:00:00Z") }, now), false);
  assert.equal(isLive({ status: "draft", publishAt: null }, now), false);
  assert.equal(isLive({ status: "trash", publishAt: null }, now), false);
});

test("a scheduled post without a date of its own gets the day it goes live", () => {
  const content = new ContentService({ contentDir: dir });
  const past = new Date(Date.now() - 60000);
  const store = content.build([{ type: "writing", slug: "later", title: "Later", status: "published", publishAt: past, meta: { summary: "Soon" }, body: "Hi", updatedAt: past }], {});
  assert.equal(store.writing[0].date.getTime(), past.getTime());
});

test("projects with page: false are listed but have no page", () => {
  const content = new ContentService({ contentDir: dir });
  assert.equal(content.getProject("no-page"), null);
  assert.ok(content.getProject("newer"));
  assert.equal(content.getProject("../etc/passwd"), null);
  assert.deepEqual(Object.values(content.neighbours("newer")).map((p) => p?.slug ?? null), [null, "older"]);
});

test("markdown gets heading ids, safe external links, lazy sized images and scrolling tables", () => {
  const { html, headings } = new ContentService({ contentDir: dir }).getProject("newer");
  assert.deepEqual(headings, [{ id: "why", text: "Why" }, { id: "why-2", text: "Why" }]);
  assert.match(html, /<a href="https:\/\/example.org" rel="noopener">link<\/a>/);
  assert.match(html, /<a href="\/about">inside link<\/a>/);
  assert.match(html, /<img src="\/x.png" alt="A plan" width="800" height="600" loading="lazy"/);
  assert.match(html, /<div class="table-scroll" tabindex="0" role="region"/);
});

test("articles, pages and data files", () => {
  const content = new ContentService({ contentDir: dir });
  assert.equal(content.getArticle("first-post").title, "First post");
  assert.equal(content.page("about").headings[0].id, "hello");
  assert.deepEqual(content.data("now").items, ["one"]);
  assert.equal(content.page("missing"), null);
});

test("broken front matter names the file", () => {
  const bad = mkdtempSync(path.join(tmpdir(), "rp-bad-"));
  mkdirSync(path.join(bad, "projects"));
  writeFileSync(path.join(bad, "projects/broken.md"), "---\ntitle: Broken\nbranch: space\n---\n");
  try {
    assert.throws(() => new ContentService({ contentDir: bad }).load(), (error) => error instanceof ContentError && error.message.includes("projects/broken"));
    writeFileSync(path.join(bad, "projects/broken.md"), project("title: Broken\nsummary: x\nbranch: code\nkind: x\nperiod: 2026\nsort_date: whenever"));
    assert.throws(() => new ContentService({ contentDir: bad }).load(), /sort date/);
    writeFileSync(path.join(bad, "projects/Bad Name.md"), "x");
    assert.throws(() => new ContentService({ contentDir: bad }).load(), /lowercase words/);
  } finally {
    rmSync(bad, { recursive: true, force: true });
  }
});

test("the real content folder loads without errors", () => {
  const content = new ContentService({ contentDir: path.join(ROOT_DIR, "content") });
  content.load();
  assert.ok(content.listProjects().length > 5);
  assert.ok(content.page("about"));
});
