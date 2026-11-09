// Paperwork from the outside: numbers are handed out in order and never twice, the form saves, the preview draws,
// the Word file downloads, private details never reach GitHub, and nothing works without a session
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import { buildTestApp, adminConfig, signIn } from "../helpers/app.js";
import { desiredFiles } from "../../src/services/github-sync.js";

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

test("without a session theres no paperwork", async () => {
  await request(ctx.app).get("/admin/paperwork").set("Accept", "text/html").expect(303);
  await request(ctx.app).get("/admin/paperwork/print/abc").expect(404);
});

test("an invoice gets the next number, saves, previews and downloads as Word", async () => {
  await post("/admin/lists/payment_accounts", { value: [{ label: "Main", holder: "Reece Norman Barker", bank: "Test Bank", iban: "DE89 3704 0044 0532 0130 00", default: true }] }).expect(200);
  const refused = await post("/admin/lists/payment_accounts", { value: [{ label: "Typo", holder: "R", iban: "DE89 3704 0044 0532 0130 01" }] }).expect(400);
  assert.match(JSON.stringify(refused.body.errors), /isnt a valid IBAN/);

  const year = new Date().getFullYear();
  const first = await form("/admin/paperwork/new/invoice").expect(303);
  const second = await form("/admin/paperwork/new/invoice").expect(303);
  const id = Number(first.headers.location.split("/").pop());
  const list = await get("/admin/paperwork").expect(200);
  assert.match(list.text, new RegExp(`RP-I-${year}-0001`));
  assert.match(list.text, new RegExp(`RP-I-${year}-0002`));
  assert.ok(second.headers.location.endsWith(String(id + 1)));

  const editor = await get(`/admin/paperwork/${id}`).expect(200);
  assert.match(editor.text, /data-preview-frame/);
  const value = { lang: "de", recipient: "Muster GmbH\nHauptstr. 1\n80331 München", date: "2026-11-09", service: "Oktober 2026", due_days: "14", currency: "EUR", items: [{ description: "Website", quantity: "12,5", price: "65", vat: "19" }], account: "Main" };
  await post(`/admin/paperwork/${id}`, { value }).expect(200);

  const preview = await post("/admin/paperwork/preview", { id, value }).expect(200);
  const page = await get(preview.body.url).expect(200);
  assert.match(page.text, /966,88 €/);
  assert.match(page.text, /DE89 3704 0044 0532 0130 00/);
  assert.match(page.headers["content-security-policy"], /frame-ancestors 'self'/);

  const word = await get(`/admin/paperwork/${id}/docx`).expect(200);
  assert.match(word.headers["content-disposition"], new RegExp(`RP-I-${year}-0001-website\\.docx`));
  assert.match(word.headers["content-type"], /wordprocessingml/);
  assert.ok(Number(word.headers["content-length"]) > 1000);

  // Marked as sent, then binned: the number stays taken, the next one is 0003
  await form(`/admin/paperwork/${id}/status`, { status: "final" }).expect(303);
  await form(`/admin/paperwork/${id}/status`, { status: "trash" }).expect(303);
  const third = await form("/admin/paperwork/new/invoice").expect(303);
  const thirdPage = await get(third.headers.location).expect(200);
  assert.match(thirdPage.text, new RegExp(`RP-I-${year}-0003`));
});

test("a letter has its own numbers and a copy gets a new one", async () => {
  const year = new Date().getFullYear();
  const made = await form("/admin/paperwork/new/letter").expect(303);
  const id = Number(made.headers.location.split("/").pop());
  await post(`/admin/paperwork/${id}`, { value: { lang: "de", recipient: "Hausverwaltung\nWeg 1\n48599 Gronau", date: "2026-11-09", subject: "Kündigung", body: "hiermit kündige ich." } }).expect(200);
  const copy = await form(`/admin/paperwork/${id}/duplicate`).expect(303);
  const copyPage = await get(copy.headers.location).expect(200);
  assert.match(copyPage.text, new RegExp(`RP-L-${year}-0002`));
  assert.match(copyPage.text, /Kündigung/);
});

test("a contract keeps its type, follows the facts and its clauses can be written out and edited", async () => {
  const year = new Date().getFullYear();
  await form("/admin/paperwork/new/contract", { type: "nonsense" }).expect(404);
  const made = await form("/admin/paperwork/new/contract", { type: "payment" }).expect(303);
  const id = Number(made.headers.location.split("/").pop());
  const editor = await get(`/admin/paperwork/${id}`).expect(200);
  assert.match(editor.text, new RegExp(`RP-C-${year}-0001`));
  assert.match(editor.text, /data-write-out/);
  assert.match(editor.text, /not legal advice/);

  // the form trys to change the type, it stays a payment plan
  const value = { lang: "de", type: "nda", role: "creditor", law: "DE", currency: "EUR", other: { kind: "consumer", name: "Max Mustermann", street: "Musterweg 5", postcode: "80331", city: "München" }, facts: { debt_desc: "Webentwicklung", total: "1.250,00", n: "3", interval: "monthly", first: "2026-12-01", method: "transfer" }, account: "Main" };
  const saved = await post(`/admin/paperwork/${id}`, { value }).expect(200);
  assert.equal(saved.body.doc.title, "Ratenzahlungsvereinbarung");
  assert.match((await get(`/admin/paperwork/${id}`).expect(200)).text, /&quot;type&quot;:&quot;payment&quot;|"type":"payment"/);

  const preview = await post("/admin/paperwork/preview", { id, value }).expect(200);
  const page = await get(preview.body.url).expect(200);
  assert.match(page.text, /416,66\u00a0€|416,66 €/);
  assert.match(page.text, /416,68/);
  assert.match(page.text, /DE89 3704 0044 0532 0130 00/);
  assert.match(page.text, /Notes for you, not printed/);

  // written out, edited, then the facts change: the edited text stays, the schedule still follows the facts
  const out = await post(`/admin/paperwork/${id}/write-out`, { value }).expect(200);
  const clauses = out.body.value.clauses;
  assert.ok(clauses.length >= 6);
  assert.equal(clauses.at(-1).heading, "Schlussbestimmungen");
  assert.ok(clauses.some((c) => c.schedule));
  clauses[0].text = "Ein eigener Satz, den ich geschrieben habe.";
  clauses.push({ heading: "Eigene Klausel", text: "Noch etwas.\n- erstens\n- zweitens" });
  const edited = { ...out.body.value, clauses, facts: { ...value.facts, total: "900" } };
  await post(`/admin/paperwork/${id}`, { value: edited }).expect(200);
  const again = await post("/admin/paperwork/preview", { id, value: edited }).expect(200);
  const html = (await get(again.body.url).expect(200)).text;
  assert.match(html, /Ein eigener Satz, den ich geschrieben habe/);
  assert.match(html, /Eigene Klausel/);
  assert.match(html, /\(b\)<\/span><div>zweitens/);
  assert.match(html, /300,00/);

  const word = await get(`/admin/paperwork/${id}/docx`).expect(200);
  assert.match(word.headers["content-disposition"], new RegExp(`RP-C-${year}-0001-ratenzahlungsvereinbarung\\.docx`));
  await post("/admin/paperwork/999999/write-out", { value }).expect(404);
});

test("my details and payment accounts never go to GitHub", async () => {
  await post("/admin/lists/business", { value: { entity: "de-private", full_name: "Reece Norman Barker" } }).expect(200);
  const { entries, documents } = await ctx.services.contentRepository.readAll();
  const files = desiredFiles({ entries, documents });
  assert.ok(documents.payment_accounts && documents.business);
  assert.equal(files.has("content/data/payment_accounts.yml"), false);
  assert.equal(files.has("content/data/business.yml"), false);
});
