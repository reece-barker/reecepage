// Paperwork: money in cents, invoice sums, the business type rules and the Word file
import { test } from "node:test";
import assert from "node:assert/strict";
import { inflateRawSync } from "node:zlib";
import { formatMoney, ibanIsValid, parseMoney, parseQuantity } from "../../src/documents/format.js";
import { invoiceTotals } from "../../src/documents/invoice.js";
import { businessDetails, legalLines, missingRequired, senderName, taxLines } from "../../src/documents/business.js";
import { makeDocx } from "../../src/documents/docx.js";
import { KINDS } from "../../src/documents/index.js";
import { buildContract, writeOut } from "../../src/documents/contract.js";
import { TYPES, paySchedule, repaySchedule } from "../../src/documents/contract-templates.js";

test("amounts are read the German and the English way, always as whole cents", () => {
  assert.equal(parseMoney("12,50"), 1250);
  assert.equal(parseMoney("12.50"), 1250);
  assert.equal(parseMoney("1.234,56"), 123456);
  assert.equal(parseMoney("1,234.56"), 123456);
  assert.equal(parseMoney("1.000"), 100000);
  assert.equal(parseMoney("€ 99"), 9900);
  assert.equal(parseMoney("zwölf"), null);
  assert.equal(parseQuantity("2,5"), 2500);
  assert.equal(formatMoney(123456, "de"), "1.234,56 €");
  assert.equal(formatMoney(123456, "en", "GBP"), "£1,234.56");
});

test("invoice sums: VAT per rate over the net totals, rounded half away from zero", () => {
  const sums = invoiceTotals([
    { description: "Website", quantity: "12,5", price: "65", vat: "19" },
    { description: "Book", quantity: "1", price: "10,00", vat: "7" },
    { description: "", price: "" }
  ]);
  assert.equal(sums.net, 82250);
  assert.deepEqual(sums.rates.map((r) => [r.rate, r.net, r.vat]), [[1900, 81250, 15438], [700, 1000, 70]]);
  assert.equal(sums.total, 82250 + 15438 + 70);
  const small = invoiceTotals([{ description: "Website", quantity: "2", price: "100", vat: "19" }], { small: true });
  assert.equal(small.vat, 0);
  assert.equal(small.total, 20000);
  assert.deepEqual(invoiceTotals([{ description: "x", quantity: "a lot", price: "5" }]).bad, [1]);
});

test("the business type decides the name and what has to be printed", () => {
  const owner = { name: "Reece Norman Barker", street: "Teststr. 1", postcode: "81247", city: "München", email: "me@reece.page" };
  const privatePerson = businessDetails(null, owner);
  assert.equal(senderName(privatePerson), "Reece Norman Barker");
  assert.deepEqual(legalLines(privatePerson, "de"), []);
  assert.deepEqual(missingRequired(privatePerson, "invoice"), []);

  const gmbh = businessDetails({ entity: "de-gmbh", full_name: "Reece Barker", trading_name: "Cognitive Atmospherics", company: { seat: "Enschede" }, tax: { vat_id: "DE123456789" } }, owner);
  assert.equal(senderName(gmbh), "Cognitive Atmospherics GmbH");
  assert.deepEqual(legalLines(gmbh, "de"), ["Sitz: Enschede"]);
  assert.deepEqual(taxLines(gmbh, "en"), ["VAT number: DE123456789"]);
  assert.deepEqual(missingRequired(gmbh, "invoice"), ["register_court", "register_number", "directors"]);
  // The freelancer needs a tax number for invoices, never the personal Steuer-IdNr. (there is no field for it)
  assert.deepEqual(missingRequired(businessDetails({ entity: "de-freelance", full_name: "R B", street: "x", city: "y" }), "invoice"), ["tax_number"]);
});

test("IBANs are checked with their check digits", () => {
  assert.equal(ibanIsValid("DE89 3704 0044 0532 0130 00"), true);
  assert.equal(ibanIsValid("DE89 3704 0044 0532 0130 01"), false);
  assert.equal(ibanIsValid("not an iban"), false);
});

test("the Word file is a real zip with the text in it and nothing but bold for styling", () => {
  const buffer = makeDocx([{ text: "Sehr geehrte Damen und Herren," }, { text: "Betreff", bold: true }, { table: true, rows: [["a", "b"]] }], { lang: "de" });
  assert.equal(buffer.readUInt32LE(0), 0x04034b50);
  // Walk the local headers and inflate word/document.xml
  let offset = 0;
  let documentXml = "";
  while (buffer.readUInt32LE(offset) === 0x04034b50) {
    const size = buffer.readUInt32LE(offset + 18);
    const nameLength = buffer.readUInt16LE(offset + 26);
    const name = buffer.subarray(offset + 30, offset + 30 + nameLength).toString();
    const data = buffer.subarray(offset + 30 + nameLength, offset + 30 + nameLength + size);
    if (name === "word/document.xml") documentXml = inflateRawSync(data).toString();
    offset += 30 + nameLength + size;
  }
  assert.match(documentXml, /Sehr geehrte Damen und Herren,/);
  assert.match(documentXml, /<w:b\/>/);
  assert.doesNotMatch(documentXml, /w:pStyle|w:color/);
});

test("every kind draws without crashing from its own defaults", () => {
  const details = businessDetails(null, { name: "Reece Norman Barker" });
  for (const kind of Object.values(KINDS)) {
    const data = kind.defaults(details, "en", []);
    const out = kind.render(data, { details, accounts: [], number: "RP-X-2026-0001", logo: "" });
    assert.match(out.body, /RP-X-2026-0001/);
    assert.ok(kind.plain(data, { details, accounts: [], number: "RP-X-2026-0001" }).length > 3);
  }
});

/* ------------------------------------------------------------------ contracts */

test("a payment plan adds up to the cent, the last instalment takes the rest", () => {
  const plan = paySchedule({ total: "1.000,00", down: "100", n: 7, interval: "monthly", first: "2027-01-31" });
  assert.equal(plan.principal, 90000);
  assert.equal(plan.rows.reduce((sum, r) => sum + r.amt, 0), 90000);
  assert.equal(plan.rows.at(-1).amt, 90000 - Math.floor(90000 / 7) * 6);
  // 31 January plus a month is the end of February, not 3 March
  assert.equal(plan.rows[1].date, "2027-02-28");
  assert.equal(paySchedule({ total: "100", down: "200", n: 3 }).ok, false);
  const repay = repaySchedule({ total: "500", p1_n: 5, p1_amt: "30", p1_first: "2026-12-01", p2_amt: "15" });
  assert.equal(repay.rest, 35000);
  assert.equal(repay.rows2.length, Math.ceil(35000 / 1500));
  assert.equal(repay.rows2.reduce((sum, r) => sum + r.amt, 0), 35000);
  assert.equal(repay.p2first, "2027-05-01");
});

test("every contract type draws in every language and law without holes", () => {
  const accounts = [{ label: "Main", holder: "Reece Barker", iban: "DE89370400440532013000", default: true }];
  for (const entity of ["de-private", "de-gmbh", "uk-ltd", "nl-bv"]) {
    const details = businessDetails({ entity, full_name: "Reece Barker", street: "Teststr. 1", postcode: "81247", city: "München" });
    for (const type of TYPES) for (const lang of ["de", "en", "nl"]) for (const law of ["DE", "UK", "NL", "US"]) for (const role of type.roles) {
      const data = { ...KINDS.contract.defaults(details, lang, accounts, { type: type.id }), law, role: role.id };
      const { body } = KINDS.contract.render(data, { details, accounts, number: "RP-C-2026-0001" });
      assert.doesNotMatch(body, /undefined|NaN|\[object/, `${entity} ${type.id} ${lang} ${law} ${role.id}`);
      assert.match(body, /ct-sigs/);
    }
  }
});

test("the right law gets the right wording", () => {
  const details = businessDetails({ entity: "de-private", full_name: "Reece Barker", city: "München" });
  const draw = (law, lang, type = "service") => buildContract({ ...KINDS.contract.defaults(details, lang, [], { type }), law }, details).clauses.map((c) => [c.heading, ...c.paragraphs.map((p) => p.text)].join(" ")).join(" ");
  assert.match(draw("DE", "de"), /Recht der Bundesrepublik Deutschland/);
  assert.match(draw("DE", "de"), /Textform/);
  assert.match(draw("UK", "en"), /law of England and Wales/);
  assert.match(draw("NL", "nl"), /Nederlands recht/);
  // a sale under german law excludes the UN sales convention
  assert.match(draw("DE", "en", "sale"), /excluding the UN Convention/);
});

test("written out clauses come back as the same document and then stay as typed", () => {
  const details = businessDetails({ entity: "de-private", full_name: "Reece Barker", city: "München" });
  const data = { ...KINDS.contract.defaults(details, "en", [], { type: "payment" }), facts: { total: "600", n: 3, interval: "monthly", first: "2027-01-01" } };
  const auto = buildContract(data, details);
  const written = writeOut(data, details);
  const again = buildContract({ ...data, ...written }, details);
  assert.equal(again.written, true);
  assert.deepEqual(again.clauses.map((c) => c.heading), auto.clauses.map((c) => c.heading));
  assert.equal(again.schedule[0].after_clause, auto.schedule[0].after_clause);
  // the facts change, the typed text doesnt but the table does
  const changed = buildContract({ ...data, ...written, facts: { ...data.facts, total: "900" } }, details);
  assert.deepEqual(changed.clauses[1].paragraphs, again.clauses[1].paragraphs);
  assert.equal(changed.schedule[0].rows.at(-1)[2], "€900.00");
});

test("the Word file of a contract has the clauses and the schedule as a table", () => {
  const details = businessDetails({ entity: "de-private", full_name: "Reece Barker", city: "München" });
  const data = { ...KINDS.contract.defaults(details, "de", [], { type: "payment" }), facts: { total: "600", n: 3, interval: "monthly", first: "2027-01-01" } };
  const blocks = KINDS.contract.plain(data, { details });
  assert.ok(blocks.some((b) => b.table && b.rows.length === 5));
  assert.ok(blocks.some((b) => b.bold && /^\d+\. Schlussbestimmungen$/.test(b.text)));
  assert.ok(makeDocx(blocks, { lang: "de" }).length > 1000);
});
