// The admin hub, the editors saving to a copy of the content folder, and the CV, references and status pages
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, cpSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import request from "supertest";
import { buildTestApp, testConfig, cookieHeader } from "../helpers/app.js";
import { hashPassword } from "../../src/utils/password.js";
import { ENDPOINT_GROUPS } from "../../src/admin/endpoints.js";
import { ROOT_DIR } from "../../src/config/index.js";

const PASSWORD = "another long test password";
const auth = `Basic ${Buffer.from(`reece:${PASSWORD}`).toString("base64")}`;
let dir;
let ctx;

before(async () => {
  dir = mkdtempSync(path.join(tmpdir(), "rp-admin-"));
  cpSync(path.join(ROOT_DIR, "content"), path.join(dir, "content"), { recursive: true });
  const config = testConfig({
    env: { ADMIN_PASSWORD_HASH: hashPassword(PASSWORD), MEDIA_DIR: path.join(dir, "media"), CONTENT_EDITING: "true" },
    patch: { paths: { content: path.join(dir, "content") } }
  });
  ctx = await buildTestApp({ config });
});

after(async () => {
  await ctx.close();
  rmSync(dir, { recursive: true, force: true });
});

test("the hub needs the password and lists every route", async () => {
  await request(ctx.app).get("/admin").expect(401);
  const res = await request(ctx.app).get("/admin").set("Authorization", auth).expect(200);
  assert.match(res.text, /noindex/);
  assert.match(res.text, /\/admin\/data\/timeline/);
  const routes = readFileSync(path.join(ROOT_DIR, "src/routes/index.js"), "utf8");
  const listed = new Set(ENDPOINT_GROUPS.flatMap((group) => group.items.map((item) => item.path)));
  for (const [, route] of routes.matchAll(/\.(?:get|post|put)\(\s*"([^"]+)"/g)) {
    assert.ok(listed.has(route), `${route} is missing from src/admin/endpoints.js`);
  }
});

test("a data file saves through the editor and bad values are refused", async () => {
  const page = await request(ctx.app).get("/admin/data/now").set("Authorization", auth).expect(200);
  const csrf = /data-csrf="([^"]+)"/.exec(page.text)?.[1] || /name="_csrf" value="([^"]+)"/.exec(page.text)?.[1];
  assert.ok(csrf, "the editor page carries a csrf token");
  const cookie = cookieHeader(page);
  const value = { updated: "2026-10-12", items: [{ title: "Testing the editor", text: "Saved from a test." }], next: [] };
  await request(ctx.app).post("/admin/data/now").set("Authorization", auth).set("Cookie", cookie).set("X-CSRF-Token", csrf)
    .send({ value }).expect(200);
  assert.match(readFileSync(path.join(dir, "content/data/now.yml"), "utf8"), /Testing the editor/);
  await request(ctx.app).post("/admin/data/now").set("Authorization", auth).set("Cookie", cookie).set("X-CSRF-Token", csrf)
    .send({ value: { items: "nope" } }).expect(400);
  await request(ctx.app).post("/admin/data/now").set("Authorization", auth).send({ value }).expect(403);
});

test("cv, references and status pages render", async () => {
  const cv = await request(ctx.app).get("/cv").expect(200);
  assert.match(cv.text, /cv-sheet/);
  await request(ctx.app).get("/references").expect(200);
  const status = await request(ctx.app).get("/status");
  assert.ok([200, 503].includes(status.status));
  assert.match(status.text, /status-list/);
});
