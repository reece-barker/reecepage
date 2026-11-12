// The german pages through the real app, adresses and the language menu and search engine tags and content and the contact form
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import { buildTestApp, testConfig, hiddenValue, cookieHeader } from "../helpers/app.js";

let ctx;
before(async () => { ctx = await buildTestApp(); });
after(async () => { await ctx.close(); });

const GERMAN_PAGES = ["/de", "/de/about", "/de/projects", "/de/projects?branch=earth", "/de/projects/microclimate-startup",
  "/de/projects/lego-bulldozer-production-line", "/de/projects/kino", "/de/writing", "/de/contact"];

for (const path of GERMAN_PAGES) {
  test(`${path} is a complete German page`, async () => {
    const html = (await request(ctx.app).get(path).expect(200).expect("Content-Type", /html/)).text;
    assert.match(html, /<html lang="de"/);
    assert.equal((html.match(/<h1[\s>]/g) || []).length, 1, "exactly one h1");
    const clean = path.split("?")[0];
    assert.match(html, new RegExp(`<link rel="canonical" href="http://localhost:3000${clean}"`));
    assert.match(html, /<meta property="og:locale" content="de_DE">/);
    // The other language is announced to search engines, both ways, with a default
    assert.match(html, /<link rel="alternate" hreflang="en-GB" href="http:\/\/localhost:3000\//);
    assert.match(html, /<link rel="alternate" hreflang="de" href="http:\/\/localhost:3000\/de/);
    assert.match(html, /<link rel="alternate" hreflang="x-default"/);
    // The menu is German and links to German pages
    assert.match(html, /<a class="site-nav__link" href="\/de\/projects"[^>]*>Projekte<\/a>/);
    assert.match(html, /<a class="site-nav__link" href="\/lebenslauf"[^>]*>Lebenslauf<\/a>/);
    assert.ok(!html.includes("—"), "no em dashes");
    assert.ok(!/undefined|\[object Object\]|NaN/.test(html.replace(/<script[\s\S]*?<\/script>/g, "")), "no template leaks");
    const ld = /<script type="application\/ld\+json" nonce="[^"]+">(.*?)<\/script>/s.exec(html);
    assert.ok(Array.isArray(JSON.parse(ld[1])["@graph"]));
  });
}

test("the language menu shows both languages, the current one marked, and works as plain links", async () => {
  const german = (await request(ctx.app).get("/de/projects/kino").expect(200)).text;
  assert.match(german, /<details class="language-menu/);
  assert.match(german, /<a class="language-menu__link" href="\/projects\/kino" lang="en" hreflang="en" ><span>English<\/span>/);
  assert.match(german, /<a class="language-menu__link" href="\/de\/projects\/kino" lang="de" hreflang="de" aria-current="true"><span>Deutsch<\/span>/);
  const english = (await request(ctx.app).get("/projects/kino").expect(200)).text;
  assert.match(english, /<html lang="en-GB"/);
  assert.match(english, /href="\/de\/projects\/kino" lang="de" hreflang="de" ><span>Deutsch<\/span>/);
  assert.match(english, /<link rel="alternate" hreflang="de" href="http:\/\/localhost:3000\/de\/projects\/kino">/);
});

test("switching language on the filtered projects list keeps the filter", async () => {
  const html = (await request(ctx.app).get("/de/projects?branch=earth").expect(200)).text;
  assert.match(html, /href="\/projects\?branch(=|&#x3D;)earth" lang="en"/);
});

test("pages that only exist in English send the German address back, the CV pair has its own", async () => {
  await request(ctx.app).get("/de/privacy").expect(302).expect("Location", "/privacy");
  await request(ctx.app).get("/de/impressum").expect(302).expect("Location", "/impressum");
  await request(ctx.app).get("/de/admin/login").expect(302).expect("Location", "/admin/login");
  await request(ctx.app).get("/de/cv").expect(302).expect("Location", "/lebenslauf");
  await request(ctx.app).get("/de/projects/").expect(301).expect("Location", "/de/projects");
  // Only the exact prefix counts
  await request(ctx.app).get("/design").expect(404);
  const legal = (await request(ctx.app).get("/privacy").expect(200)).text;
  assert.match(legal, /href="\/de" lang="de" hreflang="de"/, "the German option on an English only page goes to the German home page");
});

test("the German home page, project and about page use the German text", async () => {
  const home = (await request(ctx.app).get("/de").expect(200)).text;
  assert.match(home, /Meine Projekte ansehen/);
  assert.match(home, /Ausgewählte Projekte/);
  assert.match(home, /Aktuell/);
  assert.match(home, /href="\/de\/projects\/microclimate-startup"/);
  assert.ok(!home.includes("See my projects"));

  const project = (await request(ctx.app).get("/de/projects/lego-bulldozer-production-line").expect(200)).text;
  assert.match(project, /Eine Produktionslinie für einen LEGO-Bulldozer/);
  assert.match(project, /Auf einen Blick/);
  assert.match(project, /Mein Teil: das Transportsystem/);
  assert.match(project, /Verantwortlich für das Transportsystem zwischen den Stationen/);
  assert.match(project, /09\/2026 bis 02\/2027/);
  assert.ok(!project.includes("At a glance"));
  assert.ok(!/class="alert alert--note"[^>]*>[^<]*<svg[^>]*>.*?Dieses Projekt gibt es noch nicht auf Deutsch/s.test(project), "no missing translation note");

  const about = (await request(ctx.app).get("/de/about").expect(200)).text;
  assert.match(about, /<h1[^>]*>.*Über.*mich/s);
  assert.match(about, /Technische Informatik/);
  assert.match(about, /Werdegang/);
  assert.match(about, /id="menschen"/);
  assert.match(about, /href="#menschen"/);
  assert.match(about, /Seit 06\/2026/);
  assert.ok(!about.includes("Where it started"));
});

test("a project without a German version stays English and says so", async () => {
  const { content } = ctx.services;
  const project = content.getProject("kino");
  const saved = project.de;
  delete project.de;
  try {
    const html = (await request(ctx.app).get("/de/projects/kino").expect(200)).text;
    assert.match(html, /Dieses Projekt gibt es noch nicht auf Deutsch/);
    assert.match(html, /Kino, a streaming platform for my family/);
  } finally {
    project.de = saved;
  }
});

test("writing keeps its English text with a German frame and a note", async () => {
  const list = (await request(ctx.app).get("/de/writing").expect(200)).text;
  assert.match(list, /Meine Artikel schreibe ich auf Englisch/);
  assert.match(list, /<a href="\/de\/writing\/[a-z0-9-]+"[^>]* lang="en">/);
  const slug = /href="\/de\/writing\/([a-z0-9-]+)"/.exec(list)?.[1];
  assert.ok(slug, "an article is listed");
  const article = (await request(ctx.app).get(`/de/writing/${slug}`).expect(200)).text;
  assert.match(article, /<html lang="de"/);
  assert.match(article, /Min\. Lesezeit/);
  assert.match(article, /<h1 class="match-cut-title" lang="en">/);
});

test("a German 404 is German", async () => {
  const res = await request(ctx.app).get("/de/projects/gibt-es-nicht").expect(404);
  assert.match(res.text, /<html lang="de"/);
  assert.match(res.text, /Diese Seite gibt es nicht/);
  assert.match(res.text, /href="\/de\/projects"/);
});

test("the sitemap lists the German pages", async () => {
  const xml = (await request(ctx.app).get("/sitemap.xml").expect(200)).text;
  assert.match(xml, /<loc>http:\/\/localhost:3000\/de<\/loc>/);
  assert.match(xml, /<loc>http:\/\/localhost:3000\/de\/projects\/microclimate-startup<\/loc>/);
  assert.match(xml, /hreflang="de" href="http:\/\/localhost:3000\/de\/projects\/microclimate-startup"/);
  assert.ok(!xml.includes("/de/privacy"), "English only pages are not listed in German");
});

// The contact form in German
async function openForm(path) {
  const page = await request(ctx.app).get(path).expect(200);
  return { cookie: cookieHeader(page), csrf: hiddenValue(page.text, "_csrf"), token: hiddenValue(page.text, "form_token"), html: page.text };
}

test("the German contact form has German labels and topics, and sends the English topic", async () => {
  const form = await openForm("/de/contact");
  assert.match(form.html, /<label class="label" for="field-name">Ihr Name<\/label>/);
  assert.match(form.html, /<form class="form" method="post" action="\/de\/contact"/);
  assert.match(form.html, /<option value="An internship or a job" >Ein Praktikum oder eine Stelle<\/option>/);
  assert.match(form.html, /data-left="Noch \{count\} Zeichen"/);
});

test("mistakes in the German form come back in German, in the German page", async () => {
  const form = await openForm("/de/contact");
  const res = await request(ctx.app).post("/de/contact").set("Cookie", form.cookie).type("form")
    .send({ _csrf: form.csrf, form_token: form.token, website: "", name: "", email: "kein-mail", topic: "", message: "kurz" })
    .expect(422);
  assert.match(res.text, /<html lang="de"/);
  assert.match(res.text, /Bitte geben Sie Ihren Namen ein\./);
  assert.match(res.text, /Bitte geben Sie eine E-Mail-Adresse im Format name@beispiel\.de ein\./);
  assert.match(res.text, /Bitte schreiben Sie mindestens 10 Zeichen/);
  assert.match(res.text, /Bitte korrigieren Sie diese 4 Punkte/);
});

test("a good German message lands on the German thank you page", async () => {
  const form = await openForm("/de/contact");
  const res = await request(ctx.app).post("/de/contact").set("Cookie", form.cookie).type("form")
    .send({ _csrf: form.csrf, form_token: form.token, website: "", name: "Erika Mustermann", email: "erika@example.org", topic: "The startup", message: "Hallo Reece, ich habe Ihre Seite gesehen." })
    .expect(303);
  assert.equal(res.headers.location, "/de/contact/thank-you");
  const thanks = (await request(ctx.app).get("/de/contact/thank-you").expect(200)).text;
  assert.match(thanks, /Vielen Dank, Ihre Nachricht ist unterwegs/);
  assert.match(thanks, /<a href="mailto:me@reece\.page">me@reece\.page<\/a>/);
});

test("the cookie banner on a German page returns to the German page", async () => {
  const withBanner = await buildTestApp({ config: testConfig({ patch: { features: { analytics: true }, analytics: { provider: "plausible" } } }) });
  try {
    const html = (await request(withBanner.app).get("/de/about").expect(200)).text;
    assert.match(html, /Darf ich Ihren Besuch zählen\?/);
    assert.match(html, /name="return_to" value="\/de\/about"/);
  } finally { await withBanner.close(); }
});
