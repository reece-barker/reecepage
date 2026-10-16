// The cookie banner and settings page. With analytics off (the default) there is nothing to ask, so no banner
import { test } from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import { buildTestApp, testConfig, hiddenValue, cookieHeader } from "../helpers/app.js";

const withAnalytics = () => testConfig({ patch: { features: { analytics: true }, analytics: { provider: "plausible" } } });

test("no banner and no analytics script while analytics is off", async () => {
  const ctx = await buildTestApp({ withDatabase: false });
  const res = await request(ctx.app).get("/").expect(200);
  assert.ok(!res.text.includes("data-consent-form"));
  assert.ok(!res.text.includes("plausible.io"));
  assert.ok(!res.headers["content-security-policy"].includes("plausible"));
});

test("with analytics on, the banner shows, the script does not, and the CSP allows the host", async () => {
  const ctx = await buildTestApp({ config: withAnalytics(), withDatabase: false });
  const res = await request(ctx.app).get("/").expect(200);
  assert.match(res.text, /data-consent-form/);
  assert.ok(!/<script[^>]+plausible/.test(res.text), "nothing loads before a yes");
  assert.match(res.headers["content-security-policy"], /https:\/\/plausible\.io/);
  // The two buttons are equally easy: same element, same class
  const buttons = [...res.text.matchAll(/<button[^>]*name="choice"[^>]*>/g)].map((m) => m[0].replace(/value="\w+"/, ""));
  assert.equal(buttons.length, 2);
  assert.equal(buttons[0], buttons[1]);
});

async function choose(app, choice, extra = {}) {
  const page = await request(app).get("/cookies").expect(200);
  return request(app).post("/cookies").set("Cookie", cookieHeader(page)).type("form")
    .send({ _csrf: hiddenValue(page.text, "_csrf"), choice, ...extra });
}

test("saying no is remembered and nothing loads", async () => {
  const ctx = await buildTestApp({ config: withAnalytics(), withDatabase: false });
  const res = await choose(ctx.app, "reject", { return_to: "/about" });
  assert.equal(res.status, 303);
  assert.equal(res.headers.location, "/about");
  const cookie = res.headers["set-cookie"].find((c) => c.startsWith("rp_consent="));
  assert.match(cookie, /rp_consent=1\.none/);
  assert.match(cookie, /HttpOnly/);
  const next = await request(ctx.app).get("/about").set("Cookie", "rp_consent=1.none").expect(200);
  assert.ok(!next.text.includes("data-consent-form"));
  assert.ok(!/<script[^>]+plausible/.test(next.text));
});

test("saying yes loads the analytics script with its nonce", async () => {
  const ctx = await buildTestApp({ config: withAnalytics(), withDatabase: false });
  const res = await choose(ctx.app, "accept");
  assert.equal(res.status, 303);
  assert.equal(res.headers.location, "/cookies?saved=1");
  const next = await request(ctx.app).get("/about").set("Cookie", "rp_consent=1.analytics").expect(200);
  assert.match(next.text, /<script[^>]+plausible\.io[^>]*>/);
});

test("the banner script gets JSON back", async () => {
  const ctx = await buildTestApp({ config: withAnalytics(), withDatabase: false });
  const page = await request(ctx.app).get("/").expect(200);
  const res = await request(ctx.app).post("/cookies").set("Cookie", cookieHeader(page)).set("X-Requested-With", "fetch")
    .set("X-CSRF-Token", hiddenValue(page.text, "_csrf")).type("form").send({ choice: "accept" }).expect(200);
  assert.deepEqual(res.body, { ok: true, analytics: true });
});

test("return addresses can only be paths on this site", async () => {
  const ctx = await buildTestApp({ config: withAnalytics(), withDatabase: false });
  for (const target of ["https://evil.example", "//evil.example", "/\\evil.example", "javascript:alert(1)"]) {
    const res = await choose(ctx.app, "reject", { return_to: target });
    assert.equal(res.status, 303);
    assert.equal(res.headers.location, "/cookies?saved=1", target);
  }
});

test("posting the choice without the csrf token is refused", async () => {
  const ctx = await buildTestApp({ config: withAnalytics(), withDatabase: false });
  await request(ctx.app).post("/cookies").type("form").send({ choice: "accept" }).expect(403);
});
