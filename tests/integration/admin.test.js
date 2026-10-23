// The admin from the outside: signing in, the pages, writing and publishing posts, scheduling, autosave, the trash,
// revisions, the preview, the lists and settings, the legal templates, and the CV, references and status pages
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import request from "supertest";
import { buildTestApp, adminConfig, signIn } from "../helpers/app.js";
import { ENDPOINT_GROUPS } from "../../src/admin/endpoints.js";
import { ROOT_DIR } from "../../src/config/index.js";

let ctx;
let session;

before(async () => {
  ctx = await buildTestApp({ config: adminConfig() });
  session = await signIn(ctx.app);
});

after(async () => { await ctx.close(); });

const get = (url) => request(ctx.app).get(url).set("Cookie", session.cookie);
const post = (url, body) => request(ctx.app).post(url).set("Cookie", session.cookie).set("X-CSRF-Token", session.csrf).send(body);
const form = (url, body = {}) => request(ctx.app).post(url).set("Cookie", session.cookie).type("form").send({ _csrf: session.csrf, ...body });

test("without a session pages go to the sign in page and the editor gets a 401", async () => {
  await request(ctx.app).get("/admin/writing").set("Accept", "text/html").expect(303).expect("Location", "/admin/login?next=%2Fadmin%2Fwriting");
  const json = await request(ctx.app).post("/admin/writing/save").send({}).expect(401);
  assert.equal(json.body.signedOut, true);
  const login = await request(ctx.app).get("/admin/login").expect(200);
  assert.match(login.text, /Development sign in/);
  assert.match(login.headers["x-robots-tag"], /noindex/);
});

test("the development sign in is only there when its switched on", async () => {
  // No database here on purpose: on MySQL every test app shares one database, a second one would reset it
  const plain = await buildTestApp({ withDatabase: false });
  try {
    const page = await request(plain.app).get("/admin/login").expect(200);
    assert.doesNotMatch(page.text, /Development sign in/);
    assert.match(page.text, /needs the database/);
  } finally { await plain.close(); }
});

test("every route is listed on the system page", async () => {
  const res = await get("/admin/system").expect(200);
  assert.match(res.text, /Every address on the site/);
  const routes = readFileSync(path.join(ROOT_DIR, "src/routes/index.js"), "utf8");
  const listed = new Set(ENDPOINT_GROUPS.flatMap((group) => group.items.map((item) => item.path)));
  for (const [, route] of routes.matchAll(/\.(?:get|post|put)\(\s*"([^"]+)"/g)) {
    assert.ok(listed.has(route), `${route} is missing from src/admin/endpoints.js`);
  }
});

test("dashboard, lists and editors render", async () => {
  const dash = await get("/admin").expect(200);
  assert.match(dash.text, /New post/);
  for (const type of ["writing", "pages", "projects", "legal"]) {
    const list = await get(`/admin/${type}`).expect(200);
    assert.match(list.text, /admin-entries|admin-empty/);
  }
  await get("/admin/writing/new").expect(200);
  await get("/admin/legal/new").expect(404);
  await get("/admin/nonsense").expect(404);
  const about = await ctx.services.contentRepository.findEntry("pages", "about");
  const editor = await get(`/admin/pages/${about.id}`).expect(200);
  assert.match(editor.text, /data-editor-config/);
  assert.match(editor.headers["content-security-policy"], /style-src 'self' 'nonce-/);
  for (const name of ["timeline", "skills", "cv", "references", "now", "branches", "home", "menus", "settings"]) await get(`/admin/lists/${name}`).expect(200);
  await get("/admin/account").expect(200);
  await get("/admin/sync").expect(200);
});

test("a post goes from draft to published to updated to the trash and back", async () => {
  const draft = await post("/admin/writing/save", { action: "draft", title: "Notes from the workshop", meta: { tags: ["robots"] }, body: "## First\n\nWords." }).expect(200);
  const { id, slug, state } = draft.body.entry;
  assert.equal(slug, "notes-from-the-workshop");
  assert.equal(state, "draft");
  await request(ctx.app).get("/writing/notes-from-the-workshop").expect(404);

  // Publishing needs the summary, a draft didnt
  const refused = await post("/admin/writing/save", { id, action: "publish", title: "Notes from the workshop", body: "Words." }).expect(400);
  assert.ok(refused.body.errors.some((e) => /Summary/.test(e)));

  const published = await post("/admin/writing/save", { id, action: "publish", title: "Notes from the workshop", meta: { summary: "What I learned" }, body: "## First\n\nWords." }).expect(200);
  assert.equal(published.body.entry.state, "published");
  const page = await request(ctx.app).get("/writing/notes-from-the-workshop").expect(200);
  assert.match(page.text, /What I learned/);

  await post("/admin/writing/save", { id, action: "update", title: "Notes from the workshop", meta: { summary: "What I learned, updated" }, body: "Words.", baseUpdatedAt: published.body.entry.updatedAt }).expect(200);
  await request(ctx.app).get("/writing/notes-from-the-workshop").expect(200).expect(/updated/);

  // An edit from a tab that was opened before the last save is refused instead of overwriting it
  const stale = await post("/admin/writing/save", { id, action: "update", title: "Old tab", meta: { summary: "x" }, body: "x", baseUpdatedAt: "2020-01-01T00:00:00Z" }).expect(409);
  assert.match(stale.body.error, /changed somewhere else/);

  await form(`/admin/writing/${id}/trash`).expect(303);
  await request(ctx.app).get("/writing/notes-from-the-workshop").expect(404);
  await form(`/admin/writing/${id}/restore`).expect(303);
  const restored = await ctx.services.contentRepository.getEntry(id);
  assert.equal(restored.status, "draft");

  const revisions = await get(`/admin/writing/${id}/revisions`).expect(200);
  assert.match(revisions.text, /Restore this version/);
  const first = (await ctx.services.contentRepository.revisions(id)).at(-1);
  await form(`/admin/writing/${id}/revisions/${first.id}/restore`).expect(303);
  assert.match((await ctx.services.contentRepository.getEntry(id)).body, /## First/);
});

test("autosave never changes what the site shows for something published", async () => {
  const saved = await post("/admin/writing/save", { action: "publish", title: "Steady post", meta: { summary: "Stays put" }, body: "The published text." }).expect(200);
  const { id } = saved.body.entry;
  const auto = await post("/admin/writing/save", { id, action: "autosave", title: "Steady post", meta: { summary: "Stays put" }, body: "Half written change." }).expect(200);
  assert.equal(auto.body.autosavedOnly, true);
  const page = await request(ctx.app).get("/writing/steady-post").expect(200);
  assert.match(page.text, /The published text/);
  assert.doesNotMatch(page.text, /Half written/);
  const editor = await get(`/admin/writing/${id}`).expect(200);
  assert.match(editor.text, /Half written change/, "the editor offers the autosave back");
});

test("a scheduled post waits for its time", async () => {
  const later = new Date(Date.now() + 3600 * 1000).toISOString();
  const res = await post("/admin/writing/save", { action: "publish", title: "Coming soon", meta: { summary: "Later" }, body: "Text", publishAt: later }).expect(200);
  assert.equal(res.body.entry.state, "scheduled");
  await request(ctx.app).get("/writing/coming-soon").expect(404);
  const dash = await get("/admin").expect(200);
  assert.match(dash.text, /Coming soon/);
});

test("addresses are checked: clashes, reserved ones and bad characters", async () => {
  await post("/admin/pages/save", { action: "publish", title: "Uses", body: "What I use." }).expect(200);
  await request(ctx.app).get("/uses").expect(200).expect(/What I use/);
  const clash = await post("/admin/pages/save", { action: "draft", title: "Uses again", slug: "uses", body: "x" }).expect(400);
  assert.match(clash.body.errors.join(" "), /already is a page at uses/);
  const reserved = await post("/admin/pages/save", { action: "draft", title: "Contact", slug: "contact", body: "x" }).expect(400);
  assert.match(reserved.body.errors.join(" "), /already used by another part of the site/);
  const bad = await post("/admin/writing/save", { action: "draft", title: "x", slug: "Not Allowed!", body: "x" }).expect(400);
  assert.match(bad.body.errors.join(" "), /lowercase letters/);
});

test("the preview shows unsaved text on the real page and nothing goes live", async () => {
  const made = await post("/admin/preview", { type: "projects", title: "Secret project", meta: {}, body: "## Plan\n\n:::note\nNot live yet.\n:::" }).expect(200);
  const page = await get(made.body.url).expect(200);
  assert.match(page.text, /Secret project/);
  assert.match(page.text, /callout callout--note/);
  assert.match(page.headers["content-security-policy"], /frame-ancestors 'self'/);
  await request(ctx.app).get("/projects/secret-project").expect(404);
  await request(ctx.app).get(made.body.url).set("Accept", "text/html").expect(303);
});

test("lists save, refuse bad values and need the CSRF token", async () => {
  const value = { updated: "2026-10-12", items: [{ title: "Testing the editor", text: "Saved from a test." }], next: [] };
  await post("/admin/lists/now", { value }).expect(200);
  await request(ctx.app).get("/").expect(/Testing the editor/);
  await post("/admin/lists/now", { value: { items: "nope" } }).expect(400);
  await request(ctx.app).post("/admin/lists/now").set("Cookie", session.cookie).send({ value }).expect(403);
  const revisions = await ctx.services.contentRepository.documentRevisions("now");
  assert.ok(revisions.length >= 2);
});

test("settings, menus and the home page texts change the site", async () => {
  await post("/admin/lists/settings", { value: { name: "Reece B.", description: "A test description for the home page." } }).expect(200);
  await post("/admin/lists/menus", { value: { primary: [{ label: "Start", href: "/" }, { label: "Work", href: "/projects" }, { label: "Notes", href: "/writing" }] } }).expect(200);
  await post("/admin/lists/home", { value: { hero_lede: "A brand new intro line.", contact_heading: "Write to me" } }).expect(200);
  const home = await request(ctx.app).get("/").expect(200);
  assert.match(home.text, /<title>Reece B\.<\/title>/);
  assert.match(home.text, /A brand new intro line/);
  assert.match(home.text, /Write to me/);
  assert.match(home.text, />Work</);
  // Empty fields fall back to the defaults instead of leaving gaps
  await post("/admin/lists/settings", { value: {} }).expect(200);
  await post("/admin/lists/home", { value: {} }).expect(200);
  const back = await request(ctx.app).get("/").expect(200);
  assert.match(back.text, /<title>Reece Barker<\/title>/);
  assert.match(back.text, /I grew up in Munich/);
});

test("legal pages are edited as templates, a broken one is refused", async () => {
  const privacy = await ctx.services.contentRepository.findEntry("legal", "privacy");
  const broken = await post("/admin/legal/save", { id: privacy.id, action: "update", title: privacy.title, meta: privacy.meta, body: "{{#if legal.owner.email}}never closed" }).expect(400);
  assert.match(broken.body.error, /template has a mistake/);
  await post("/admin/legal/save", { id: privacy.id, action: "update", title: privacy.title, meta: privacy.meta, body: `${privacy.body}\n<p>An added line for the test, {{legal.owner.email}}.</p>` }).expect(200);
  const page = await request(ctx.app).get("/privacy").expect(200);
  assert.match(page.text, /An added line for the test, me@reece\.page/);
  await form(`/admin/legal/${privacy.id}/trash`).expect(303);
  assert.equal((await ctx.services.contentRepository.getEntry(privacy.id)).status, "published", "legal pages cant be trashed");
});

test("cv, references and status pages render", async () => {
  const cv = await request(ctx.app).get("/cv").expect(200);
  assert.match(cv.text, /cv-sheet/);
  await request(ctx.app).get("/references").expect(200);
  const status = await request(ctx.app).get("/status");
  assert.ok([200, 503].includes(status.status));
  assert.match(status.text, /status-list/);
});

test("signing out ends the session", async () => {
  const own = await signIn(ctx.app);
  await request(ctx.app).post("/admin/logout").set("Cookie", own.cookie).type("form").send({ _csrf: own.csrf }).expect(303);
  await request(ctx.app).get("/admin").set("Cookie", own.cookie).set("Accept", "text/html").expect(303);
});
