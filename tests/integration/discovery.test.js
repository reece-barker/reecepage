// robots, sitemap, llms.txt, feed, manifest, security.txt, tdmrep and the health checks
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import { buildTestApp, testConfig } from "../helpers/app.js";

let ctx;
before(async () => { ctx = await buildTestApp(); });
after(async () => { await ctx.close(); });

test("robots.txt blocks everything outside production", async () => {
  const res = await request(ctx.app).get("/robots.txt").expect(200).expect("Content-Type", /text\/plain/);
  assert.match(res.text, /Disallow: \//);
});

test("robots.txt in production allows crawling and points at the sitemap", async () => {
  const production = testConfig({ patch: { isProduction: true, env: "production" } });
  const prod = await buildTestApp({ config: production, withDatabase: false });
  const res = await request(prod.app).get("/robots.txt").set("Host", "localhost:3000").expect(200);
  assert.match(res.text, /Allow: \//);
  assert.match(res.text, /Sitemap: http:\/\/localhost:3000\/sitemap\.xml/);
  assert.equal(res.headers["x-robots-tag"], undefined);
  assert.match(res.headers["strict-transport-security"], /max-age=31536000/);
  // Any other host name gets sent to the real one
  const wrong = await request(prod.app).get("/about?x=1").set("Host", "www.example.test").expect(301);
  assert.equal(wrong.headers.location, "http://localhost:3000/about?x=1");
});

test("the sitemap lists every page with its own page, and nothing else", async () => {
  const res = await request(ctx.app).get("/sitemap.xml").expect(200).expect("Content-Type", /xml/);
  const urls = [...res.text.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => new URL(m[1]).pathname);
  for (const path of ["/", "/about", "/projects", "/projects/microclimate-startup", "/contact", "/privacy", "/impressum"]) {
    assert.ok(urls.includes(path), path);
  }
  assert.ok(!urls.includes("/projects/maze-robot"), "page: false projects are not in the sitemap");
  assert.ok(!urls.includes("/contact/thank-you"));
  assert.ok(!urls.some((u) => u.startsWith("/tools")), "tools are switched off");
  // and every listed url really works
  for (const path of urls) await request(ctx.app).get(path).expect(200);
});

test("llms.txt is plain markdown about the site and doesnt invent a startup name", async () => {
  const res = await request(ctx.app).get("/llms.txt").expect(200);
  assert.match(res.text, /^# Reece Barker/);
  assert.match(res.text, /does not have a public name/);
  assert.ok(!res.text.includes("—"));
});

test("feed, manifest, security.txt and tdmrep", async () => {
  const feed = await request(ctx.app).get("/writing/feed.xml").expect(200).expect("Content-Type", /atom/);
  assert.match(feed.text, /<feed xmlns="http:\/\/www.w3.org\/2005\/Atom"/);
  const manifest = await request(ctx.app).get("/site.webmanifest").expect(200);
  assert.equal(JSON.parse(manifest.text).short_name, "Reece");
  const security = await request(ctx.app).get("/.well-known/security.txt").expect(200);
  assert.match(security.text, /^Contact: mailto:me@reece\.page/m);
  const expires = new Date(/^Expires: (.+)$/m.exec(security.text)[1]);
  assert.ok(expires > new Date());
  const tdm = await request(ctx.app).get("/.well-known/tdmrep.json").expect(200).expect("Content-Type", /json/);
  assert.deepEqual(JSON.parse(tdm.text), [{ location: "/*", "tdm-reservation": 1 }]);
  const home = await request(ctx.app).get("/");
  assert.match(home.text, /<meta name="tdm-reservation" content="1">/);
});

test("health checks", async () => {
  const live = await request(ctx.app).get("/health").expect(200);
  assert.equal(live.body.status, "ok");
  const ready = await request(ctx.app).get("/health/ready").expect(200);
  assert.equal(ready.body.status, "ok");
  assert.match(ready.headers["cache-control"], /no-store/);
});

test("readiness fails when the database is gone", async () => {
  const broken = await buildTestApp();
  await broken.database.close();
  const res = await request(broken.app).get("/health/ready").expect(503);
  assert.notEqual(res.body.status, "ok");
  // and the response never leaks the error text
  assert.ok(!JSON.stringify(res.body).toLowerCase().includes("sqlite"));
});

test("readiness without a database at all is fine", async () => {
  const none = await buildTestApp({ withDatabase: false });
  await request(none.app).get("/health/ready").expect(200);
});
