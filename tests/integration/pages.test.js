// Every public page through the real app: status codes, the head tags, structured data and the house rules
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import { buildTestApp, testConfig } from "../helpers/app.js";

let ctx;
before(async () => { ctx = await buildTestApp(); });
after(async () => { await ctx.close(); });

const PAGES = ["/", "/about", "/projects", "/projects?branch=earth", "/projects/microclimate-startup", "/projects/reece-page",
  "/writing", "/contact", "/impressum", "/privacy", "/terms", "/cookies", "/accessibility", "/copyright"];

for (const path of PAGES) {
  test(`${path} renders with complete metadata`, async () => {
    const res = await request(ctx.app).get(path).expect(200).expect("Content-Type", /html/);
    const html = res.text;
    assert.match(html, /<html lang="en-GB"/);
    assert.equal((html.match(/<h1[\s>]/g) || []).length, 1, "exactly one h1");
    assert.match(html, /<title>[^<]{5,70}<\/title>/);
    assert.match(html, /<meta name="description" content="[^"]{50,170}">/);
    assert.match(html, /<link rel="canonical" href="http:\/\/localhost:3000\//);
    assert.match(html, /<meta property="og:image" content="http/);
    assert.match(html, /<main id="main"/);
    assert.match(html, /href="#main"/, "skip link");
    // JSON-LD must parse
    const ld = /<script type="application\/ld\+json" nonce="[^"]+">(.*?)<\/script>/s.exec(html);
    assert.ok(ld, "has JSON-LD");
    const data = JSON.parse(ld[1]);
    assert.ok(Array.isArray(data["@graph"]));
    // House rule, and nothing from the dev machine leaking into a page
    assert.ok(!html.includes("—"), "no em dashes");
    assert.ok(!/undefined|\[object Object\]|NaN/.test(html.replace(/<script[\s\S]*?<\/script>/g, "")), "no template leaks");
  });
}

test("outside production everything is noindex", async () => {
  const res = await request(ctx.app).get("/").expect(200);
  assert.equal(res.headers["x-robots-tag"], "noindex, nofollow");
  assert.match(res.text, /<meta name="robots" content="noindex/);
});

test("project pages carry CreativeWork data and breadcrumbs", async () => {
  const res = await request(ctx.app).get("/projects/microclimate-startup").expect(200);
  assert.match(res.text, /"@type":"BreadcrumbList"/);
  assert.match(res.text, /CreativeWork/);
});

test("the home page has the Person and WebSite graph", async () => {
  const res = await request(ctx.app).get("/").expect(200);
  assert.match(res.text, /"@type":"Person"/);
  assert.match(res.text, /"@type":"WebSite"/);
  assert.match(res.text, /reecenbarker/);
});

test("unknown pages, listed-only projects and hidden features are 404s with the site's own page", async () => {
  for (const path of ["/nope", "/projects/maze-robot", "/projects/Not_A_Slug", "/tools", "/writing/missing"]) {
    const res = await request(ctx.app).get(path).expect(404);
    assert.match(res.text, /<h1/);
    assert.match(res.headers["cache-control"], /no-store/);
  }
});

test("404 answers JSON to clients that ask for it", async () => {
  const res = await request(ctx.app).get("/nope").set("Accept", "application/json").expect(404);
  assert.equal(res.body.status, 404);
  assert.ok(res.body.error);
});

test("trailing slashes and old addresses redirect permanently, and never off site", async () => {
  await request(ctx.app).get("/projects/").expect(301).expect("Location", "/projects");
  await request(ctx.app).get("/work").expect(301).expect("Location", "/projects");
  await request(ctx.app).get("/legal/privacy").expect(301).expect("Location", "/privacy");
  // nginx turns /admin/media into /admin/media/, that has to land on the library and not bounce back
  await request(ctx.app).get("/admin/media/").expect(301).expect("Location", "/admin/library");
  await request(ctx.app).get("/admin/media").expect(301).expect("Location", "/admin/library");
  await request(ctx.app).get("/work/").expect(301).expect("Location", "/projects");
  const sneaky = await request(ctx.app).get("//evil.example/").expect(301);
  assert.equal(sneaky.headers.location, "/evil.example");
});

test("security headers are on every page", async () => {
  const res = await request(ctx.app).get("/about").expect(200);
  const csp = res.headers["content-security-policy"];
  assert.match(csp, /default-src 'self'/);
  assert.match(csp, /script-src 'self' 'nonce-[\w+/=-]+'/);
  assert.match(csp, /frame-ancestors 'none'/);
  assert.match(csp, /object-src 'none'/);
  assert.ok(!csp.includes("unsafe-inline"));
  assert.equal(res.headers["x-content-type-options"], "nosniff");
  assert.equal(res.headers["referrer-policy"], "strict-origin-when-cross-origin");
  assert.match(res.headers["permissions-policy"], /camera=\(\)/);
  assert.equal(res.headers["x-powered-by"], undefined);
  assert.equal(res.headers["strict-transport-security"], undefined, "no HSTS outside production");
});

test("the nonce is different on every request and matches the inline scripts", async () => {
  const a = await request(ctx.app).get("/");
  const b = await request(ctx.app).get("/");
  const nonce = (res) => /'nonce-([^']+)'/.exec(res.headers["content-security-policy"])[1];
  assert.notEqual(nonce(a), nonce(b));
  for (const match of a.text.matchAll(/<script(?![^>]*\bsrc=)([^>]*)>/g)) {
    // Handlebars writes = as &#x3D; inside attributes, the browser reads it back as =
    const found = /nonce="([^"]+)"/.exec(match[1]);
    assert.ok(found, "every inline script has a nonce");
    assert.equal(found[1].replace(/&#x3D;/g, "="), nonce(a));
  }
  assert.ok(!/\sstyle="/.test(a.text), "no inline style attributes, the CSP would block them");
});

test("pages that show no form set no cookies", async () => {
  const res = await request(ctx.app).get("/about").expect(200);
  assert.equal(res.headers["set-cookie"], undefined);
});

test("legal pages name the real providers, and the phone only comes from the environment", async () => {
  const privacy = await request(ctx.app).get("/privacy").expect(200);
  for (const name of ["Hetzner Online GmbH", "Proton AG", "Cloudflare, Inc."]) assert.ok(privacy.text.includes(name), name);
  const impressum = await request(ctx.app).get("/impressum").expect(200);
  assert.match(impressum.text, /Mergenthalerstr\. 13/);
  assert.match(impressum.text, /class="placeholder-value"/, "no LEGAL_PHONE in the test env, so a placeholder");
  const withPhone = await buildTestApp({ config: testConfig({ env: { LEGAL_PHONE: "+49 000 1234567" } }), withDatabase: false });
  const shown = await request(withPhone.app).get("/impressum").expect(200);
  assert.match(shown.text, /<a href="tel:\+490001234567">\+49 000 1234567<\/a>/);
});
