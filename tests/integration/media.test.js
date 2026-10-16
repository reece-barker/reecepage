// The media library end to end: admin login, uploading, refusing bad files, publishing, the public pages, serving
// files with byte ranges, and browser error reports going to the error monitor
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import request from "supertest";
import { buildTestApp, testConfig, hiddenValue, cookieHeader } from "../helpers/app.js";
import { hashPassword } from "../../src/middleware/admin-auth.js";
import { createErrorReporter } from "../../src/lib/error-reporter.js";

const PASSWORD = "correct horse battery staple";
const HASH = hashPassword(PASSWORD);
const auth = `Basic ${Buffer.from(`reece:${PASSWORD}`).toString("base64")}`;
// A real 2 x 1 PNG
const PNG = Buffer.from("89504e470d0a1a0a0000000d49484452000000020000000108060000005e7e8e7f0000000d4944415478da63f8cfc0f01f0005fe02fe a7b6c2f60000000049454e44ae426082".replace(/ /g, ""), "hex");

let dir;
let ctx;
const reported = [];

before(async () => {
  dir = mkdtempSync(path.join(tmpdir(), "rp-media-"));
  const config = testConfig({ env: { ADMIN_PASSWORD_HASH: HASH, MEDIA_DIR: dir, ERROR_DSN: "https://key@errors.example/1" } });
  const errorReporter = createErrorReporter({ dsn: config.monitoring.dsn, environment: "test", release: "t", fetchImpl: async (url, options) => { reported.push(JSON.parse(options.body)); return { ok: true }; } });
  ctx = await buildTestApp({ config, errorReporter });
});

after(async () => {
  await ctx.close();
  rmSync(dir, { recursive: true, force: true });
});

async function adminSession() {
  const page = await request(ctx.app).get("/admin/media").set("Authorization", auth).expect(200);
  return { cookie: cookieHeader(page), csrf: /data-csrf="([^"]+)"/.exec(page.text)[1], html: page.text };
}

function upload(session, body, fields) {
  const req = request(ctx.app).put("/admin/media/upload").set("Authorization", auth).set("Cookie", session.cookie)
    .set("X-CSRF-Token", session.csrf).set("Content-Type", "application/octet-stream");
  for (const [name, value] of Object.entries(fields)) req.set(name, encodeURIComponent(value));
  return req.send(body);
}

test("admin is hidden without a password hash, and asks for a login with one", async () => {
  const plain = await buildTestApp({ withDatabase: false });
  await request(plain.app).get("/admin/media").expect(404);
  const res = await request(ctx.app).get("/admin/media").expect(401);
  assert.match(res.headers["www-authenticate"], /^Basic realm=/);
  await request(ctx.app).get("/admin/media").set("Authorization", `Basic ${Buffer.from("reece:wrong").toString("base64")}`).expect(401);
  const ok = await request(ctx.app).get("/admin/media").set("Authorization", auth).expect(200);
  assert.match(ok.headers["cache-control"], /no-store/);
  assert.match(ok.text, /noindex/);
});

test("uploads need the CSRF token", async () => {
  await request(ctx.app).put("/admin/media/upload").set("Authorization", auth).set("Content-Type", "application/octet-stream").send(PNG).expect(403);
});

test("a picture uploads unpublished, then shows on /media once published", async () => {
  const session = await adminSession();
  const res = await upload(session, PNG, { "X-Media-Title": "Test picture", "X-Media-Alt": "Two pixels side by side" }).expect(201);
  const { id, slug, shortcode } = res.body.item;
  assert.match(slug, /^test-picture-[0-9a-f]{6}$/);
  assert.equal(shortcode, `[[media:${slug}]]`);

  let page = await request(ctx.app).get("/media").expect(200);
  assert.ok(!page.text.includes("Test picture"), "not published yet");
  await request(ctx.app).get(`/media/${slug}`).expect(404);

  const edit = await adminSession();
  await request(ctx.app).post(`/admin/media/${id}`).set("Authorization", auth).set("Cookie", edit.cookie).type("form")
    .send({ _csrf: hiddenValue(edit.html, "_csrf"), title: "Test picture", alt: "Two pixels side by side", published: "on" }).expect(303);

  page = await request(ctx.app).get("/media").expect(200);
  assert.ok(page.text.includes("Test picture"));
  const single = await request(ctx.app).get(`/media/${slug}`).expect(200);
  assert.match(single.text, /alt="Two pixels side by side" width="2" height="1"/);
  const sitemap = await request(ctx.app).get("/sitemap.xml").expect(200);
  assert.ok(sitemap.text.includes(`/media/${slug}`));
});

test("files are served with the right type, a long cache and byte ranges", async () => {
  const name = readdirSync(dir).find((file) => file.endsWith(".png"));
  const full = await request(ctx.app).get(`/media/files/${name}`).expect(200);
  assert.equal(full.headers["content-type"], "image/png");
  assert.match(full.headers["cache-control"], /immutable/);
  const part = await request(ctx.app).get(`/media/files/${name}`).set("Range", "bytes=0-7").expect(206);
  assert.equal(part.headers["content-range"], `bytes 0-7/${PNG.length}`);
  await request(ctx.app).get("/media/files/..%2F..%2Fetc%2Fpasswd").expect(404);
  await request(ctx.app).get("/media/files/missing.png").expect(404);
});

test("SVG, HTML and pictures without alt text are refused, and nothing is left behind", async () => {
  const session = await adminSession();
  const svg = await upload(session, Buffer.from("<svg xmlns='http://www.w3.org/2000/svg'><script>alert(1)</script></svg>"), { "X-Media-Title": "Sneaky", "X-Media-Alt": "x" }).expect(415);
  assert.match(svg.body.error, /Only JPEG, PNG/);
  await upload(session, Buffer.from("<!doctype html><script>alert(1)</script>"), { "X-Media-Title": "Sneaky", "X-Media-Alt": "x" }).expect(415);
  const noAlt = await upload(session, PNG, { "X-Media-Title": "No alt" }).expect(400);
  assert.match(noAlt.body.error, /alt text/);
  assert.deepEqual(readdirSync(path.join(dir, ".incoming")), [], "temporary files are cleaned up");
});

test("deleting removes the item and its file", async () => {
  const session = await adminSession();
  const res = await upload(session, PNG, { "X-Media-Title": "Delete me", "X-Media-Alt": "x" }).expect(201);
  const file = readdirSync(dir).find((name) => name.startsWith(res.body.item.slug));
  assert.ok(file);
  await request(ctx.app).post(`/admin/media/${res.body.item.id}/delete`).set("Authorization", auth).set("Cookie", session.cookie).type("form")
    .send({ _csrf: hiddenValue(session.html, "_csrf") }).expect(303);
  assert.ok(!readdirSync(dir).includes(file));
});

test("browser errors are forwarded to the monitor without personal data", async () => {
  const before = reported.length;
  await request(ctx.app).post("/errors").set("Content-Type", "application/json").set("User-Agent", "Mozilla/5.0 Chrome/130")
    .send({ message: "x is undefined for ada@example.org", type: "TypeError", stack: "f@https://reece.page/assets/js/main.js:1:2", page: "/about?email=ada@example.org" }).expect(204);
  const event = reported.at(-1);
  assert.equal(reported.length, before + 1);
  assert.equal(event.platform, "javascript");
  assert.equal(event.request.url, "/about");
  assert.equal(event.exception.values[0].value, "x is undefined for [email]");
  assert.equal(event.tags.browser, "Chrome");
  await request(ctx.app).post("/errors").set("Content-Type", "application/json").send({}).expect(400);
});

test("server errors on pages are reported with the request id", async () => {
  ctx.services.content.page = () => { throw new Error("content exploded"); };
  const res = await request(ctx.app).get("/about").expect(500);
  assert.ok(!res.text.includes("content exploded"), "no error text on the page");
  const event = reported.at(-1);
  assert.equal(event.exception.values[0].value, "content exploded");
  assert.equal(event.request.url, "/about");
  assert.ok(event.tags.request_id);
});
