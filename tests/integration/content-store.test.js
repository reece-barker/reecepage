// The content in the database: the first start imports content/, saves write revisions, scheduled posts go live on
// their own, and a database that stops answering leaves the site serving what it had
import { test } from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import { buildTestApp } from "../helpers/app.js";
import { importContent } from "../../src/services/content-import.js";

test("the first start fills the empty tables from content/ and the site reads from the database", async () => {
  const ctx = await buildTestApp();
  try {
    const { content, contentRepository } = ctx.services;
    assert.equal(content.source, "database");
    const about = await contentRepository.findEntry("pages", "about");
    assert.equal(about.status, "published");
    assert.ok(await contentRepository.findEntry("legal", "privacy"));
    assert.ok(Array.isArray(await contentRepository.getDocument("timeline")));
    // Running the import again adds nothing, the database wins unless asked to overwrite
    const again = await importContent({ repository: contentRepository, contentDir: ctx.config.paths.content });
    assert.equal(again.added.length, 0);
    assert.ok(again.skipped.length > 10);
    assert.deepEqual(again.failed, []);
  } finally { await ctx.close(); }
});

test("a change in the database shows on the site after a refresh, drafts and the trash dont", async () => {
  const ctx = await buildTestApp();
  try {
    const { content, contentRepository: repo } = ctx.services;
    const { entry } = await repo.saveEntry({ type: "writing", slug: "fresh-post", title: "A fresh post", status: "published", meta: { summary: "Hello there", date: "2026-10-20" }, body: "## Start\n\nWords." });
    await content.refresh();
    await request(ctx.app).get("/writing/fresh-post").expect(200).expect(/A fresh post/);

    await repo.setStatus(entry.id, "draft");
    await content.refresh();
    await request(ctx.app).get("/writing/fresh-post").expect(404);

    await repo.setStatus(entry.id, "trash");
    await content.refresh();
    await request(ctx.app).get("/writing/fresh-post").expect(404);
    const revisions = await repo.revisions(entry.id);
    assert.deepEqual(revisions.map((r) => r.status), ["trash", "draft", "published"]);
  } finally { await ctx.close(); }
});

test("a scheduled post stays hidden until its time, then goes live without a save", async () => {
  const ctx = await buildTestApp();
  try {
    const { content, contentRepository: repo } = ctx.services;
    const soon = new Date(Date.now() + 1500);
    await repo.saveEntry({ type: "writing", slug: "timed-post", title: "Timed", status: "published", publishAt: soon, meta: { summary: "Later" }, body: "Text" });
    await content.refresh();
    await request(ctx.app).get("/writing/timed-post").expect(404);
    await new Promise((resolve) => setTimeout(resolve, 3000));
    await request(ctx.app).get("/writing/timed-post").expect(200);
  } finally { await ctx.close(); }
});

test("old revisions are trimmed but publish ones are kept", async () => {
  const ctx = await buildTestApp();
  try {
    const repo = ctx.services.contentRepository;
    const { entry } = await repo.saveEntry({ type: "pages", slug: "busy", title: "Busy", status: "published", meta: {}, body: "v0" }, { reason: "publish" });
    for (let i = 1; i <= 55; i += 1) await repo.saveEntry({ ...entry, body: `v${i}` }, { reason: "autosave" });
    const revisions = await repo.revisions(entry.id);
    assert.equal(revisions.filter((r) => r.reason === "autosave").length, 50);
    assert.ok(revisions.some((r) => r.reason === "publish" && r.body === "v0"));
  } finally { await ctx.close(); }
});

test("when the database stops answering the site keeps serving what it had", async () => {
  const ctx = await buildTestApp();
  try {
    const { content, contentRepository: repo } = ctx.services;
    repo.readAll = async () => { throw new Error("connection lost"); };
    await content.refresh();
    await request(ctx.app).get("/about").expect(200);
    await request(ctx.app).get("/privacy").expect(200);
    content.stop();
  } finally { await ctx.close(); }
});
