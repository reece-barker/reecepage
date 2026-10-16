// The contact form from start to finish: CSRF, the form token, honeypot, validation, saving, emailing, duplicates,
// failures and the rate limit. Mail goes to a fake transport, the database is in memory.
import { test } from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import { buildTestApp, testConfig, FakeTransport, hiddenValue, cookieHeader } from "../helpers/app.js";

const good = { name: "Ada Lovelace", email: "ada@example.org", topic: "Something else", message: "Hello Reece, I liked the tree on your site." };

/** Opens the contact page like a browser and returns what a real submit needs */
async function openForm(app) {
  const page = await request(app).get("/contact").expect(200);
  return {
    cookie: cookieHeader(page),
    csrf: hiddenValue(page.text, "_csrf"),
    token: hiddenValue(page.text, "form_token"),
    html: page.text
  };
}

function post(app, form, fields) {
  return request(app).post("/contact").set("Cookie", form.cookie).type("form")
    .send({ _csrf: form.csrf, form_token: form.token, website: "", ...fields });
}

test("the page has a labelled form with a honeypot, a token and a csrf field", async () => {
  const ctx = await buildTestApp();
  const form = await openForm(ctx.app);
  assert.ok(form.csrf, "csrf token");
  assert.ok(form.token, "form token");
  assert.match(form.cookie, /rp\.csrf=/);
  for (const field of ["name", "email", "topic", "message"]) assert.match(form.html, new RegExp(`<label[^>]+for="field-${field}"`), field);
  assert.match(form.html, /name="website"[^>]*tabindex="-1"/);
  assert.match(form.html, /autocomplete="email"/);
  await ctx.close();
});

test("a good message is stored, emailed and lands on the thank you page", async () => {
  const ctx = await buildTestApp();
  const form = await openForm(ctx.app);
  const res = await post(ctx.app, form, good).expect(303);
  assert.equal(res.headers.location, "/contact/thank-you");

  const rows = await ctx.services.contact.repository.listRecent();
  assert.equal(rows.length, 1);
  assert.equal(rows[0].email, "ada@example.org");
  assert.ok(rows[0].notified_at || rows[0].notifiedAt, "marked as notified");
  assert.ok((rows[0].ip_hash || rows[0].ipHash).length === 64, "ip stored only as a hash");

  assert.equal(ctx.transport.sent.length, 1);
  const mail = ctx.transport.sent[0];
  assert.equal(mail.to, "me@reece.page");
  assert.equal(mail.replyTo, "ada@example.org");
  assert.match(mail.subject, /Something else, from Ada Lovelace/);
  assert.match(mail.text, /I liked the tree/);

  const thanks = await request(ctx.app).get("/contact/thank-you").expect(200);
  assert.match(thanks.text, /noindex/);
  await ctx.close();
});

test("pressing send twice saves and sends once", async () => {
  const ctx = await buildTestApp();
  const form = await openForm(ctx.app);
  await post(ctx.app, form, good).expect(303);
  await post(ctx.app, form, good).expect(303);
  assert.equal((await ctx.services.contact.repository.listRecent()).length, 1);
  assert.equal(ctx.transport.sent.length, 1);
  await ctx.close();
});

test("without the csrf cookie or token the post is refused", async () => {
  const ctx = await buildTestApp();
  const form = await openForm(ctx.app);
  await request(ctx.app).post("/contact").type("form").send({ ...good, _csrf: form.csrf, form_token: form.token }).expect(403);
  await post(ctx.app, { ...form, csrf: "forged" }, good).expect(403);
  assert.equal(ctx.transport.sent.length, 0);
  await ctx.close();
});

test("the honeypot silently drops bots", async () => {
  const ctx = await buildTestApp();
  const form = await openForm(ctx.app);
  await post(ctx.app, form, { ...good, website: "http://spam.example" }).expect(303);
  assert.equal(ctx.transport.sent.length, 0);
  assert.equal((await ctx.services.contact.repository.listRecent()).length, 0);
  await ctx.close();
});

test("mistakes come back with a summary, the values kept and 422", async () => {
  const ctx = await buildTestApp();
  const form = await openForm(ctx.app);
  const res = await post(ctx.app, form, { ...good, email: "not-an-email", message: "short" }).expect(422);
  assert.match(res.text, /data-error-summary/);
  assert.match(res.text, /href="#field-email"/);
  assert.match(res.text, /aria-invalid="true"/);
  assert.match(res.text, /value="Ada Lovelace"/);
  assert.match(res.text, /aria-describedby="[^"]*error-email/);
  assert.equal(ctx.transport.sent.length, 0);
  await ctx.close();
});

test("typed text is escaped when the form comes back", async () => {
  const ctx = await buildTestApp();
  const form = await openForm(ctx.app);
  const res = await post(ctx.app, form, { ...good, name: "<script>alert(1)</script>", email: "x" }).expect(422);
  assert.ok(!res.text.includes("<script>alert(1)</script>"));
  assert.match(res.text, /&lt;script&gt;/);
  await ctx.close();
});

test("a tampered or too quick form token asks the person to press send again", async () => {
  const config = testConfig({ patch: { contact: { min_seconds_to_submit: 30 } } });
  const ctx = await buildTestApp({ config });
  const form = await openForm(ctx.app);
  const quick = await post(ctx.app, form, good).expect(422);
  assert.match(quick.text, /data-notice="resubmit"/);
  const forged = await post(ctx.app, { ...form, token: "1.aaaaaaaaaaaaaaaa.bad" }, good).expect(422);
  assert.match(forged.text, /value="Ada Lovelace"/);
  assert.equal(ctx.transport.sent.length, 0);
  await ctx.close();
});

test("if email fails the message is still stored and the person still sees thank you", async () => {
  const ctx = await buildTestApp({ transport: new FakeTransport({ fail: true }) });
  const form = await openForm(ctx.app);
  await post(ctx.app, form, good).expect(303);
  const [row] = await ctx.services.contact.repository.listUnnotified();
  assert.match(row.notificationError, /ECONNREFUSED/);
  await ctx.close();
});

test("if the database is down but email works the message still arrives", async () => {
  const ctx = await buildTestApp();
  const form = await openForm(ctx.app);
  await ctx.database.close();
  await post(ctx.app, form, good).expect(303);
  assert.equal(ctx.transport.sent.length, 1);
  assert.match(ctx.transport.sent[0].text, /Stored: no/);
});

test("if both storing and emailing fail the person is told and keeps their text", async () => {
  const ctx = await buildTestApp({ transport: new FakeTransport({ fail: true }) });
  const form = await openForm(ctx.app);
  await ctx.database.close();
  const res = await post(ctx.app, form, good).expect(503);
  assert.match(res.text, /data-notice="failed"/);
  assert.match(res.text, /I liked the tree/);
  assert.match(res.text, /me@reece\.page/);
});

test("with nowhere to send messages the page only shows the email address", async () => {
  const config = testConfig({ patch: { contact: { store_messages: false } } });
  const ctx = await buildTestApp({ config, transport: null });
  const page = await request(ctx.app).get("/contact").expect(200);
  assert.ok(!page.text.includes("data-contact-form"));
  assert.match(page.text, /me@reece\.page/);
  await ctx.close();
});

test("the rate limit stops a flood from one address", async () => {
  const config = testConfig({ patch: { contact: { rate_limit: { window_minutes: 60, max_submissions: 3 } } } });
  const ctx = await buildTestApp({ config });
  const form = await openForm(ctx.app);
  for (let i = 0; i < 3; i++) await post(ctx.app, form, { ...good, email: "x" }).expect(422);
  const res = await post(ctx.app, form, good).expect(429);
  assert.match(res.text, /<h1/);
  assert.ok(res.headers["retry-after"] || res.headers["ratelimit-reset"] || res.headers.ratelimit);
  await ctx.close();
});

test("oversized bodies are refused before anything reads them", async () => {
  const ctx = await buildTestApp();
  const form = await openForm(ctx.app);
  await post(ctx.app, form, { ...good, message: "x".repeat(30000) }).expect(413);
  await ctx.close();
});
