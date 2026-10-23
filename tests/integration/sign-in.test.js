// Sign in with SimpleLogin against a pretend SimpleLogin: the state has to match the browser that started it, the
// code is swapped with the client secret, only the allowed account gets in, and a stolen session cookie from
// another sign in or an expired one doesnt work. Plus the passkey endpoints without a passkey
import { test } from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import { buildTestApp, testConfig, cookieHeader, hiddenValue } from "../helpers/app.js";

function fakeSimpleLogin(user, { fail = false } = {}) {
  const calls = [];
  async function fetchImpl(url, init = {}) {
    calls.push({ url: String(url), init });
    if (fail) throw new Error("network down");
    if (String(url).endsWith("/oauth2/token")) {
      const body = new URLSearchParams(init.body);
      const good = body.get("client_secret") === "the-secret" && body.get("code") === "good-code";
      return new Response(JSON.stringify(good ? { access_token: "t", token_type: "Bearer", user } : { error: "invalid_grant" }), { status: good ? 200 : 400 });
    }
    return new Response("{}", { status: 404 });
  }
  return { fetchImpl, calls };
}

async function app({ allowedId = "36", user = { sub: "36", id: 36, email: "me@reece.page" }, fail } = {}) {
  const fake = fakeSimpleLogin(user, { fail });
  const config = testConfig({ env: { SIMPLELOGIN_CLIENT_ID: "client-1", SIMPLELOGIN_CLIENT_SECRET: "the-secret", ADMIN_SIMPLELOGIN_ID: allowedId } });
  const ctx = await buildTestApp({ config, fetch: fake.fetchImpl });
  return { ctx, fake };
}

/** Presses the button on the sign in page and returns where SimpleLogin was asked to send the browser back */
async function start(ctx) {
  const page = await request(ctx.app).get("/admin/login").expect(200);
  assert.match(page.text, /Sign in with SimpleLogin/);
  const cookie = cookieHeader(page);
  const res = await request(ctx.app).post("/admin/login/simplelogin").set("Cookie", cookie).type("form").send({ _csrf: hiddenValue(page.text, "_csrf"), next: "/admin/writing" }).expect(303);
  const url = new URL(res.headers.location);
  return { url, cookie: [cookie, cookieHeader(res)].join("; ") };
}

test("the allowed SimpleLogin account gets in and lands where it was going", async () => {
  const { ctx, fake } = await app();
  try {
    const { url, cookie } = await start(ctx);
    assert.equal(url.origin + url.pathname, "https://app.simplelogin.io/oauth2/authorize");
    assert.equal(url.searchParams.get("client_id"), "client-1");
    assert.equal(url.searchParams.get("redirect_uri"), "http://localhost:3000/admin/login/simplelogin/callback");
    const state = url.searchParams.get("state");
    const back = await request(ctx.app).get(`/admin/login/simplelogin/callback?code=good-code&state=${state}`).set("Cookie", cookie).expect(303);
    assert.equal(back.headers.location, "/admin/writing");
    const session = cookieHeader(back);
    assert.match(session, /rp\.admin=/);
    await request(ctx.app).get("/admin").set("Cookie", session).expect(200);
    const token = fake.calls.find((call) => call.url.endsWith("/oauth2/token"));
    assert.equal(new URLSearchParams(token.init.body).get("client_secret"), "the-secret");
    // The same state cant be used twice
    await request(ctx.app).get(`/admin/login/simplelogin/callback?code=good-code&state=${state}`).set("Cookie", cookie).expect(403);
  } finally { await ctx.close(); }
});

test("another SimpleLogin account is turned away", async () => {
  const { ctx } = await app({ user: { sub: "99", email: "someone@else.test" } });
  try {
    const { url, cookie } = await start(ctx);
    const res = await request(ctx.app).get(`/admin/login/simplelogin/callback?code=good-code&state=${url.searchParams.get("state")}`).set("Cookie", cookie).expect(403);
    assert.match(res.text, /isnt allowed into this admin/);
    assert.doesNotMatch(cookieHeader(res), /rp\.admin=/);
  } finally { await ctx.close(); }
});

test("without ADMIN_SIMPLELOGIN_ID the page says which id to put in .env, and nobody gets in", async () => {
  const { ctx } = await app({ allowedId: "" });
  try {
    const { url, cookie } = await start(ctx);
    const res = await request(ctx.app).get(`/admin/login/simplelogin/callback?code=good-code&state=${url.searchParams.get("state")}`).set("Cookie", cookie).expect(403);
    assert.match(res.text, /ADMIN_SIMPLELOGIN_ID(=|&#x3D;)36/);
  } finally { await ctx.close(); }
});

test("a callback from a different browser, a forged state or a bad code is refused", async () => {
  const { ctx } = await app();
  try {
    const { url, cookie } = await start(ctx);
    const state = url.searchParams.get("state");
    await request(ctx.app).get(`/admin/login/simplelogin/callback?code=good-code&state=${state}`).expect(403);
    const again = await start(ctx);
    await request(ctx.app).get("/admin/login/simplelogin/callback?code=good-code&state=forged").set("Cookie", again.cookie).expect(403);
    const third = await start(ctx);
    const bad = await request(ctx.app).get(`/admin/login/simplelogin/callback?code=bad-code&state=${third.url.searchParams.get("state")}`).set("Cookie", third.cookie).expect(502);
    assert.match(bad.text, /didnt accept the sign in/);
    void cookie;
  } finally { await ctx.close(); }
});

test("SimpleLogin being down says so and suggests a passkey", async () => {
  const { ctx } = await app({ fail: true });
  try {
    const { url, cookie } = await start(ctx);
    const res = await request(ctx.app).get(`/admin/login/simplelogin/callback?code=good-code&state=${url.searchParams.get("state")}`).set("Cookie", cookie).expect(502);
    assert.match(res.text, /couldnt be reached/);
  } finally { await ctx.close(); }
});

test("passkey sign in says theres no passkey yet, and adding one needs a session", async () => {
  const { ctx } = await app();
  try {
    const page = await request(ctx.app).get("/admin/login").expect(200);
    assert.doesNotMatch(page.text, /Use a passkey/, "no passkey button until one is added");
    const cookie = cookieHeader(page);
    const csrf = hiddenValue(page.text, "_csrf");
    const res = await request(ctx.app).post("/admin/login/passkey/options").set("Cookie", cookie).set("X-CSRF-Token", csrf).send({}).expect(404);
    assert.equal(res.body.code, "nopasskeys");
    await request(ctx.app).post("/admin/account/passkeys/options").set("Cookie", cookie).set("X-CSRF-Token", csrf).send({}).expect(401);
  } finally { await ctx.close(); }
});

test("sessions expire and dont survive being deleted", async () => {
  const { ctx } = await app();
  try {
    const { url, cookie } = await start(ctx);
    const back = await request(ctx.app).get(`/admin/login/simplelogin/callback?code=good-code&state=${url.searchParams.get("state")}`).set("Cookie", cookie).expect(303);
    const session = cookieHeader(back);
    await ctx.services.database.models.AdminSession.update({ expiresAt: new Date(Date.now() - 1000) }, { where: {} });
    await request(ctx.app).get("/admin").set("Cookie", session).set("Accept", "text/html").expect(303);
    assert.equal(await ctx.services.database.models.AdminSession.count(), 0);
  } finally { await ctx.close(); }
});
