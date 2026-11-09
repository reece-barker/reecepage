// The contract wording, ported from the Contract Builder in the brand pack: payment plans, the repayment plan with
// direct payments to a third party, freelance projects, NDAs, the sale of a used item and outlines for a licence,
// contributor rights and anything custom. Every template is written per language (german, english, dutch) so it
// reads like it was written in that language not translated word for word, and per law where the law changes what
// you can write (liability, copyright, jurisdiction and so on).
//
// These are templates not legal advice, the admin says so next to the preview. Nothing here talks to Claude or
// anything else, its all plain functions from the facts to the clauses so the same facts always give the same text.
//
// The shape a template returns: { title, recitals: [{ text }], clauses: [{ heading, paragraphs: [{ text, items?,
// card? }] }], schedule: [{ label, after_clause, columns, rows }] | null, notes: [strings for the owner], cisg? }

/* ================================================================== money and dates, money is always whole cents */
// Reads 1.234,50 or 1,234.50 or 1234 and gives cents back, null when its empty and NaN when its not a number
export function parseMoney(v) {
  let s = String(v == null ? "" : v).trim().replace(/€|£|\$|EUR|GBP|USD|\s/gi, ""); if (!s) return null;
  if (!/^[\d.,']+$/.test(s)) return NaN;
  s = s.replace(/'/g, "");
  const lc = s.lastIndexOf(","), ld = s.lastIndexOf(".");
  let dec = -1;
  if (lc > -1 && ld > -1) dec = Math.max(lc, ld);
  else if (lc > -1) dec = s.length - lc - 1 <= 2 ? lc : -1;
  else if (ld > -1) dec = s.length - ld - 1 <= 2 && s.split(".").length === 2 ? ld : -1;
  const ip = (dec > -1 ? s.slice(0, dec) : s).replace(/[.,]/g, ""), fp = ((dec > -1 ? s.slice(dec + 1) : "") + "00").slice(0, 2);
  if (!/^\d*$/.test(ip) || !/^\d{2}$/.test(fp)) return NaN;
  return parseInt(ip || "0", 10) * 100 + parseInt(fp, 10);
}
export function fmtCents(c, lang, cur) {
  if (c == null || Number.isNaN(c)) return ph_("amount", lang);
  const ip = Math.floor(Math.abs(c) / 100), fp = String(Math.abs(c) % 100).padStart(2, "0");
  const num = (c < 0 ? "-" : "") + String(ip).replace(/\B(?=(\d{3})+(?!\d))/g, lang === "en" ? "," : ".") + (lang === "en" ? "." : ",") + fp;
  const sym = {EUR: "€", GBP: "£", USD: "$"}[cur] || cur;
  return lang === "de" ? `${num}\u00a0${sym}` : lang === "nl" ? `${sym}\u00a0${num}` : `${sym}${num}`;
}
export function fmtDate(iso, lang) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || "")); if (!m) return ph_("date", lang);
  const d = +m[3], mo = L[lang].months[+m[2] - 1];
  return lang === "de" ? `${d}. ${mo} ${m[1]}` : `${d} ${mo} ${m[1]}`;
}
// Adds months and keeps the day, or the last day of a shorter month (31 January plus one month is 28 or 29 February)
export function addMonths(iso, k) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || ""); if (!m) return "";
  const y = +m[1], mo = +m[2] - 1 + k, d = +m[3]; const ny = y + Math.floor(mo / 12), nm = ((mo % 12) + 12) % 12;
  const last = new Date(Date.UTC(ny, nm + 1, 0)).getUTCDate();
  return `${ny}-${String(nm + 1).padStart(2, "0")}-${String(Math.min(d, last)).padStart(2, "0")}`;
}
function addDays(iso, n) { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || ""); if (!m) return ""; const dt = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3] + n)); return dt.toISOString().slice(0, 10); }
export function firstOfNextMonth(now = new Date()) { const y = now.getMonth() === 11 ? now.getFullYear() + 1 : now.getFullYear(); const m = (now.getMonth() + 1) % 12 + 1; return `${y}-${String(m).padStart(2, "0")}-01`; }
export const cap = s => s ? s[0].toUpperCase() + s.slice(1) : s;
// The payment plan maths, all integer cents, the last instalment takes the rounding rest so the sum is always exact
export function paySchedule(f) {
  const total = parseMoney(f.total), down = parseMoney(f.down) || 0;
  const n = Math.min(60, Math.max(2, Math.round(+f.n || 3)));
  const ok = total != null && !Number.isNaN(total) && total > 0 && !Number.isNaN(down) && down < total;
  const principal = ok ? total - down : NaN;
  const base = ok ? Math.floor(principal / n) : NaN;
  const rows = Array.from({length: n}, (_, k) => ({date: f.first ? (f.interval === "weekly" ? addDays(f.first, 7 * k) : addMonths(f.first, (f.interval === "quarterly" ? 3 : 1) * k)) : "", amt: ok ? (k === n - 1 ? principal - base * (n - 1) : base) : NaN}));
  return {total: ok ? total : NaN, down: ok ? down : 0, principal, n, rows, ok};
}

/* ================================================================== words printed on the document */
const L = {
  de: {name: "Deutsch", between: "zwischen", and: "und", as: r => `(nachfolgend „${r}“)`, background: "Präambel", place: "Ort, Datum", sign: "Unterschrift",
    page: (n, t) => `Seite ${n} von ${t}`, months: ["Januar", "Februar", "März", "April", "Mai", "Juni", "Juli", "August", "September", "Oktober", "November", "Dezember"],
    countries: {DE: "Deutschland", UK: "Vereinigtes Königreich", NL: "Niederlande", US: "USA"}, tradingAs: "handelnd unter", owner: "Inhaber", rep: "vertreten durch", dirs: "Geschäftsführung", director: "Geschäftsführung",
    regDE: (c, n) => `eingetragen im Handelsregister des Amtsgerichts ${c} unter ${n}`, regUK: (p, n) => `Gesellschaft eingetragen in ${p} unter der Nummer ${n}`, regoff: "eingetragener Sitz", kvk: "KvK-Nr.", seatNL: s => `mit Sitz in ${s}`, llc: s => `gegründet im Bundesstaat ${s}`,
    version: "Deutsche Fassung", translation: "Übersetzung"},
  en: {name: "English", between: "between", and: "and", as: r => `(the “${r}”)`, background: "Background", place: "Place, date", sign: "Signature",
    page: (n, t) => `Page ${n} of ${t}`, months: ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"],
    countries: {DE: "Germany", UK: "United Kingdom", NL: "Netherlands", US: "United States"}, tradingAs: "trading as", owner: "owner", rep: "represented by", dirs: "managing director", director: "director",
    regDE: (c, n) => `registered in the commercial register of the local court (Amtsgericht) ${c} under ${n}`, regUK: (p, n) => `a company registered in ${p} under number ${n}`, regoff: "registered office", kvk: "KvK no.", seatNL: s => `having its seat in ${s}`, llc: s => `organised in the State of ${s}`,
    version: "English version", translation: "Translation"},
  nl: {name: "Nederlands", between: "tussen", and: "en", as: r => `(hierna: “${r}”)`, background: "Overwegingen", place: "Plaats, datum", sign: "Handtekening",
    page: (n, t) => `Pagina ${n} van ${t}`, months: ["januari", "februari", "maart", "april", "mei", "juni", "juli", "augustus", "september", "oktober", "november", "december"],
    countries: {DE: "Duitsland", UK: "Verenigd Koninkrijk", NL: "Nederland", US: "Verenigde Staten"}, tradingAs: "handelend onder de naam", owner: "eigenaar", rep: "vertegenwoordigd door", dirs: "bestuurder", director: "bestuurder",
    regDE: (c, n) => `ingeschreven in het handelsregister van het Amtsgericht ${c} onder ${n}`, regUK: (p, n) => `een vennootschap ingeschreven in ${p} onder nummer ${n}`, regoff: "statutair adres", kvk: "KvK-nummer", seatNL: s => `statutair gevestigd te ${s}`, llc: s => `opgericht in de staat ${s}`,
    version: "Nederlandse versie", translation: "Vertaling"}
};
const LANG_ADJ = {de: {de: "deutsche", en: "englische", nl: "niederländische"}, en: {de: "German", en: "English", nl: "Dutch"}, nl: {de: "Duitse", en: "Engelse", nl: "Nederlandse"}};
const UK_PART = {"England and Wales": {de: "England und Wales", nl: "Engeland en Wales"}, "Scotland": {de: "Schottland", nl: "Schotland"}, "Northern Ireland": {de: "Nordirland", nl: "Noord-Ierland"}};
// Placeholders in the document language, so a german contract never says [amount]
const PH = {
  name: {de: "[Name]", en: "[name]", nl: "[naam]"}, street: {de: "[Straße und Hausnummer]", en: "[street and number]", nl: "[straat en huisnummer]"},
  pcity: {de: "[PLZ Ort]", en: "[postcode and city]", nl: "[postcode en plaats]"}, city: {de: "[Ort]", en: "[city]", nl: "[plaats]"},
  date: {de: "[Datum]", en: "[date]", nl: "[datum]"}, amount: {de: "[Betrag]", en: "[amount]", nl: "[bedrag]"},
  company: {de: "[Firmenname]", en: "[company name]", nl: "[bedrijfsnaam]"}, court: {de: "[Amtsgericht]", en: "[local court]", nl: "[Amtsgericht]"},
  regno: {de: "[HRB-Nummer]", en: "[HRB number]", nl: "[HRB-nummer]"}, compno: {de: "[Gesellschaftsnummer]", en: "[company number]", nl: "[registratienummer]"},
  kvk: {de: "[KvK-Nummer]", en: "[KvK number]", nl: "[KvK-nummer]"}, dirs: {de: "[Vorname Nachname]", en: "[first name last name]", nl: "[voornaam achternaam]"},
  state: {de: "[Bundesstaat]", en: "[state]", nl: "[staat]"}, iban: {de: "[IBAN]", en: "[IBAN]", nl: "[IBAN]"}, bic: {de: "[BIC]", en: "[BIC]", nl: "[BIC]"},
  bank: {de: "[Bank]", en: "[bank]", nl: "[bank]"}, holder: {de: "[Kontoinhaber]", en: "[account holder]", nl: "[rekeninghouder]"}
};
const ph_ = (k, lang) => PH[k][lang];

/* ================================================================== contract types, the facts each one asks for and the outline of its clauses */
// Role names, used as defined terms in the text. Capitalised in every language so they read as names
const ROLE = {
  creditor: {de: "Gläubiger", en: "Creditor", nl: "Schuldeiser"}, debtor: {de: "Schuldner", en: "Debtor", nl: "Schuldenaar"},
  contractor: {de: "Auftragnehmer", en: "Contractor", nl: "Opdrachtnemer"}, client: {de: "Auftraggeber", en: "Client", nl: "Opdrachtgever"},
  partyA: {de: "Partei A", en: "Party A", nl: "Partij A"}, partyB: {de: "Partei B", en: "Party B", nl: "Partij B"},
  discloser: {de: "Offenlegende Partei", en: "Disclosing Party", nl: "Verstrekkende Partij"}, recipient: {de: "Empfangende Partei", en: "Receiving Party", nl: "Ontvangende Partij"},
  licensor: {de: "Lizenzgeber", en: "Licensor", nl: "Licentiegever"}, licensee: {de: "Lizenznehmer", en: "Licensee", nl: "Licentienemer"},
  brand: {de: "Auftraggeber", en: "Client", nl: "Opdrachtgever"}, author: {de: "Urheber", en: "Contributor", nl: "Maker"},
  seller: {de: "Verkäufer", en: "Seller", nl: "Verkoper"}, buyer: {de: "Käufer", en: "Buyer", nl: "Koper"},
  p1: {de: "Partei 1", en: "Party 1", nl: "Partij 1"}, p2: {de: "Partei 2", en: "Party 2", nl: "Partij 2"}
};
const MONEY_F = (k, label, hint) => ({k, label, kind: "money", hint});
const TYPES = [
  {id: "payment", label: "Payment plan", hint: "Instalment agreement for money that is owed.", full: true,
    roles: [{id: "creditor", label: "I am owed the money", me: "creditor", other: "debtor"}, {id: "debtor", label: "I owe the money", me: "debtor", other: "creditor"}],
    facts: [
      {k: "debt_desc", label: "What the money is for", kind: "text", ph: "Web development, September 2026"},
      {row: [{k: "invoice_no", label: "Invoice no. (optional)", kind: "text"}, {k: "invoice_date", label: "Invoice date", kind: "date"}]},
      {row: [MONEY_F("total", "Total owed"), {k: "n", label: "Instalments", kind: "number", min: 2, max: 60, def: 3}]},
      {row: [{k: "interval", label: "Every", kind: "select", opts: [["monthly", "Month"], ["weekly", "Week"], ["quarterly", "Quarter"]], def: "monthly"}, {k: "first", label: "First instalment due", kind: "date", def: "firstOfNextMonth"}]},
      {row: [MONEY_F("down", "Down payment (optional)"), {k: "down_date", label: "Down payment due", kind: "date"}]},
      {k: "method", label: "Payment by", kind: "select", opts: [["transfer", "Bank transfer"], ["debit", "SEPA direct debit"]], def: "transfer"},
      {k: "bankinfo", kind: "note", text: "Bank details for transfers come from the payment account you pick (or the other party's bank, when they are owed the money)."}
    ],
    skeleton: [["Acknowledgement of the debt", "the debtor confirms the amount and what it is for; declaratory only, no new independent obligation"],
      ["Payment in instalments", "number, interval and first due date; the payment schedule table goes right after this clause; when a payment counts as made; payment method and account"],
      ["Early payment", "allowed at any time, free of charge"],
      ["No interest and no fees", "the plan is free; if the owner explicitly wants costs and the debtor is a business, state them here instead"],
      ["Late payment", "what happens when two instalments in a row are missed: final deadline in text form, then the whole rest becomes due; statutory default interest stays"],
      ["Relation to the original debt", "only the way of paying changes; the debt is settled once all instalments are paid"],
      ["Final provisions", "as in the house structure"]]},
  {id: "repay", label: "Repayment plan with direct payments", hint: "Money you paid for someone. First they pay a third party (for example the utility company) direct, then instalments to you.", full: true,
    roles: [{id: "creditor", label: "I paid and am owed the money", me: "creditor", other: "debtor"}, {id: "debtor", label: "I owe the money", me: "debtor", other: "creditor"}],
    facts: [
      {k: "debt_desc", label: "What the debt is for", kind: "textarea", ph: "her share of the electricity costs of the shared flat"},
      {k: "home", label: "Shared home (optional)", kind: "text", ph: "Mergenthalerstr. 13, 81247 München"},
      {row: [{k: "third", label: "Third party that was paid", kind: "text", def: "Stadtwerke München"}, {k: "cust_no", label: "Customer no. there (optional)", kind: "text"}]},
      {row: [{k: "debt_from", label: "Debt counted from", kind: "date"}, {k: "debt_to", label: "Until (optional)", kind: "date"}]},
      {k: "since", label: "No payments to the third party since (optional)", kind: "text", ph: "November 2025"},
      {row: [{k: "earlier_date", label: "Date of the signed commitment", kind: "date"}, {k: "earlier_amt", label: "Committed to pay per month", kind: "money"}]},
      {k: "total", label: "Total owed, including what is paid in step 1", kind: "money"},
      {k: "breakdown", label: "What the total is made of (optional), one per line", kind: "textarea", ph: "March 2026 | 30,00\nApril 2026 | 30,00", hint: "Printed as a list under the acknowledgement."},
      {kind: "note", text: "Step 1: the debtor pays the third party direct. These payments count against the total."},
      {row: [{k: "p1_n", label: "Months", kind: "number", min: 0, max: 24, def: 5}, {k: "p1_amt", label: "Per month", kind: "money", def: "30,00"}]},
      {row: [{k: "p1_first", label: "First payment due", kind: "date", def: "firstOfNextMonth"}, {k: "proof_days", label: "Proof within days", kind: "number", min: 1, max: 30, def: 3}]},
      {kind: "note", text: "Step 2: instalments to you until the rest is paid. The last one is smaller if it does not divide evenly."},
      {row: [{k: "p2_amt", label: "Per month", kind: "money", def: "15,00"}, {k: "p2_first", label: "First instalment (empty = month after step 1)", kind: "date"}]},
      {k: "bankinfo2", kind: "note", text: "Bank details for step 2 come from the payment account you pick."}
    ],
    skeleton: [["Acknowledgement of the debt", "the debtor confirms the total and what it is for, with the period; optional list of what it is made of; declaratory only, no new independent obligation; the earlier signed commitment stays as proof"],
      ["Step 1: payments straight to the third party", "months, amount and first date; the payments reduce the debt by what the third party receives; proof within a few days; a payment that is not made or not proven does not reduce the debt and can be demanded from the debtor instead"],
      ["Step 2: instalments to the creditor", "what is left after step 1, monthly instalment, first date, number of instalments and the smaller last one; when a payment counts as made; account and reference; expected end date; the payment schedule table goes right after this clause"],
      ["Extra and early payments", "allowed at any time, free of charge, they shorten the plan"],
      ["No interest, no fees", "the plan is free; while the debtor keeps to it the creditor does not go to court"],
      ["Late payment", "two payments in a row missed in either step: final deadline of two weeks in text form with the warning, then the whole rest becomes due and the standstill ends; statutory default interest stays"],
      ["Moving out and contact", "the debtor reports a move or new contact details within 14 days; the agreement stays in force"],
      ["Relation to the original claim and final settlement", "only the way of paying changes, no claim is waived; the creditor confirms in text form when everything is paid"],
      ["Final provisions", "as in the house structure"]]},
  {id: "service", label: "Freelance project or service", hint: "Scope, deliverables, fee, milestones, acceptance, rights of use, confidentiality, liability.", full: true,
    roles: [{id: "contractor", label: "I do the work", me: "contractor", other: "client"}, {id: "client", label: "I hire someone", me: "client", other: "contractor"}],
    facts: [
      {k: "project", label: "Project name", kind: "text", ph: "Website for the Bakery Example"},
      {k: "scope", label: "What will be done", kind: "textarea", ph: "Design and build a five page website with a contact form."},
      {k: "deliverables", label: "Deliverables, one per line", kind: "textarea", ph: "Design for desktop and mobile\nFinished website on the client's hosting\nShort handover guide"},
      {row: [{k: "start", label: "Start", kind: "date"}, {k: "end", label: "Planned completion", kind: "date"}]},
      {k: "milestones", label: "Milestones (optional), one per line", kind: "textarea", ph: "2026-11-15 | Design approved | 600\n2026-12-15 | Website live | 900", hint: "Date | what | amount. Each part is optional."},
      {row: [{k: "fee_type", label: "Fee", kind: "select", opts: [["fixed", "Fixed price"], ["hourly", "Per hour"], ["daily", "Per day"]], def: "fixed"}, MONEY_F("fee", "Amount")]},
      {row: [MONEY_F("cap", "Cap for hourly or daily (optional)"), {k: "vat", label: "VAT", kind: "select", opts: [["small", "None (small business)"], ["plus", "Plus VAT"], ["incl", "VAT included"]], def: "small"}]},
      {row: [{k: "pay_days", label: "Invoices due within days", kind: "number", min: 0, max: 90, def: 14}, {k: "accept_days", label: "Days to check results", kind: "number", min: 1, max: 60, def: 14}]},
      {k: "rights", label: "Rights in the results", kind: "select", opts: [["use", "Rights of use, the maker keeps the copyright"], ["assign", "Transfer the copyright (not possible under German law)"]], def: "use"},
      {k: "exclusive", label: "Exclusive for the client", kind: "check", def: true},
      {k: "uses", label: "Types of use (optional), one per line", kind: "textarea", hint: "Leave empty for the standard list: print and digital copies, online and social media, adapting, advertising."},
      {k: "portfolio", label: "Maker may show the work in a portfolio", kind: "check", def: true},
      {k: "credit", label: "Maker is named as the author", kind: "check", def: false}
    ],
    skeleton: [["Subject and scope", "what is done, the deliverables as a list, anything not listed is not owed, extra work is agreed separately"],
      ["Way of working and cooperation", "independent work, no employment; what the client provides and that delays caused by missing cooperation move the dates; subcontractors"],
      ["Dates and milestones", "start, planned completion, milestones as a list if given"],
      ["Acceptance", "notice of completion, checking period, minor defects do not block acceptance, fixing defects, deemed acceptance (with the consumer rule under German law)"],
      ["Fee and payment", "fixed price or rate, cap, VAT sentence, when invoices are issued, payment term, expenses only with consent"],
      ["Rights in the results", "under German law: rights of use (§ 31 UrhG), exclusive or simple, unlimited or limited in time and territory, the listed types of use, sublicensing for the client's own use, only after full payment; elsewhere: licence or written assignment as the facts say; third-party parts (fonts, images, open source) under their own licences; portfolio use; credit"],
      ["Confidentiality", "both parties, use only for the project, continues after the end, the usual exceptions"],
      ["Liability", "as the law rules allow; mutual"],
      ["Term and termination", "ends with acceptance and payment, termination for good cause in text form, payment for work done if it ends early"],
      ["Final provisions", "as in the house structure"]]},
  {id: "nda", label: "Non-disclosure agreement", hint: "Mutual or one way, purpose, duration, exceptions.", full: true,
    roles: [{id: "mutual", label: "Both sides share information", me: "partyA", other: "partyB"}, {id: "disclose", label: "I share, they keep it secret", me: "discloser", other: "recipient"}, {id: "receive", label: "They share, I keep it secret", me: "recipient", other: "discloser"}],
    facts: [
      {k: "purpose", label: "What the talks are about", kind: "text", ph: "a possible joint web project"},
      {k: "years", label: "Confidentiality lasts years after the last disclosure", kind: "number", min: 1, max: 20, def: 3}
    ],
    skeleton: [["Purpose", "what the parties talk about and that confidential information is shared for it"],
      ["Confidential information", "definition with typical examples as a list; in a mutual NDA who counts as receiving and disclosing party; the exceptions as a list (public, known before, received lawfully from third parties, developed independently)"],
      ["Duties of the receiving party", "keep secret, use only for the purpose, reasonable care, need-to-know people bound to confidentiality, disclosure required by law only after telling the other side where allowed"],
      ["Return and deletion", "on request, confirmation in text form, statutory retention and backups excepted"],
      ["No rights, no obligation", "no licence, no duty to disclose or to sign a further contract"],
      ["Term", "from signature, duties end the given number of years after the last disclosure, trade secrets as long as they stay secret"],
      ["Final provisions", "as in the house structure"]]},
  {id: "licence", label: "Brand or logo licence", hint: "Let someone use your brand or logo, or use theirs.", full: false,
    roles: [{id: "licensor", label: "I let them use my brand", me: "licensor", other: "licensee"}, {id: "licensee", label: "I may use their brand", me: "licensee", other: "licensor"}],
    facts: [
      {k: "subject", label: "What is licensed", kind: "text", ph: "the reece dove logo and the wordmark reece"},
      {k: "purpose", label: "For what use", kind: "text", ph: "on the website and flyers of a joint event"},
      {row: [{k: "territory", label: "Territory", kind: "text", ph: "Germany"}, {k: "exclusive", label: "Exclusive", kind: "check", def: false}]},
      {row: [{k: "start", label: "From", kind: "date"}, {k: "end", label: "Until (empty = open ended)", kind: "date"}]},
      MONEY_F("fee", "Licence fee (empty = free)")
    ],
    skeleton: [["Licensed marks and materials", "what exactly is licensed, by reference to the brand files"],
      ["Grant of the licence", "simple or exclusive, purpose, territory, term, no sublicences unless agreed"],
      ["Brand guidelines and quality", "use only as in the brand guidelines, no changes to the logo, approval of samples"],
      ["Fee", "amount and due date, or free of charge"],
      ["Ownership and protection", "the marks stay with the licensor, no own registrations, tell the licensor about infringements"],
      ["Term and termination", "start, end or notice period, termination for good cause"],
      ["After the licence ends", "stop using, use up or destroy existing material within a short period"],
      ["Liability", "as the law rules allow"],
      ["Final provisions", "as in the house structure"]]},
  {id: "contributor", label: "Designer or contributor rights", hint: "Get the rights to a logo, design, text or code someone made for you.", full: false,
    roles: [{id: "brand", label: "I commission the work", me: "brand", other: "author"}, {id: "author", label: "I made the work", me: "author", other: "brand"}],
    facts: [
      {k: "work", label: "The work", kind: "textarea", ph: "The dove logo for reece in all variants and colours, as delivered on 1 September 2026"},
      {row: [MONEY_F("fee", "Fee"), {k: "due", label: "Fee due", kind: "date"}]},
      {k: "credit", label: "The maker is named as the author", kind: "check", def: false}
    ],
    skeleton: [["The work", "what was or will be made, delivery"],
      ["Fee", "amount, due date; the fee covers all rights granted"],
      ["Rights in the work", "under German law: exclusive rights of use (§§ 29, 31 UrhG) unlimited in time and territory, every type of use listed, including adapting, registering as a trademark or design and sublicensing; under UK or US law: a written assignment of copyright plus a waiver of moral rights; under Dutch law: transfer by this deed (art. 2 Auteurswet)"],
      ["Credit and moral rights", "whether the maker is named; under German law the right to be named cannot be waived completely"],
      ["Assurances by the maker", "own original work, no rights of third parties, third-party parts listed"],
      ["Portfolio use", "whether and how the maker may show the work"],
      ["Confidentiality", "until the work is published"],
      ["Liability", "as the law rules allow"],
      ["Final provisions", "as in the house structure"]]},
  {id: "sale", label: "Sale of a used item", hint: "Simple purchase agreement, for example a laptop or a bike.", full: true,
    roles: [{id: "seller", label: "I sell", me: "seller", other: "buyer"}, {id: "buyer", label: "I buy", me: "buyer", other: "seller"}],
    facts: [
      {k: "item", label: "Item", kind: "text", ph: "MacBook Air 13 inch, M2, 2022, 16 GB"},
      {row: [{k: "serial", label: "Serial or ID number", kind: "text"}, {k: "accessories", label: "Accessories", kind: "text", ph: "charger, sleeve"}]},
      {k: "defects", label: "Known defects and signs of use", kind: "textarea", ph: "Small dent on the lid, battery at 87 %. No other known defects."},
      {row: [MONEY_F("price", "Price"), {k: "pay", label: "Payment", kind: "select", opts: [["cash", "Cash on handover"], ["transfer", "Transfer before handover"]], def: "cash"}]},
      {row: [{k: "handover", label: "Handover date", kind: "date"}, {k: "place", label: "Handover place", kind: "text"}]}
    ],
    skeleton: [["The item", "item, serial number, accessories, known defects and signs of use"],
      ["Price and payment", "price, how and when it is paid"],
      ["Handover and ownership", "date and place, ownership passes on full payment, risk on handover"],
      ["Condition and defects", "private or business seller rules from the law rules"],
      ["Assurances by the seller", "owns the item, free of third-party rights"],
      ["Final provisions", "as in the house structure"]]},
  {id: "custom", label: "Custom", hint: "A blank outline with the parties and the final provisions, you write the clauses.", full: false,
    roles: [{id: "p1", label: "I am the first party", me: "p1", other: "p2"}, {id: "p2", label: "I am the second party", me: "p2", other: "p1"}],
    facts: [{k: "title", label: "Contract title (optional)", kind: "text"}],
    skeleton: [["Subject", "what the contract is about"], ["(the clauses the request needs)", "choose them from the owner's request"], ["Final provisions", "as in the house structure"]]}
];
const TYPE = id => TYPES.find(t => t.id === id) || TYPES.find(t => t.id === "service");
const PLAN_TYPES = ["payment", "repay"];
/* ================================================================== the templates
   Each one is written per language so it reads natural, not translated word for word. They take a context x
   (made in contract.js) with the parties, the law and the facts already formatted for that language */
const P_ = (text, items) => items && items.length ? {text, items} : {text};
// A paragraph followed by a little styled box of label and value rows, used for the bank account
const PCard = (text, rows) => rows && rows.length ? {text, card: rows} : {text};
const C_ = (heading, ...paragraphs) => ({heading, paragraphs: paragraphs.filter(Boolean).map(p => typeof p === "string" ? P_(p) : p)});
const pick = (lang, o) => o[lang];
const endDot = s => { s = String(s || "").trim(); return !s || /[.!?:)\]]$/.test(s) ? s : s + "."; };
const lines = s => String(s || "").split("\n").map(v => v.trim()).filter(Boolean);

// The text form phrase, german law has its own term for it, everywhere else its just writing with email allowed
function tf(x) {
  if (x.lang === "de") return x.law === "DE" ? "in Textform (zum Beispiel per E-Mail)" : "schriftlich (eine E-Mail genügt)";
  if (x.lang === "en") return x.law === "DE" ? "in text form (for example by email)" : "in writing (email is enough)";
  return "schriftelijk (bijvoorbeeld per e-mail)";
}

// Final provisions, the same for every type: entire agreement, changes, severability, law and courts, plus the language rule when bilingual
function finalClause(x, opts) {
  const lg = x.lang, c = x.city, cons = x.consumerAny;
  const part = pick(lg, {de: (UK_PART[x.ukPart] || {}).de || x.ukPart, en: x.ukPart, nl: (UK_PART[x.ukPart] || {}).nl || x.ukPart});
  const cisg = opts && opts.cisg && x.law === "DE";
  const LAW = {
    de: {DE: `Es gilt das Recht der Bundesrepublik Deutschland${cisg ? " unter Ausschluss des UN-Kaufrechts" : ""}.`, UK: `Es gilt das Recht von ${part}.`, NL: "Es gilt niederländisches Recht.", US: `Es gilt das Recht des Bundesstaates ${x.state}.`},
    en: {DE: `This agreement is governed by German law${cisg ? ", excluding the UN Convention on Contracts for the International Sale of Goods" : ""}.`, UK: `This agreement is governed by the law of ${part}.`, NL: "This agreement is governed by Dutch law.", US: `This agreement is governed by the law of the State of ${x.state}.`},
    nl: {DE: `Op deze overeenkomst is Duits recht van toepassing${cisg ? ", met uitsluiting van het Weens Koopverdrag" : ""}.`, UK: `Op deze overeenkomst is het recht van ${part} van toepassing.`, NL: "Op deze overeenkomst is Nederlands recht van toepassing.", US: `Op deze overeenkomst is het recht van de staat ${x.state} van toepassing.`}
  };
  const COURT = cons ? {de: "Für den Gerichtsstand gelten die gesetzlichen Regeln.", en: "The statutory rules on jurisdiction apply.", nl: "Voor de bevoegde rechter gelden de wettelijke regels."}[lg] : {
    de: {DE: `Sind beide Parteien Kaufleute, juristische Personen des öffentlichen Rechts oder öffentlich-rechtliche Sondervermögen, ist Gerichtsstand ${c}.`, UK: `Ausschließlich zuständig sind die Gerichte von ${part}.`, NL: `Zuständig ist das Gericht des Bezirks, in dem ${c} liegt.`, US: `Zuständig sind die Gerichte des Bundesstaates ${x.state}.`},
    en: {DE: `If both parties are merchants, legal entities under public law or special funds under public law, the courts of ${c} have jurisdiction.`, UK: `The courts of ${part} have exclusive jurisdiction.`, NL: `The court of the district in which ${c} lies has jurisdiction.`, US: `The courts of the State of ${x.state} have jurisdiction.`},
    nl: {DE: `Zijn beide partijen kooplieden, publiekrechtelijke rechtspersonen of publiekrechtelijke bijzondere vermogens, dan is de rechter in ${c} bevoegd.`, UK: `Uitsluitend bevoegd zijn de rechters van ${part}.`, NL: `Bevoegd is de rechtbank van het arrondissement waarin ${c} ligt.`, US: `Bevoegd zijn de rechters van de staat ${x.state}.`}
  }[lg][x.law];
  const RES = cons ? {de: " Ist eine Partei Verbraucher, behält sie den Schutz der zwingenden Vorschriften des Staates, in dem sie ihren gewöhnlichen Aufenthalt hat.", en: " If a party is a consumer, they keep the protection of the mandatory rules of the country where they normally live.", nl: " Is een partij consument, dan behoudt zij de bescherming van de dwingende regels van het land waar zij gewoonlijk woont."}[lg] : "";
  const changes = {de: x.law === "DE" ? "Änderungen und Ergänzungen dieses Vertrags bedürfen der Textform (zum Beispiel E-Mail)." : "Änderungen und Ergänzungen dieses Vertrags müssen schriftlich vereinbart werden. Eine E-Mail genügt.",
    en: x.law === "DE" ? "Changes and additions to this agreement must be made in text form (Textform, for example by email)." : "Changes and additions to this agreement must be made in writing. Email is enough.",
    nl: "Wijzigingen en aanvullingen van deze overeenkomst moeten schriftelijk worden vastgelegd. Een e-mail is voldoende."}[lg];
  const ps = [
    {de: "Dieser Vertrag enthält alle Vereinbarungen der Parteien zu seinem Gegenstand. Nebenabreden bestehen nicht.", en: "This agreement contains everything the parties have agreed on its subject. There are no side agreements.", nl: "Deze overeenkomst bevat alle afspraken van partijen over het onderwerp ervan. Er zijn geen nevenafspraken."}[lg],
    changes,
    {de: "Ist eine Bestimmung dieses Vertrags unwirksam, bleiben die übrigen Bestimmungen wirksam. An die Stelle der unwirksamen Bestimmung tritt die gesetzliche Regelung.", en: "If a provision of this agreement is invalid, the other provisions stay in force. The invalid provision is replaced by the rule that applies by law.", nl: "Is een bepaling van deze overeenkomst ongeldig, dan blijven de overige bepalingen van kracht. Voor de ongeldige bepaling geldt de wettelijke regeling."}[lg],
    `${LAW[lg][x.law]} ${COURT}${RES}`
  ];
  if (x.lang1 && x.lang2) {
    const a = LANG_ADJ[lg][x.lang1];
    ps.push({de: `Dieser Vertrag ist in zwei Sprachen abgefasst. Weichen die Fassungen voneinander ab, gilt die ${a} Fassung.`, en: `This agreement is written in two languages. If the versions differ, the ${a} version prevails.`, nl: `Deze overeenkomst is in twee talen opgesteld. Als de versies van elkaar afwijken, gaat de ${a} versie voor.`}[lg]);
  }
  return C_({de: "Schlussbestimmungen", en: "Final provisions", nl: "Slotbepalingen"}[lg], ...ps);
}

// Statutory interest sentence for late payment, it depends on the law and on whether a consumer is involved
function interestLine(x) {
  const cons = x.consumerAny;
  return {
    de: {DE: "Der Anspruch auf Verzugszinsen nach § 288 BGB bleibt unberührt.", UK: cons ? "Ansprüche auf gesetzliche Zinsen bei verspäteter Zahlung bleiben unberührt." : "Der Anspruch auf gesetzliche Zinsen nach dem Late Payment of Commercial Debts (Interest) Act 1998 bleibt unberührt.", NL: cons ? "Der Anspruch auf gesetzliche Zinsen nach Art. 6:119 BW bleibt unberührt." : "Der Anspruch auf gesetzliche Handelszinsen nach Art. 6:119a BW bleibt unberührt.", US: "Ansprüche auf Verzugszinsen nach dem anwendbaren Recht bleiben unberührt."},
    en: {DE: "The right to default interest under section 288 of the German Civil Code (BGB) is not affected.", UK: cons ? "Any right to statutory interest on late payment is not affected." : "The right to statutory interest under the Late Payment of Commercial Debts (Interest) Act 1998 is not affected.", NL: cons ? "The right to statutory interest under article 6:119 of the Dutch Civil Code is not affected." : "The right to statutory commercial interest under article 6:119a of the Dutch Civil Code is not affected.", US: "Any right to interest on late payment under applicable law is not affected."},
    nl: {DE: "Het recht op vertragingsrente op grond van § 288 van het Duitse Burgerlijk Wetboek (BGB) blijft onverminderd.", UK: cons ? "Een eventueel recht op wettelijke rente bij te late betaling blijft onverminderd." : "Het recht op wettelijke rente op grond van de Late Payment of Commercial Debts (Interest) Act 1998 blijft onverminderd.", NL: cons ? "Het recht op de wettelijke rente (artikel 6:119 BW) blijft onverminderd." : "Het recht op de wettelijke handelsrente (artikel 6:119a BW) blijft onverminderd.", US: "Een eventueel recht op rente bij te late betaling op grond van het toepasselijke recht blijft onverminderd."}
  }[x.lang][x.law];
}

// Only used for payment plans and projects, where every german role name is a masculine noun, so "Der" always fits
function consumerRecital(x, roleName) {
  return {de: `Der ${roleName} schließt diesen Vertrag als Verbraucher.`,
    en: `The ${roleName} enters into this agreement as a consumer.`, nl: `De ${roleName} sluit deze overeenkomst als consument.`}[x.lang];
}

/* ---------------------------------------------------------------- payment plan */
function tplPayment(x) {
  const lg = x.lang, f = x.f, C = x.R("creditor"), D = x.R("debtor");
  const debt = (() => {
    const no = String(f.invoice_no || "").trim(), d = f.invoice_date ? x.date(f.invoice_date) : "", desc = String(f.debt_desc || "").trim();
    if (!no && !desc) return {de: "[Grund der Forderung]", en: "[what the debt is for]", nl: "[grond van de vordering]"}[lg];
    if (lg === "de") return `${no ? `der Rechnung Nr. ${no}` : "der Leistung"}${d ? ` vom ${d}` : ""}${desc ? ` (${desc})` : ""}`;
    if (lg === "en") return `${no ? `invoice no. ${no}` : "the services provided"}${d ? ` dated ${d}` : ""}${desc ? ` (${desc})` : ""}`;
    return `${no ? `factuur nr. ${no}` : "de geleverde prestatie"}${d ? ` van ${d}` : ""}${desc ? ` (${desc})` : ""}`;
  })();
  const s = x.sched; const total = x.money(f.total), down = s.down > 0 ? x.fmtCents(s.down) : "", rest = x.fmtCents(s.principal);
  const n = s.n, first = x.date(f.first), downDate = x.date(f.down_date);
  const adj = {de: {monthly: "monatlichen", weekly: "wöchentlichen", quarterly: "vierteljährlichen"}, en: {monthly: "monthly", weekly: "weekly", quarterly: "quarterly"}, nl: {monthly: "maandelijkse", weekly: "wekelijkse", quarterly: "driemaandelijkse"}}[lg][f.interval || "monthly"];
  const ref = String(f.invoice_no || "").trim() ? `${{de: "Ratenzahlung", en: "Payment plan", nl: "Betalingsregeling"}[lg]} ${String(f.invoice_no).trim()}` : {de: "Ratenzahlung", en: "Payment plan", nl: "Betalingsregeling"}[lg];
  const bank = x.creditorBank;
  const bankItems = {de: [`Kontoinhaber: ${bank.holder}`, `IBAN: ${bank.iban}`, `BIC: ${bank.bic}`, `Bank: ${bank.bank}`], en: [`Account holder: ${bank.holder}`, `IBAN: ${bank.iban}`, `BIC: ${bank.bic}`, `Bank: ${bank.bank}`], nl: [`Rekeninghouder: ${bank.holder}`, `IBAN: ${bank.iban}`, `BIC: ${bank.bic}`, `Bank: ${bank.bank}`]}[lg];
  const bankRows = [[{de: "Kontoinhaber", en: "Account holder", nl: "Rekeninghouder"}[lg], bank.holder], ["IBAN", bank.iban], ["BIC", bank.bic], ["Bank", bank.bank]];
  const debit = f.method === "debit";
  const T = {
    de: {title: "Ratenzahlungsvereinbarung",
      rec: [`Der ${D} schuldet dem ${C} aus ${debt} einen Betrag von ${total}. Die Parteien vereinbaren, dass dieser Betrag in Raten gezahlt wird.`],
      cl: [
        C_("Anerkenntnis der Forderung", `Der ${D} bestätigt, dem ${C} den Betrag von ${total} zu schulden. Diese Bestätigung hält nur die bestehende Forderung fest. Eine neue, davon unabhängige Verpflichtung entsteht dadurch nicht.`),
        C_("Ratenzahlung", `Der ${D} zahlt ${down ? `nach der Anzahlung den Restbetrag von ${rest}` : "den Betrag"} in ${n} ${adj} Raten nach dem Zahlungsplan unten. Die erste Rate ist am ${first} fällig.`,
          down ? `Die Anzahlung von ${down} ist am ${downDate} fällig.` : "",
          `Eine Zahlung ist rechtzeitig, wenn sie spätestens am Fälligkeitstag dem Konto des ${C}s gutgeschrieben ist.`,
          debit ? `Die Raten werden per SEPA-Lastschrift eingezogen. Der ${D} erteilt dafür ein gesondertes SEPA-Lastschriftmandat.` : PCard(`Die Zahlungen erfolgen per Überweisung auf das folgende Konto des ${C}s. Als Verwendungszweck ist „${ref}“ anzugeben:`, bankRows)),
        C_("Vorzeitige Zahlung", `Der ${D} kann den offenen Betrag jederzeit ganz oder teilweise vorzeitig zahlen. Dafür fallen keine Kosten an.`),
        C_("Keine Zinsen, keine Gebühren", `Für diese Ratenzahlung berechnet der ${C} weder Zinsen noch Gebühren.`),
        C_("Zahlungsverzug", `Ist der ${D} mit mindestens zwei aufeinanderfolgenden Raten ganz oder teilweise im Rückstand, kann der ${C} ${tf(x)} eine letzte Zahlungsfrist von zwei Wochen setzen. Wird innerhalb dieser Frist nicht gezahlt, kann der ${C} den gesamten noch offenen Betrag sofort fällig stellen.`, interestLine(x)),
        C_("Verhältnis zur ursprünglichen Forderung", `Diese Vereinbarung ändert nur die Art der Zahlung. Im Übrigen bleibt das ursprüngliche Vertragsverhältnis unverändert. Mit vollständiger Zahlung aller Raten ist die Forderung erfüllt.`)],
      sched: {label: "Zahlungsplan", columns: ["Nr.", "Fällig am", "Betrag", "Restbetrag danach"], down: "Anzahlung", sum: "Summe"}},
    en: {title: "Payment plan agreement",
      rec: [`The ${D} owes the ${C} ${total} under ${debt}. The parties agree that this amount is paid in instalments.`],
      cl: [
        C_("Acknowledgement of the debt", `The ${D} confirms owing the ${C} ${total}. This confirmation only records the existing debt. It does not create a new or separate obligation.`),
        C_("Payment in instalments", `The ${D} pays ${down ? `the remaining ${rest} after the down payment` : "this amount"} in ${n} ${adj} instalments according to the payment schedule below. The first instalment is due on ${first}.`,
          down ? `The down payment of ${down} is due on ${downDate}.` : "",
          `A payment is on time if it is credited to the ${C}'s account by the due date.`,
          debit ? `The instalments are collected by SEPA direct debit. The ${D} gives a separate SEPA direct debit mandate for this.` : PCard(`Payments are made by bank transfer to the following account of the ${C}, quoting “${ref}” as the reference:`, bankRows)),
        C_("Early payment", `The ${D} may pay all or part of the outstanding amount early at any time, free of charge.`),
        C_("No interest, no fees", `The ${C} charges no interest and no fees for this payment plan.`),
        C_("Late payment", `If the ${D} is behind with at least two consecutive instalments, in full or in part, the ${C} may set a final deadline of two weeks ${tf(x)}. If payment is not made within that deadline, the ${C} may demand the whole outstanding amount at once.`, interestLine(x)),
        C_("Relation to the original debt", "This agreement only changes how the debt is paid. Apart from that, the original contract stays unchanged. Once all instalments are paid in full, the debt is settled.")],
      sched: {label: "Payment schedule", columns: ["No.", "Due date", "Amount", "Balance after"], down: "Down payment", sum: "Total"}},
    nl: {title: "Betalingsregeling",
      rec: [`De ${D} is aan de ${C} een bedrag van ${total} verschuldigd op grond van ${debt}. Partijen spreken af dat dit bedrag in termijnen wordt betaald.`],
      cl: [
        C_("Erkenning van de schuld", `De ${D} erkent een bedrag van ${total} aan de ${C} verschuldigd te zijn. Deze erkenning legt alleen de bestaande schuld vast. Er ontstaat geen nieuwe of afzonderlijke verplichting.`),
        C_("Betaling in termijnen", `De ${D} betaalt ${down ? `het restant van ${rest} na de aanbetaling` : "dit bedrag"} in ${n} ${adj} termijnen volgens het betalingsschema hieronder. De eerste termijn vervalt op ${first}.`,
          down ? `De aanbetaling van ${down} moet uiterlijk op ${downDate} zijn betaald.` : "",
          `Een betaling is op tijd als het bedrag uiterlijk op de vervaldag op de rekening van de ${C} is bijgeschreven.`,
          debit ? `De termijnen worden per SEPA-incasso geïnd. De ${D} geeft hiervoor een afzonderlijke SEPA-machtiging.` : PCard(`Betalingen gebeuren per overboeking naar de volgende rekening van de ${C}, onder vermelding van “${ref}”:`, bankRows)),
        C_("Vervroegde betaling", `De ${D} mag het openstaande bedrag op elk moment geheel of gedeeltelijk eerder betalen, zonder kosten.`),
        C_("Geen rente, geen kosten", `De ${C} brengt voor deze betalingsregeling geen rente en geen kosten in rekening.`),
        C_("Betalingsachterstand", `Loopt de ${D} bij ten minste twee opeenvolgende termijnen geheel of gedeeltelijk achter, dan kan de ${C} ${tf(x)} een laatste betalingstermijn van twee weken stellen. Wordt binnen die termijn niet betaald, dan kan de ${C} het volledige openstaande bedrag direct opeisen.`, interestLine(x)),
        C_("Verhouding tot de oorspronkelijke vordering", "Deze regeling wijzigt alleen de manier van betalen. Voor het overige blijft de oorspronkelijke overeenkomst ongewijzigd. Met de volledige betaling van alle termijnen is de schuld voldaan.")],
      sched: {label: "Betalingsschema", columns: ["Nr.", "Vervaldatum", "Bedrag", "Openstaand daarna"], down: "Aanbetaling", sum: "Totaal"}}
  }[lg];
  const rows = [];
  let bal = s.total;
  if (s.down > 0) { bal -= s.down; rows.push(["", `${T.sched.down}, ${downDate}`, x.fmtCents(s.down), x.fmtCents(bal)]); }
  s.rows.forEach((r, i) => { bal -= r.amt; rows.push([String(i + 1), r.date ? x.date(r.date) : x.date(""), x.fmtCents(r.amt), x.fmtCents(Math.max(bal, 0))]); });
  rows.push(["", T.sched.sum, x.fmtCents(s.total), ""]);
  const notes = [];
  if (x.otherConsumer || x.consumerAny) notes.push("Keep a payment plan with a consumer free of interest and fees. Otherwise consumer credit rules apply (Germany §§ 506 ff. BGB, UK Consumer Credit Act 1974, Netherlands consumer credit rules).");
  if (!debit && /\[/.test(bankItems.join(""))) notes.push("Bank details are still placeholders. Pick a payment account (or fill in the other party's bank), or write the clauses out and type them in.");
  if (s.mismatch) notes.push("The instalments do not add up to the total. Check the amounts.");
  return {title: T.title, recitals: T.rec.concat(x.otherConsumer ? [consumerRecital(x, x.otherRole)] : []).map(t => ({text: t})), clauses: T.cl,
    schedule: [{label: T.sched.label, after_clause: 2, columns: T.sched.columns, rows}], notes};
}

/* ---------------------------------------------------------------- repayment plan with direct payments to a third party */
// Step 1 the debtor pays a fixed amount straight to a third party and it counts against the debt, step 2 is instalments to the creditor for whats left. All integer cents.
function repaySchedule(f) {
  const total = parseMoney(f.total), a1raw = parseMoney(f.p1_amt), a2 = parseMoney(f.p2_amt);
  const n1 = Math.min(24, Math.max(0, Math.round(+f.p1_n || 0)));
  const a1 = a1raw == null || Number.isNaN(a1raw) ? 0 : a1raw;
  const good = v => v != null && !Number.isNaN(v) && v > 0;
  const ok0 = good(total) && good(a2) && (n1 === 0 || a1 > 0);
  const p1sum = n1 * a1, covered = ok0 && total - p1sum <= 0;
  // If step 1 already covers the whole total there is nothing left for step 2, so the numbers stay placeholders and a note says why
  const ok = ok0 && !covered, rest = ok ? total - p1sum : NaN;
  const n2 = ok && rest > 0 ? Math.ceil(rest / a2) : 0;
  const last = n2 ? rest - a2 * (n2 - 1) : 0;
  const rows1 = Array.from({length: n1}, (_, k) => ({date: f.p1_first ? addMonths(f.p1_first, k) : "", amt: a1}));
  const p2first = f.p2_first || (f.p1_first ? addMonths(f.p1_first, n1) : "");
  const rows2 = Array.from({length: Math.min(n2, 600)}, (_, k) => ({date: p2first ? addMonths(p2first, k) : "", amt: k === n2 - 1 ? last : a2}));
  const end = n2 ? (p2first ? addMonths(p2first, n2 - 1) : "") : (n1 && rows1.length ? rows1[rows1.length - 1].date : "");
  return {ok, total: ok ? total : NaN, a1, a2: good(a2) ? a2 : NaN, n1, n2, p1sum, rest, last, rows1, rows2, p2first, end, covered, tooLong: n2 > 120};
}
function tplRepay(x) {
  const lg = x.lang, f = x.f, C = x.R("creditor"), D = x.R("debtor"), s = repaySchedule(f);
  const q = v => String(v == null ? "" : v).trim();
  const PHA = ph_("amount", lg);
  const money = c => Number.isFinite(c) ? x.fmtCents(c) : PHA;
  const TP = q(f.third) || {de: "[Name des Dritten]", en: "[name of the third party]", nl: "[naam van de derde]"}[lg];
  const desc = q(f.debt_desc).replace(/[.\s]+$/, "") || {de: "[Grund der Forderung]", en: "[what the debt is for]", nl: "[grond van de vordering]"}[lg];
  const cust = q(f.cust_no), home = q(f.home), since = q(f.since);
  const from = x.date(f.debt_from), to = f.debt_to ? x.date(f.debt_to) : "";
  const eDate = x.date(f.earlier_date), eAmt = x.money(f.earlier_amt);
  const total = x.money(f.total), a1 = money(s.a1), a2 = money(s.a2);
  const p1sum = s.ok ? x.fmtCents(s.p1sum) : PHA, rest = s.ok ? x.fmtCents(Math.max(s.rest, 0)) : PHA, last = s.ok ? x.fmtCents(s.last) : PHA;
  const n2 = s.ok ? String(s.n2) : ({de: "[Anzahl]", en: "[number]", nl: "[aantal]"}[lg]);
  const p1first = x.date(f.p1_first), p2first = x.date(s.p2first), end = s.end ? x.date(s.end) : x.date("");
  const days = Math.max(1, Math.round(+f.proof_days || 3)), n1 = s.n1;
  const bank = x.creditorBank;
  const bankItems = {de: [`Kontoinhaber: ${bank.holder}`, `IBAN: ${bank.iban}`, `BIC: ${bank.bic}`, `Bank: ${bank.bank}`], en: [`Account holder: ${bank.holder}`, `IBAN: ${bank.iban}`, `BIC: ${bank.bic}`, `Bank: ${bank.bank}`], nl: [`Rekeninghouder: ${bank.holder}`, `IBAN: ${bank.iban}`, `BIC: ${bank.bic}`, `Bank: ${bank.bank}`]}[lg];
  const bankRows = [[{de: "Kontoinhaber", en: "Account holder", nl: "Rekeninghouder"}[lg], bank.holder], ["IBAN", bank.iban], ["BIC", bank.bic], ["Bank", bank.bank]];
  const ref = {de: "Rückzahlung", en: "Repayment", nl: "Terugbetaling"}[lg];
  const items = lines(f.breakdown);
  const one = s.n2 === 1;
  const T = {
    de: {title: "Rückzahlungsvereinbarung",
      rec: [`Der ${C} und der ${D} bewohnen gemeinsam eine Wohnung${home ? ` (${home})` : ""}.`,
        `Am ${eDate} hat der ${D} schriftlich zugesagt, monatlich ${eAmt} zu zahlen (Zweck: ${desc}). Das ist die „frühere Zusage“. Der ${D} hat diese Zahlungen nicht geleistet.`,
        `Deshalb hat der ${C} die fälligen Beträge ab ${from}${to ? ` bis ${to}` : ""} für den ${D} an ${TP} gezahlt.${since ? ` Der ${D} hat seit ${since} nichts mehr an ${TP} gezahlt.` : ""} Die Parteien regeln mit dieser Vereinbarung, wie der ${D} das Geld zurückzahlt.`],
      ack: C_("Anerkenntnis der Forderung",
        `Der ${D} bestätigt, dem ${C} ${total} zu schulden (die „Forderung“). Die Forderung betrifft: ${desc}, ab ${from}${to ? ` bis ${to}` : ""}.`,
        items.length ? P_("Die Forderung setzt sich wie folgt zusammen:", items) : "",
        `Diese Bestätigung hält nur die bestehende Forderung fest. Eine neue, davon unabhängige Verpflichtung entsteht dadurch nicht. Der ${D} bestreitet weder die Höhe noch den Grund der Forderung.`,
        `Die frühere Zusage bleibt als Nachweis der Forderung bestehen. Weichen diese Vereinbarung und die frühere Zusage bei Art und Zeitpunkt der Zahlung voneinander ab, gilt diese Vereinbarung.`),
      step1: C_(`Schritt 1: Zahlungen direkt an ${TP}`,
        `Der ${D} zahlt ab dem ${p1first} für ${n1} Monate jeweils ${a1} im Monat direkt an ${TP}${cust ? ` (Kundennummer ${cust})` : ""}. Jede Zahlung ist am gleichen Tag des Monats fällig wie die erste. Die Termine stehen im Zahlungsplan unten.`,
        `Diese Zahlungen mindern die Forderung um den Betrag, den ${TP} erhält. Zusammen sind das ${p1sum}.`,
        `Der ${D} schickt dem ${C} ${tf(x)} innerhalb von ${days} Tagen nach jedem Fälligkeitstag einen Nachweis über die Zahlung, zum Beispiel einen Beleg oder einen Screenshot der Überweisung. Eine Zahlung zählt erst, wenn ${TP} das Geld erhalten hat.`,
        `Eine Zahlung in Schritt 1, die nicht erfolgt oder nicht nachgewiesen wird, mindert die Forderung nicht. Der ${C} kann dann verlangen, dass der ${D} diesen Betrag an den ${C} zahlt.`),
      step2: C_("Schritt 2: Raten an den " + C,
        `${n1 ? `Nach Schritt 1 bleiben ${rest} offen. ` : ""}Diesen Betrag zahlt der ${D} in monatlichen Raten von ${a2} an den ${C}, beginnend am ${p2first}, bis die Forderung vollständig bezahlt ist. Das sind ${n2} ${one ? "Rate" : "Raten"}${s.ok && s.n2 > 1 ? `, die letzte Rate beträgt ${last}` : ""}.`,
        `Eine Zahlung ist rechtzeitig, wenn sie spätestens am Fälligkeitstag dem Konto des ${C}s gutgeschrieben ist.`,
        PCard(`Die Zahlungen erfolgen per Überweisung auf das folgende Konto des ${C}s. Als Verwendungszweck ist „${ref}“ anzugeben:`, bankRows),
        `Werden alle Zahlungen rechtzeitig geleistet, ist die Forderung am ${end} vollständig bezahlt.`),
      more: [
        C_("Zusätzliche und vorzeitige Zahlungen", `Der ${D} kann jederzeit mehr zahlen. Zusätzliche Zahlungen an den ${C} mindern den offenen Betrag. Die weiteren Raten bleiben bis zur vollständigen Zahlung wie geplant fällig, der Plan endet dann einfach früher. Dafür fallen keine Kosten an.`),
        C_("Keine Zinsen, keine Gebühren", `Der ${C} berechnet für diese Vereinbarung weder Zinsen noch Gebühren. Solange der ${D} die Vereinbarung einhält, verfolgt der ${C} die Forderung nicht gerichtlich.`),
        C_("Zahlungsverzug", `Ist der ${D} mit mindestens zwei aufeinanderfolgenden Zahlungen (in Schritt 1 oder in Schritt 2) ganz oder teilweise im Rückstand, kann der ${C} ${tf(x)} eine letzte Zahlungsfrist von zwei Wochen setzen und darauf hinweisen, dass sonst der gesamte offene Betrag fällig wird. Wird innerhalb dieser Frist nicht gezahlt, kann der ${C} den gesamten noch offenen Betrag sofort fällig stellen. Dann endet auch das Stillhalten des ${C}s.`, interestLine(x)),
        C_("Auszug und Kontakt", `Zieht der ${D} aus der gemeinsamen Wohnung aus oder ändern sich die Anschrift, die Telefonnummer oder die E-Mail-Adresse des ${D}s, teilt der ${D} dies dem ${C} ${tf(x)} innerhalb von 14 Tagen mit. Die Vereinbarung gilt dann unverändert weiter.`),
        C_("Verhältnis zur ursprünglichen Forderung", `Diese Vereinbarung regelt nur, wie die Forderung bezahlt wird. Die Forderung besteht bis zur vollständigen Zahlung in voller Höhe fort und kann auch nach einem Verstoß gegen diese Vereinbarung durchgesetzt werden. Der ${C} verzichtet durch diese Vereinbarung auf keinen Anspruch.`, `Sind alle Zahlungen geleistet, bestätigt der ${C} das auf Wunsch ${tf(x)}. Die Forderung ist dann erledigt.`)],
      sched: {label: "Zahlungsplan", columns: ["Nr.", "Fällig am", "Betrag", "Zahlung an", "Restbetrag danach"], sum: "Summe", gap: "weitere monatliche Raten"}},
    en: {title: "Repayment agreement",
      rec: [`The ${C} and the ${D} share a home${home ? ` (${home})` : ""}.`,
        `On ${eDate} the ${D} signed a written commitment to pay ${eAmt} a month (purpose: ${desc}). This is the “Earlier Commitment”. The ${D} did not make these payments.`,
        `Because of this the ${C} paid the amounts that fell due from ${from}${to ? ` to ${to}` : ""} to ${TP} on the ${D}'s behalf.${since ? ` The ${D} has made no payments to ${TP} since ${since}.` : ""} With this agreement the parties settle how the ${D} pays the money back.`],
      ack: C_("Acknowledgement of the debt",
        `The ${D} confirms owing the ${C} ${total} (the “Debt”). The Debt is for: ${desc}, from ${from}${to ? ` to ${to}` : ""}.`,
        items.length ? P_("The Debt is made up as follows:", items) : "",
        `This confirmation only records the existing claim. It does not create a new or separate obligation. The ${D} does not dispute the amount or the reason for the Debt.`,
        `The Earlier Commitment stays in place as proof of the claim. If this agreement and the Earlier Commitment differ on how or when payment is made, this agreement applies.`),
      step1: C_(`Step 1: payments straight to ${TP}`,
        `Starting on ${p1first}, the ${D} pays ${a1} a month for ${n1} months directly to ${TP}${cust ? ` (customer no. ${cust})` : ""}. Each payment is due on the same day of the month as the first one. The dates are in the payment schedule below.`,
        `These payments reduce the Debt by the amount ${TP} receives. Together they come to ${p1sum}.`,
        `Within ${days} days after each due date the ${D} sends the ${C} proof of the payment ${tf(x)}, for example a receipt or a screenshot of the transfer. A payment counts only once ${TP} has received the money.`,
        `A payment in step 1 that is not made or not proven does not reduce the Debt. The ${C} may then ask the ${D} to pay that amount to the ${C} instead.`),
      step2: C_(`Step 2: instalments to the ${C}`,
        `${n1 ? `After step 1, ${rest} remains open. ` : ""}The ${D} pays this to the ${C} in monthly instalments of ${a2}, starting on ${p2first}, until the Debt is paid in full. That is ${n2} ${one ? "instalment" : "instalments"}${s.ok && s.n2 > 1 ? `, and the last one is ${last}` : ""}.`,
        `A payment is on time if it is credited to the ${C}'s account by the due date.`,
        PCard(`Payments are made by bank transfer to the following account of the ${C}, quoting “${ref}” as the reference:`, bankRows),
        `If every payment is made on time, the Debt is paid in full on ${end}.`),
      more: [
        C_("Extra and early payments", `The ${D} may pay more at any time. Extra payments to the ${C} reduce the open amount. The following instalments stay due as planned until the Debt is paid in full, so the plan simply ends earlier. This costs nothing.`),
        C_("No interest, no fees", `The ${C} charges no interest and no fees for this agreement. As long as the ${D} keeps to it, the ${C} does not take legal action for the Debt.`),
        C_("Late payment", `If the ${D} is behind, in full or in part, with at least two payments in a row (in step 1 or in step 2), the ${C} may set a final deadline of two weeks ${tf(x)} and warn that otherwise the whole open amount becomes due. If payment is not made within that deadline, the ${C} may demand the whole open amount at once. The ${C}'s promise not to take legal action then ends.`, interestLine(x)),
        C_("Moving out and contact", `If the ${D} moves out of the shared home, or the ${D}'s address, phone number or email address changes, the ${D} tells the ${C} ${tf(x)} within 14 days. The agreement then stays in force unchanged.`),
        C_("Relation to the original claim", `This agreement only sets how the Debt is paid. The Debt stays in full until it is paid, and it can still be enforced if the ${D} breaks this agreement. The ${C} gives up no claim by signing it.`, `Once all payments are made, the ${C} confirms this ${tf(x)} on request. The Debt is then settled.`)],
      sched: {label: "Payment schedule", columns: ["No.", "Due date", "Amount", "Paid to", "Balance after"], sum: "Total", gap: "further monthly instalments"}},
    nl: {title: "Terugbetalingsovereenkomst",
      rec: [`De ${C} en de ${D} wonen samen in een woning${home ? ` (${home})` : ""}.`,
        `Op ${eDate} heeft de ${D} schriftelijk toegezegd maandelijks ${eAmt} te betalen (doel: ${desc}). Dit is de “eerdere toezegging”. De ${D} heeft deze betalingen niet gedaan.`,
        `Daarom heeft de ${C} de verschuldigde bedragen vanaf ${from}${to ? ` tot ${to}` : ""} namens de ${D} aan ${TP} betaald.${since ? ` De ${D} heeft sinds ${since} niets meer aan ${TP} betaald.` : ""} Met deze overeenkomst regelen partijen hoe de ${D} het geld terugbetaalt.`],
      ack: C_("Erkenning van de schuld",
        `De ${D} erkent aan de ${C} ${total} verschuldigd te zijn (de “Schuld”). De Schuld betreft: ${desc}, vanaf ${from}${to ? ` tot ${to}` : ""}.`,
        items.length ? P_("De Schuld bestaat uit:", items) : "",
        `Deze erkenning legt alleen de bestaande vordering vast. Er ontstaat geen nieuwe of afzonderlijke verplichting. De ${D} betwist de hoogte en de grond van de Schuld niet.`,
        `De eerdere toezegging blijft bestaan als bewijs van de vordering. Wijken deze overeenkomst en de eerdere toezegging af over de wijze of het tijdstip van betaling, dan gaat deze overeenkomst voor.`),
      step1: C_(`Stap 1: betalingen rechtstreeks aan ${TP}`,
        `Vanaf ${p1first} betaalt de ${D} gedurende ${n1} maanden elke maand ${a1} rechtstreeks aan ${TP}${cust ? ` (klantnummer ${cust})` : ""}. Elke betaling is op dezelfde dag van de maand verschuldigd als de eerste. De data staan in het betalingsschema hieronder.`,
        `Deze betalingen verminderen de Schuld met het bedrag dat ${TP} ontvangt. Samen is dat ${p1sum}.`,
        `De ${D} stuurt de ${C} ${tf(x)} binnen ${days} dagen na elke vervaldatum een bewijs van betaling, bijvoorbeeld een bon of een screenshot van de overboeking. Een betaling telt pas mee zodra ${TP} het bedrag heeft ontvangen.`,
        `Een betaling in stap 1 die niet wordt gedaan of niet wordt bewezen, vermindert de Schuld niet. De ${C} kan dan verlangen dat de ${D} dat bedrag aan de ${C} betaalt.`),
      step2: C_(`Stap 2: termijnen aan de ${C}`,
        `${n1 ? `Na stap 1 blijft ${rest} open. ` : ""}Dit bedrag betaalt de ${D} in maandelijkse termijnen van ${a2} aan de ${C}, vanaf ${p2first}, totdat de Schuld volledig is betaald. Dat zijn ${n2} ${one ? "termijn" : "termijnen"}${s.ok && s.n2 > 1 ? `, de laatste termijn is ${last}` : ""}.`,
        `Een betaling is op tijd als het bedrag uiterlijk op de vervaldag op de rekening van de ${C} is bijgeschreven.`,
        PCard(`Betalingen gebeuren per overboeking naar de volgende rekening van de ${C}, onder vermelding van “${ref}”:`, bankRows),
        `Als alle betalingen op tijd gebeuren, is de Schuld op ${end} volledig betaald.`),
      more: [
        C_("Extra en vervroegde betalingen", `De ${D} mag op elk moment meer betalen. Extra betalingen aan de ${C} verminderen het openstaande bedrag. De volgende termijnen blijven tot volledige betaling gewoon verschuldigd, de regeling eindigt dan eerder. Hiervoor worden geen kosten in rekening gebracht.`),
        C_("Geen rente, geen kosten", `De ${C} brengt voor deze overeenkomst geen rente en geen kosten in rekening. Zolang de ${D} zich aan de overeenkomst houdt, neemt de ${C} geen gerechtelijke stappen voor de Schuld.`),
        C_("Betalingsachterstand", `Loopt de ${D} bij ten minste twee opeenvolgende betalingen (in stap 1 of in stap 2) geheel of gedeeltelijk achter, dan kan de ${C} ${tf(x)} een laatste betalingstermijn van twee weken stellen en erop wijzen dat anders het hele openstaande bedrag opeisbaar wordt. Wordt binnen die termijn niet betaald, dan kan de ${C} het volledige openstaande bedrag direct opeisen. Daarmee eindigt ook de toezegging van de ${C} om geen gerechtelijke stappen te nemen.`, interestLine(x)),
        C_("Verhuizing en contact", `Verhuist de ${D} uit de gemeenschappelijke woning, of wijzigen het adres, het telefoonnummer of het e-mailadres van de ${D}, dan meldt de ${D} dit binnen 14 dagen ${tf(x)} aan de ${C}. De overeenkomst blijft dan ongewijzigd gelden.`),
        C_("Verhouding tot de oorspronkelijke vordering", `Deze overeenkomst regelt alleen hoe de Schuld wordt betaald. De Schuld blijft tot volledige betaling in volle omvang bestaan en kan ook na een schending van deze overeenkomst worden afgedwongen. De ${C} doet door deze overeenkomst van geen enkele vordering afstand.`, `Zijn alle betalingen gedaan, dan bevestigt de ${C} dit op verzoek ${tf(x)}. De Schuld is dan voldaan.`)]  ,
      sched: {label: "Betalingsschema", columns: ["Nr.", "Vervaldatum", "Bedrag", "Betaald aan", "Openstaand daarna"], sum: "Totaal", gap: "verdere maandelijkse termijnen"}}
  }[lg];
  // The schedule, one list for both steps with the running balance, a very long step 2 is shown short: the first two, a gap row, the last two
  const all = s.rows1.map(r => ({r, to: TP})).concat(s.rows2.map(r => ({r, to: C})));
  let bal = s.ok ? s.total : NaN;
  const lineOf = (e, i) => { bal = bal - e.r.amt; return [String(i + 1), x.date(e.r.date), money(e.r.amt), e.to, s.ok ? x.fmtCents(Math.max(bal, 0)) : ""]; };
  const full = all.map(lineOf);
  const rows = s.rows2.length > 30
    ? full.slice(0, n1 + 2).concat([["", `… ${T.sched.gap}`, "", C, ""]], full.slice(-2))
    : full;
  rows.push(["", T.sched.sum, s.ok ? x.fmtCents(s.total) : PHA, "", ""]);
  const cl = [T.ack]; if (n1 > 0) cl.push(T.step1); cl.push(T.step2); const schedAfter = cl.length; cl.push(...T.more);
  const notes = [];
  if (s.covered) notes.push("The step 1 payments add up to the whole total or more, so nothing is left for step 2. Lower the number of months or the amount in step 1, or use the plain payment plan type.");
  else if (!s.ok) notes.push("Fill in the total and both monthly amounts to get the payment schedule and the numbers in the text.");
  else {
    notes.push(`The plan runs ${n1 + s.n2} months in all, until ${fmtDate(s.end, "en")}${s.n1 ? `: ${n1} payments of ${fmtCents(s.a1, "en", x.cur)} to ${q(f.third) || "the third party"}, then ${s.n2} to you` : ""}.`);
    if (s.tooLong) notes.push("Step 2 would take more than ten years at this amount. Raise the monthly instalment or the number of months in step 1.");
  }
  if (n1 > 0) notes.push(`Check that the step 1 payments really go towards this debt and not only towards the current share of the bill. Otherwise one payment is counted twice. If ${q(f.third) || "the third party"} cannot confirm payments to you, keep the proofs.`);
  notes.push("Both sides should sign by hand on paper and keep one original each. A signed paper is much stronger proof than a chat message.");
  if (x.law === "DE") notes.push("Under German law a written acknowledgement of the debt restarts the three year limitation period (§ 212 BGB). Clause 1 records the debt without a new stand-alone promise to pay. For a stronger promise (§ 781 BGB, written form) have a lawyer adapt clause 1.");
  if (x.otherConsumer || x.consumerAny) notes.push("Keep a payment plan with a consumer free of interest and fees. Otherwise consumer credit rules apply (Germany §§ 506 ff. BGB, UK Consumer Credit Act 1974, Netherlands consumer credit rules).");
  if (/\[/.test(bankItems.join(""))) notes.push("Bank details for step 2 are still placeholders. Pick a payment account, or write the clauses out and type them in.");
  return {title: T.title, recitals: T.rec.concat(x.otherConsumer ? [consumerRecital(x, x.otherRole)] : []).map(t => ({text: t})), clauses: cl,
    schedule: [{label: T.sched.label, after_clause: schedAfter, columns: T.sched.columns, rows}], notes};
}

/* ---------------------------------------------------------------- freelance project or service */
function tplService(x) {
  const lg = x.lang, f = x.f, K = x.R("client"), A = x.R("contractor");
  const project = String(f.project || "").trim() || {de: "[Projektname]", en: "[project name]", nl: "[projectnaam]"}[lg];
  const scope = endDot(f.scope) || {de: "[Beschreibung der Leistungen]", en: "[description of the services]", nl: "[omschrijving van de werkzaamheden]"}[lg];
  const deliv = lines(f.deliverables); if (!deliv.length) deliv.push({de: "[Ergebnis]", en: "[deliverable]", nl: "[resultaat]"}[lg]);
  const start = x.date(f.start), end = x.date(f.end);
  const ms = lines(f.milestones).map(l => {
    const p = l.split("|").map(s => s.trim());
    if (p.length === 1) return p[0];
    const d = /^\d{4}-\d{2}-\d{2}$/.test(p[0]) ? x.date(p[0]) : p[0];
    const amt = p[2] ? x.money(p[2]) : "";
    return `${d}: ${p[1] || ""}${amt ? ` (${amt})` : ""}`;
  });
  const msAmounts = lines(f.milestones).some(l => (l.split("|")[2] || "").trim());
  const fee = x.money(f.fee), cap = String(f.cap || "").trim() ? x.money(f.cap) : "";
  const ft = f.fee_type || "fixed", days = +f.pay_days || 14, adays = +f.accept_days || 14;
  const ccons = x.clientConsumer;
  const excl = f.exclusive !== false;
  const assign = f.rights === "assign" && x.law !== "DE";
  const T = tf(x);
  const vat = (() => {
    if (f.vat === "plus") return {de: "Alle Beträge verstehen sich zuzüglich der gesetzlichen Umsatzsteuer.", en: "All amounts are plus VAT at the statutory rate.", nl: "Alle bedragen zijn exclusief btw."}[lg];
    if (f.vat === "incl") return {de: "Alle Beträge enthalten die gesetzliche Umsatzsteuer.", en: "All amounts include VAT at the statutory rate.", nl: "Alle bedragen zijn inclusief btw."}[lg];
    const c = x.contractorCountry;
    return {DE: {de: "Gemäß § 19 UStG wird keine Umsatzsteuer berechnet.", en: "No VAT is charged under section 19 of the German VAT Act (UStG, small business rule).", nl: "Op grond van § 19 van de Duitse btw-wet (UStG, kleineondernemersregeling) wordt geen btw in rekening gebracht."},
      UK: {de: `Der ${A} ist nicht für die Umsatzsteuer (VAT) registriert, daher wird keine Umsatzsteuer berechnet.`, en: `The ${A} is not registered for VAT, so no VAT is charged.`, nl: `De ${A} is niet geregistreerd voor de btw (VAT), daarom wordt geen btw in rekening gebracht.`},
      NL: {de: "Von der Umsatzsteuer befreit nach der niederländischen Kleinunternehmerregelung (KOR).", en: "Exempt from VAT under the Dutch small business scheme (KOR).", nl: "Vrijgesteld van btw op grond van de kleineondernemersregeling."},
      US: {de: "Es wird keine Umsatzsteuer (sales tax) berechnet.", en: "No sales tax is charged.", nl: "Er wordt geen omzetbelasting (sales tax) in rekening gebracht."}}[c][lg];
  })();
  const usesDefault = {de: ["Vervielfältigung und Verbreitung, gedruckt und digital", "öffentliche Zugänglichmachung, insbesondere auf Websites, in Apps und in sozialen Medien", "Bearbeitung, Anpassung und Weiterentwicklung", "Nutzung in Werbung und Kommunikation"],
    en: ["copying and distribution, in print and digital form", "making available to the public, in particular on websites, in apps and on social media", "editing, adapting and further development", "use in advertising and communication"],
    nl: ["verveelvoudiging en verspreiding, gedrukt en digitaal", "openbaarmaking, in het bijzonder op websites, in apps en op sociale media", "bewerking, aanpassing en doorontwikkeling", "gebruik in reclame en communicatie"]}[lg];
  const uses = lines(f.uses).length ? lines(f.uses) : usesDefault;
  const L1 = {
    de: {title: "Projektvertrag",
      rec: [`Der ${K} beauftragt den ${A} mit dem Projekt „${project}“. Der ${A} arbeitet selbstständig und auf eigene Rechnung.`],
      scope: C_("Gegenstand und Leistungsumfang", `Der ${A} erbringt für den ${K} die folgenden Leistungen: ${scope}`, P_(`Der ${A} liefert insbesondere die folgenden Ergebnisse:`, deliv), `Leistungen, die hier nicht genannt sind, schuldet der ${A} nicht. Zusätzliche Leistungen vereinbaren die Parteien gesondert ${T}.`),
      work: C_("Durchführung und Mitwirkung", `Der ${A} arbeitet selbstständig und bestimmt Ort, Zeit und Art der Arbeit selbst, soweit das Projekt nichts anderes erfordert. Ein Arbeitsverhältnis wird nicht begründet.`, `Der ${K} stellt rechtzeitig und kostenlos die Informationen, Inhalte und Zugänge bereit, die für das Projekt nötig sind. Verzögert sich das Projekt, weil diese Mitwirkung fehlt, verschieben sich die Termine entsprechend.`, `Der ${A} setzt Dritte als Unterauftragnehmer nur ein, wenn der ${K} ${T} zugestimmt hat.`),
      dates: C_("Termine", `Das Projekt beginnt am ${start}. Die Fertigstellung ist für den ${end} vorgesehen.`, ms.length ? P_("Die Parteien vereinbaren die folgenden Meilensteine:", ms) : ""),
      accept: C_("Abnahme", `Der ${A} zeigt die Fertigstellung von Ergebnissen ${T} an. Der ${K} prüft sie innerhalb von ${adays} Tagen und erklärt dann die Abnahme oder nennt die festgestellten Mängel konkret.`, `Unwesentliche Mängel berechtigen nicht dazu, die Abnahme zu verweigern. Der ${A} beseitigt gemeldete Mängel in angemessener Frist.`, `Die Ergebnisse gelten als abgenommen, wenn der ${K} die Abnahme nicht innerhalb dieser Frist unter Angabe mindestens eines Mangels verweigert.${ccons ? ` Ist der ${K} Verbraucher, gilt das nur, wenn der ${A} mit der Fertigstellungsanzeige ${T} auf diese Folge hingewiesen hat.` : ""}`),
      fee: C_("Vergütung und Zahlung", (ft === "fixed" ? `Für die vereinbarten Leistungen erhält der ${A} eine Pauschalvergütung von ${fee}.` : `Der ${A} rechnet nach Aufwand mit einem ${ft === "hourly" ? "Stundensatz" : "Tagessatz"} von ${fee} ab und weist die ${ft === "hourly" ? "Stunden" : "Arbeitstage"} mit einer kurzen Aufstellung nach.${cap ? ` Ohne Zustimmung des ${K}s ${T} übersteigt die Vergütung insgesamt ${cap} nicht.` : ""}`), vat,
        `Der ${A} stellt die Vergütung ${msAmounts ? "jeweils bei Erreichen der Meilensteine im Abschnitt Termine" : ft === "fixed" ? "nach der Abnahme" : "monatlich"} in Rechnung. Rechnungen sind innerhalb von ${days} Tagen nach Zugang ohne Abzug zu zahlen.`, `Reisekosten und sonstige Auslagen werden nur erstattet, wenn der ${K} vorher ${T} zugestimmt hat.`),
      rights: x.law === "DE" ? C_("Rechte an den Ergebnissen", P_(`Mit vollständiger Zahlung der Vergütung räumt der ${A} dem ${K} an den Ergebnissen ein ${excl ? "ausschließliches" : "einfaches"}, zeitlich und räumlich unbeschränktes Nutzungsrecht für die folgenden Nutzungsarten ein:`, uses),
          `Der ${K} darf diese Rechte auf Dritte übertragen oder Dritten Nutzungsrechte einräumen, soweit das für die eigene Nutzung der Ergebnisse durch den ${K} nötig ist, zum Beispiel für Druckereien oder Agenturen.`,
          `Das Urheberrecht selbst bleibt beim ${A}, weil es nach deutschem Recht nicht übertragbar ist (§ 29 UrhG). Der ${K} erhält die oben genannten Nutzungsrechte nach § 31 UrhG.`,
          `Bis zur vollständigen Zahlung darf der ${K} die Ergebnisse nur zur Prüfung nutzen.`,
          `Enthalten die Ergebnisse Bestandteile Dritter, zum Beispiel Schriften, Bilder oder Open-Source-Software, gelten dafür deren Lizenzbedingungen. Der ${A} nennt diese Bestandteile bei der Übergabe.`,
          f.portfolio !== false ? `Der ${A} darf die Ergebnisse nach ihrer Veröffentlichung als Referenz zeigen, zum Beispiel im eigenen Portfolio. Vertrauliche Inhalte sind davon ausgenommen.` : "",
          f.credit ? `Der ${A} wird als Urheber genannt, soweit das bei der jeweiligen Nutzung üblich ist (§ 13 UrhG).` : "")
        : C_("Rechte an den Ergebnissen", assign ? `Mit vollständiger Zahlung der Vergütung überträgt der ${A} dem ${K} alle Urheberrechte und sonstigen Schutzrechte an den Ergebnissen, weltweit und für ihre gesamte Schutzdauer.` : P_(`Mit vollständiger Zahlung der Vergütung erteilt der ${A} dem ${K} eine ${excl ? "ausschließliche" : "einfache"}, weltweite und unbefristete Lizenz zur Nutzung der Ergebnisse für die folgenden Zwecke:`, uses),
          assign ? "Dieser Vertrag ist die unterschriebene schriftliche Erklärung, die das anwendbare Recht für diese Übertragung verlangt." : `Der ${A} behält das Urheberrecht und die sonstigen Schutzrechte an den Ergebnissen.`,
          assign && !f.credit ? `Der ${A} verzichtet auf die Urheberpersönlichkeitsrechte an den Ergebnissen, soweit das Gesetz dies zulässt.` : "",
          `Bis zur vollständigen Zahlung darf der ${K} die Ergebnisse nur zur Prüfung nutzen.`,
          `Enthalten die Ergebnisse Bestandteile Dritter, zum Beispiel Schriften, Bilder oder Open-Source-Software, gelten dafür deren Lizenzbedingungen. Der ${A} nennt diese Bestandteile bei der Übergabe.`,
          f.portfolio !== false ? `Der ${A} darf die Ergebnisse nach ihrer Veröffentlichung als Referenz zeigen, zum Beispiel im eigenen Portfolio. Vertrauliche Inhalte sind davon ausgenommen.` : "",
          f.credit ? `Der ${A} wird als Urheber genannt, soweit das bei der jeweiligen Nutzung üblich ist.` : ""),
      conf: C_("Vertraulichkeit", "Beide Parteien behandeln vertrauliche Informationen der anderen Partei, die sie im Rahmen dieses Vertrags erhalten, vertraulich und nutzen sie nur für dieses Projekt. Diese Pflicht gilt auch nach dem Ende des Vertrags.", "Nicht vertraulich sind Informationen, die öffentlich bekannt sind, die eine Partei schon vorher rechtmäßig kannte oder die aufgrund einer gesetzlichen Pflicht offengelegt werden müssen."),
      term: C_("Laufzeit und Kündigung", "Der Vertrag endet, wenn alle Leistungen abgenommen und vollständig bezahlt sind.", `Jede Partei kann den Vertrag aus wichtigem Grund ${T} kündigen, zum Beispiel bei einer schweren Pflichtverletzung der anderen Partei.`, `Endet der Vertrag vorzeitig, erhält der ${A} die Vergütung für die bis dahin erbrachten Leistungen. Weitergehende gesetzliche Ansprüche bleiben unberührt.`)},
    en: {title: "Project agreement",
      rec: [`The ${K} engages the ${A} for the project “${project}”. The ${A} works independently and on their own account.`],
      scope: C_("Subject and scope", `The ${A} provides the following services to the ${K}: ${scope}`, P_(`In particular, the ${A} delivers the following results:`, deliv), `Services not listed here are not owed. The parties agree on any additional services separately ${T}.`),
      work: C_("Way of working and cooperation", `The ${A} works independently and decides where, when and how to work, unless the project requires otherwise. This agreement does not create an employment relationship.`, `The ${K} provides, on time and free of charge, the information, content and access the project needs. If the project is delayed because this cooperation is missing, the dates move accordingly.`, `The ${A} uses subcontractors only if the ${K} has agreed ${T}.`),
      dates: C_("Dates and milestones", `The project starts on ${start}. Completion is planned for ${end}.`, ms.length ? P_("The parties agree on the following milestones:", ms) : ""),
      accept: C_("Acceptance", `The ${A} notifies the ${K} ${T} when results are complete. The ${K} checks them within ${adays} days and then either accepts them or describes the defects found.`, `Minor defects are no reason to refuse acceptance. The ${A} fixes reported defects within a reasonable time.`, `The results count as accepted if the ${K} does not refuse acceptance within this period, naming at least one defect.${ccons ? ` If the ${K} is a consumer, this only applies if the ${A} pointed out this consequence ${T} together with the notice of completion.` : ""}`),
      fee: C_("Fee and payment", (ft === "fixed" ? `For the agreed services the ${A} receives a fixed fee of ${fee}.` : `The ${A} charges for the time spent at ${ft === "hourly" ? "an hourly" : "a day"} rate of ${fee} and records the ${ft === "hourly" ? "hours" : "days worked"} in a short timesheet.${cap ? ` Without the ${K}'s consent ${T}, the total fee does not exceed ${cap}.` : ""}`), vat,
        `The ${A} invoices the fee ${msAmounts ? "when each milestone listed under Dates and milestones is reached" : ft === "fixed" ? "after acceptance" : "monthly"}. Invoices are payable within ${days} days of receipt without deduction.`, `Travel and other expenses are only reimbursed if the ${K} agreed to them in advance ${T}.`),
      rights: x.law === "DE" ? C_("Rights in the results", P_(`Once the fee has been paid in full, the ${A} grants the ${K} ${excl ? "an exclusive" : "a non-exclusive"} right of use in the results, unlimited in time and territory, for the following types of use:`, uses),
          `The ${K} may transfer these rights to third parties or grant them rights of use where this is needed for the ${K}'s own use of the results, for example by printers or agencies.`,
          `Copyright itself stays with the ${A}, because it cannot be transferred under German law (section 29 of the German Copyright Act, UrhG). The ${K} receives the rights of use listed above under section 31 UrhG.`,
          `Until the fee has been paid in full, the ${K} may use the results only to review them.`,
          `If the results contain third-party parts, for example fonts, images or open source software, their own licence terms apply. The ${A} lists these parts on handover.`,
          f.portfolio !== false ? `Once the results are published, the ${A} may show them as a reference, for example in their portfolio. Confidential content is excluded.` : "",
          f.credit ? `The ${A} is named as the author where this is usual for the type of use (section 13 UrhG).` : "")
        : C_("Rights in the results", assign ? `Once the fee has been paid in full, the ${A} assigns to the ${K} all copyright and other intellectual property rights in the results, worldwide and for their full term.` : P_(`Once the fee has been paid in full, the ${A} grants the ${K} ${excl ? "an exclusive" : "a non-exclusive"}, worldwide and perpetual licence to use the results for the following purposes:`, uses),
          assign ? "This agreement is the signed written document the applicable law requires for this assignment." : `The ${A} keeps the copyright and other intellectual property rights in the results.`,
          assign && !f.credit ? `The ${A} waives their moral rights in the results as far as the law allows.` : "",
          `Until the fee has been paid in full, the ${K} may use the results only to review them.`,
          `If the results contain third-party parts, for example fonts, images or open source software, their own licence terms apply. The ${A} lists these parts on handover.`,
          f.portfolio !== false ? `Once the results are published, the ${A} may show them as a reference, for example in their portfolio. Confidential content is excluded.` : "",
          f.credit ? `The ${A} is named as the author where this is usual for the type of use.` : ""),
      conf: C_("Confidentiality", "Each party keeps confidential the confidential information of the other party that it receives under this agreement and uses it only for this project. This duty continues after the agreement ends.", "Information is not confidential if it is public, if a party already knew it lawfully, or if it must be disclosed by law."),
      term: C_("Term and termination", "This agreement ends when all services have been accepted and paid for in full.", `Either party may terminate this agreement ${T} for good cause, for example a serious breach by the other party.`, `If the agreement ends early, the ${A} is paid for the services provided up to that point. Any further statutory claims are not affected.`)},
    nl: {title: "Projectovereenkomst",
      rec: [`De ${K} geeft de ${A} opdracht voor het project “${project}”. De ${A} werkt zelfstandig en voor eigen rekening.`],
      scope: C_("Onderwerp en omvang", `De ${A} verricht voor de ${K} de volgende werkzaamheden: ${scope}`, P_(`De ${A} levert in het bijzonder de volgende resultaten:`, deliv), `Werkzaamheden die hier niet worden genoemd, vallen niet onder deze overeenkomst. Aanvullende werkzaamheden spreken partijen apart ${T} af.`),
      work: C_("Uitvoering en medewerking", `De ${A} werkt zelfstandig en bepaalt zelf waar, wanneer en hoe het werk wordt gedaan, tenzij het project iets anders vereist. Er ontstaat geen arbeidsovereenkomst.`, `De ${K} stelt tijdig en kosteloos de informatie, inhoud en toegang beschikbaar die voor het project nodig zijn. Loopt het project vertraging op doordat deze medewerking ontbreekt, dan schuiven de termijnen dienovereenkomstig op.`, `De ${A} schakelt alleen derden in als de ${K} daarmee ${T} heeft ingestemd.`),
      dates: C_("Planning", `Het project begint op ${start}. De oplevering is gepland op ${end}.`, ms.length ? P_("Partijen spreken de volgende mijlpalen af:", ms) : ""),
      accept: C_("Acceptatie", `De ${A} meldt ${T} wanneer resultaten klaar zijn. De ${K} controleert ze binnen ${adays} dagen en keurt ze daarna goed of beschrijft de gevonden gebreken.`, `Kleine gebreken zijn geen reden om de goedkeuring te weigeren. De ${A} herstelt gemelde gebreken binnen een redelijke termijn.`, `De resultaten gelden als goedgekeurd als de ${K} de goedkeuring niet binnen deze termijn weigert met vermelding van ten minste één gebrek.${ccons ? ` Is de ${K} consument, dan geldt dit alleen als de ${A} bij de melding ${T} op dit gevolg heeft gewezen.` : ""}`),
      fee: C_("Vergoeding en betaling", (ft === "fixed" ? `Voor de afgesproken werkzaamheden ontvangt de ${A} een vaste vergoeding van ${fee}.` : `De ${A} rekent af op basis van bestede tijd tegen een ${ft === "hourly" ? "uurtarief" : "dagtarief"} van ${fee} en houdt de ${ft === "hourly" ? "uren" : "gewerkte dagen"} bij in een korte urenstaat.${cap ? ` Zonder toestemming van de ${K}, ${T}, bedraagt de totale vergoeding niet meer dan ${cap}.` : ""}`), vat,
        `De ${A} factureert de vergoeding ${msAmounts ? "telkens bij het bereiken van de mijlpalen onder Planning" : ft === "fixed" ? "na de acceptatie" : "maandelijks"}. Facturen moeten binnen ${days} dagen na ontvangst zonder aftrek worden betaald.`, `Reiskosten en andere onkosten worden alleen vergoed als de ${K} daar vooraf ${T} mee heeft ingestemd.`),
      rights: x.law === "DE" ? C_("Rechten op de resultaten", P_(`Na volledige betaling van de vergoeding verleent de ${A} de ${K} een ${excl ? "exclusief" : "niet-exclusief"} gebruiksrecht op de resultaten, onbeperkt in tijd en gebied, voor de volgende vormen van gebruik:`, uses),
          `De ${K} mag deze rechten aan derden overdragen of derden gebruiksrechten verlenen voor zover dat nodig is voor het eigen gebruik van de resultaten door de ${K}, bijvoorbeeld door drukkerijen of bureaus.`,
          `Het auteursrecht zelf blijft bij de ${A}, omdat het naar Duits recht niet overdraagbaar is (§ 29 UrhG). De ${K} krijgt de hierboven genoemde gebruiksrechten op grond van § 31 UrhG.`,
          `Tot de volledige betaling mag de ${K} de resultaten alleen gebruiken om ze te beoordelen.`,
          `Bevatten de resultaten onderdelen van derden, zoals lettertypen, afbeeldingen of opensourcesoftware, dan gelden daarvoor de licentievoorwaarden van die derden. De ${A} noemt deze onderdelen bij de oplevering.`,
          f.portfolio !== false ? `De ${A} mag de resultaten na publicatie als referentie tonen, bijvoorbeeld in het eigen portfolio. Vertrouwelijke inhoud valt daar niet onder.` : "",
          f.credit ? `De ${A} wordt als maker vermeld voor zover dat bij het betreffende gebruik gebruikelijk is (§ 13 UrhG).` : "")
        : C_("Rechten op de resultaten", assign ? `Na volledige betaling van de vergoeding draagt de ${A} alle auteursrechten en andere intellectuele eigendomsrechten op de resultaten over aan de ${K}, wereldwijd en voor de volledige beschermingsduur.` : P_(`Na volledige betaling van de vergoeding verleent de ${A} de ${K} een ${excl ? "exclusieve" : "niet-exclusieve"}, wereldwijde en onbeperkte licentie om de resultaten te gebruiken voor de volgende doelen:`, uses),
          assign ? "Deze overeenkomst is de ondertekende akte die de wet voor deze overdracht vereist." : `De ${A} behoudt het auteursrecht en de andere intellectuele eigendomsrechten op de resultaten.`,
          assign && !f.credit ? `De ${A} doet afstand van de persoonlijkheidsrechten op de resultaten, voor zover de wet dat toelaat.` : "",
          `Tot de volledige betaling mag de ${K} de resultaten alleen gebruiken om ze te beoordelen.`,
          `Bevatten de resultaten onderdelen van derden, zoals lettertypen, afbeeldingen of opensourcesoftware, dan gelden daarvoor de licentievoorwaarden van die derden. De ${A} noemt deze onderdelen bij de oplevering.`,
          f.portfolio !== false ? `De ${A} mag de resultaten na publicatie als referentie tonen, bijvoorbeeld in het eigen portfolio. Vertrouwelijke inhoud valt daar niet onder.` : "",
          f.credit ? `De ${A} wordt als maker vermeld voor zover dat bij het betreffende gebruik gebruikelijk is.` : ""),
      conf: C_("Geheimhouding", "Beide partijen houden vertrouwelijke informatie van de andere partij die zij in het kader van deze overeenkomst ontvangen geheim en gebruiken die alleen voor dit project. Deze plicht blijft gelden na het einde van de overeenkomst.", "Informatie is niet vertrouwelijk als die openbaar is, als een partij die al eerder rechtmatig kende of als die op grond van een wettelijke plicht moet worden bekendgemaakt."),
      term: C_("Duur en beëindiging", "De overeenkomst eindigt wanneer alle werkzaamheden zijn goedgekeurd en volledig zijn betaald.", `Elke partij kan de overeenkomst ${T} opzeggen om een gewichtige reden, zoals een ernstige tekortkoming van de andere partij.`, `Eindigt de overeenkomst voortijdig, dan ontvangt de ${A} de vergoeding voor de tot dan toe verrichte werkzaamheden. Verdere wettelijke aanspraken blijven onverlet.`)}
  }[lg];
  const t = L1;
  const notes = [];
  if (x.law === "DE" && f.rights === "assign") notes.push("Under German law copyright cannot be transferred, so the contract grants exclusive rights of use instead (§§ 29, 31 UrhG).");
  if (x.meEntity === "de-private" && x.meRoleKey === "contractor") notes.push("You are set up as a private person with nothing registered. Regular paid work usually needs a registration (Finanzamt, and the Gewerbeamt for a trade) before you invoice.");
  if (f.vat === "small" && x.meRoleKey === "contractor") notes.push("The VAT sentence assumes the small business rule. Check that it applies to you.");
  return {title: t.title, recitals: t.rec.concat(x.otherConsumer ? [consumerRecital(x, x.otherRole)] : []).map(s => ({text: s})),
    clauses: [t.scope, t.work, t.dates, t.accept, t.fee, t.rights, t.conf, liabilityClause(x), t.term], schedule: null, notes};
}

// Liability, mutual, written per law because each one has different hard limits
function liabilityClause(x) {
  const lg = x.lang;
  if (x.law === "DE") return {
    de: C_("Haftung", "Die Parteien haften einander unbeschränkt bei Vorsatz und grober Fahrlässigkeit, bei Verletzung von Leben, Körper oder Gesundheit, nach dem Produkthaftungsgesetz und soweit eine Garantie übernommen wurde.", "Bei leicht fahrlässiger Verletzung einer wesentlichen Vertragspflicht ist die Haftung auf den vertragstypischen, vorhersehbaren Schaden begrenzt. Wesentlich ist eine Pflicht, deren Erfüllung die ordnungsgemäße Durchführung des Vertrags erst möglich macht und auf deren Einhaltung die andere Partei regelmäßig vertrauen darf.", "Im Übrigen ist die Haftung für leichte Fahrlässigkeit ausgeschlossen."),
    en: C_("Liability", "The parties are liable to each other without limit for intent and gross negligence, for injury to life, body or health, under the German Product Liability Act and where a guarantee was given.", "For a slightly negligent breach of an essential contractual duty, liability is limited to the damage that is typical for this kind of contract and foreseeable. An essential duty is one whose fulfilment makes proper performance of the agreement possible in the first place and on which the other party may regularly rely.", "Otherwise, liability for slight negligence is excluded."),
    nl: C_("Aansprakelijkheid", "Partijen zijn jegens elkaar onbeperkt aansprakelijk bij opzet en grove nalatigheid, bij letsel aan leven, lichaam of gezondheid, op grond van de Duitse productaansprakelijkheidswet en voor zover een garantie is gegeven.", "Bij een licht nalatige schending van een wezenlijke contractuele verplichting is de aansprakelijkheid beperkt tot de schade die voor dit soort overeenkomsten typisch en voorzienbaar is. Wezenlijk is een verplichting waarvan de nakoming de goede uitvoering van de overeenkomst pas mogelijk maakt en op de naleving waarvan de andere partij normaal gesproken mag vertrouwen.", "Voor het overige is de aansprakelijkheid voor lichte nalatigheid uitgesloten.")}[lg];
  if (x.law === "NL") return {
    de: C_("Haftung", "Die Haftung der Parteien untereinander ist auf die Höhe der Vergütung aus diesem Vertrag begrenzt.", "Diese Begrenzung gilt nicht bei Vorsatz oder bewusster Leichtfertigkeit und nicht für Schäden aus der Verletzung von Leben oder Gesundheit.", "Keine Partei haftet für mittelbare Schäden wie entgangenen Gewinn, außer bei Vorsatz oder bewusster Leichtfertigkeit.", "Ist eine Partei Verbraucher, bleiben ihre gesetzlichen Rechte unberührt."),
    en: C_("Liability", "The liability of the parties to each other is limited to the amount of the fee under this agreement.", "This limit does not apply in case of intent or deliberate recklessness, or to damage caused by death or personal injury.", "Neither party is liable for indirect loss, such as loss of profit, except in case of intent or deliberate recklessness.", "If a party is a consumer, their statutory rights are not affected."),
    nl: C_("Aansprakelijkheid", "De aansprakelijkheid van partijen jegens elkaar is beperkt tot het bedrag van de vergoeding op grond van deze overeenkomst.", "Deze beperking geldt niet bij opzet of bewuste roekeloosheid, en niet voor schade door overlijden of letsel.", "Geen van de partijen is aansprakelijk voor indirecte schade, zoals gederfde winst, behalve bij opzet of bewuste roekeloosheid.", "Is een partij consument, dan blijven haar wettelijke rechten onverlet.")}[lg];
  return {
    de: C_("Haftung", "Dieser Vertrag beschränkt oder schließt die Haftung nicht aus für Tod oder Körperverletzung durch Fahrlässigkeit, für Betrug oder arglistige Täuschung oder für jede andere Haftung, die gesetzlich nicht beschränkt oder ausgeschlossen werden kann.", "Im Übrigen haftet keine Partei für mittelbare Schäden oder Folgeschäden, und die Gesamthaftung jeder Partei aus diesem Vertrag ist auf die insgesamt geschuldete Vergütung begrenzt.", "Ist eine Partei Verbraucher, bleiben ihre gesetzlichen Rechte unberührt."),
    en: C_("Liability", "Nothing in this agreement limits or excludes liability for death or personal injury caused by negligence, for fraud or fraudulent misrepresentation, or any other liability that cannot be limited or excluded by law.", "Subject to that, neither party is liable for indirect or consequential loss, and each party's total liability under this agreement is limited to the total fee payable under it.", "If a party is a consumer, their statutory rights are not affected."),
    nl: C_("Aansprakelijkheid", "Niets in deze overeenkomst beperkt of sluit aansprakelijkheid uit voor overlijden of letsel door nalatigheid, voor fraude of bedrog, of voor andere aansprakelijkheid die wettelijk niet kan worden beperkt of uitgesloten.", "Daarnaast is geen van de partijen aansprakelijk voor indirecte schade of gevolgschade, en is de totale aansprakelijkheid van elke partij op grond van deze overeenkomst beperkt tot de totale vergoeding die op grond ervan verschuldigd is.", "Is een partij consument, dan blijven haar wettelijke rechten onverlet.")}[lg];
}

/* ---------------------------------------------------------------- non-disclosure agreement */
function tplNda(x) {
  const lg = x.lang, f = x.f, mutual = x.typeRole === "mutual";
  const purpose = String(f.purpose || "").trim() || {de: "[Vorhaben]", en: "[subject of the talks]", nl: "[onderwerp van de gesprekken]"}[lg];
  const y = Math.max(1, Math.round(+f.years || 3));
  const ER = {de: "Empfangende Partei", en: "Receiving Party", nl: "Ontvangende Partij"}[lg], OR = {de: "Offenlegende Partei", en: "Disclosing Party", nl: "Verstrekkende Partij"}[lg];
  const T = tf(x);
  const t = {
    de: {title: "Vertraulichkeitsvereinbarung", cl: [
      C_("Zweck", `Die Parteien führen Gespräche über folgendes Vorhaben: ${purpose} (der „Zweck“). ${mutual ? "Dafür tauschen sie vertrauliche Informationen aus." : `Dafür gibt die ${OR} vertrauliche Informationen an die ${ER} weiter.`}`),
      C_("Vertrauliche Informationen", P_("Vertrauliche Informationen sind alle Informationen, die im Zusammenhang mit dem Zweck mündlich, schriftlich oder elektronisch zugänglich gemacht werden und die als vertraulich gekennzeichnet sind oder deren Vertraulichkeit sich aus den Umständen ergibt. Dazu gehören insbesondere:", ["Geschäfts- und Projektpläne, Ideen und Konzepte", "Entwürfe, Quellcode, Daten und technische Unterlagen", "Kunden-, Preis- und Finanzinformationen"]),
        mutual ? `${ER} ist jeweils die Partei, die vertrauliche Informationen erhält, ${OR} die Partei, die sie weitergibt.` : "",
        P_("Nicht vertraulich sind Informationen, die", ["öffentlich bekannt sind oder ohne Verstoß gegen diese Vereinbarung öffentlich bekannt werden,", `der ${ER} vor der Offenlegung bereits rechtmäßig bekannt waren,`, `die ${ER} rechtmäßig von Dritten ohne Pflicht zur Vertraulichkeit erhalten hat oder`, `die ${ER} selbst unabhängig entwickelt hat.`])),
      C_("Pflichten der Empfangenden Partei", `Die ${ER} hält vertrauliche Informationen geheim, nutzt sie nur für den Zweck und schützt sie mindestens so sorgfältig wie eigene vertrauliche Informationen, mindestens aber mit angemessener Sorgfalt.`, `Die ${ER} gibt vertrauliche Informationen nur an Personen weiter, die sie für den Zweck kennen müssen und die ihrerseits zur Vertraulichkeit verpflichtet sind.`, `Muss die ${ER} vertrauliche Informationen aufgrund einer gesetzlichen Pflicht oder einer behördlichen oder gerichtlichen Anordnung offenlegen, informiert sie die ${OR} vorher, soweit das erlaubt ist.`),
      C_("Rückgabe und Löschung", `Auf Verlangen der ${OR} gibt die ${ER} vertrauliche Informationen zurück oder löscht sie und bestätigt das ${T}. Gesetzliche Aufbewahrungspflichten und automatische Sicherungskopien bleiben unberührt. Für sie gilt diese Vereinbarung weiter.`),
      C_("Keine Rechte, keine Pflicht zum Vertragsschluss", "Diese Vereinbarung räumt keine Rechte an vertraulichen Informationen ein, insbesondere keine Nutzungs- oder Lizenzrechte. Keine Partei ist verpflichtet, Informationen offenzulegen oder einen weiteren Vertrag zu schließen."),
      C_("Laufzeit", `Diese Vereinbarung gilt ab ihrer Unterzeichnung. Die Pflichten zur Vertraulichkeit enden ${y} ${y === 1 ? "Jahr" : "Jahre"} nach der letzten Offenlegung. Für Geschäftsgeheimnisse${x.law === "DE" ? " im Sinne des Geschäftsgeheimnisgesetzes" : ""} gelten sie, solange die Information ein Geschäftsgeheimnis ist.`)]},
    en: {title: "Non-disclosure agreement", cl: [
      C_("Purpose", `The parties are in talks about the following: ${purpose} (the “Purpose”). ${mutual ? "For this, they exchange confidential information." : `For this, the ${OR} shares confidential information with the ${ER}.`}`),
      C_("Confidential information", P_("Confidential information is all information made available orally, in writing or electronically in connection with the Purpose that is marked as confidential or is clearly confidential from the circumstances. In particular, this includes:", ["business and project plans, ideas and concepts", "designs, source code, data and technical documents", "customer, pricing and financial information"]),
        mutual ? `The ${ER} is the party that receives confidential information and the ${OR} is the party that shares it.` : "",
        P_("Information is not confidential if it", ["is public or becomes public without a breach of this agreement,", `was already lawfully known to the ${ER} before it was disclosed,`, `was lawfully received by the ${ER} from a third party without a duty of confidentiality, or`, `was developed independently by the ${ER}.`])),
      C_("Duties of the Receiving Party", `The ${ER} keeps confidential information secret, uses it only for the Purpose and protects it at least as carefully as its own confidential information, and in any case with reasonable care.`, `The ${ER} shares confidential information only with people who need to know it for the Purpose and who are themselves bound to confidentiality.`, `If the ${ER} must disclose confidential information by law or by order of an authority or court, it tells the ${OR} in advance where this is allowed.`),
      C_("Return and deletion", `At the ${OR}'s request, the ${ER} returns or deletes confidential information and confirms this ${T}. Statutory retention duties and automatic backups are not affected. This agreement continues to apply to them.`),
      C_("No rights, no obligation", "This agreement grants no rights in confidential information, in particular no licence. Neither party is obliged to disclose information or to enter into any further agreement."),
      C_("Term", `This agreement applies from signature. The confidentiality duties end ${y} ${y === 1 ? "year" : "years"} after the last disclosure. For trade secrets they continue for as long as the information remains a trade secret.`)]},
    nl: {title: "Geheimhoudingsovereenkomst", cl: [
      C_("Doel", `Partijen voeren gesprekken over het volgende: ${purpose} (het “Doel”). ${mutual ? "Daarvoor wisselen zij vertrouwelijke informatie uit." : `Daarvoor deelt de ${OR} vertrouwelijke informatie met de ${ER}.`}`),
      C_("Vertrouwelijke informatie", P_("Vertrouwelijke informatie is alle informatie die in verband met het Doel mondeling, schriftelijk of elektronisch wordt verstrekt en die als vertrouwelijk is aangemerkt of waarvan het vertrouwelijke karakter uit de omstandigheden blijkt. Daartoe behoren in het bijzonder:", ["bedrijfs- en projectplannen, ideeën en concepten", "ontwerpen, broncode, gegevens en technische documenten", "klant-, prijs- en financiële informatie"]),
        mutual ? `${ER} is steeds de partij die vertrouwelijke informatie ontvangt, ${OR} de partij die deze verstrekt.` : "",
        P_("Informatie is niet vertrouwelijk als zij", ["openbaar is of openbaar wordt zonder schending van deze overeenkomst,", `al rechtmatig bekend was bij de ${ER} voordat zij werd verstrekt,`, `door de ${ER} rechtmatig van een derde is ontvangen zonder geheimhoudingsplicht, of`, `door de ${ER} zelfstandig is ontwikkeld.`])),
      C_("Plichten van de Ontvangende Partij", `De ${ER} houdt vertrouwelijke informatie geheim, gebruikt die alleen voor het Doel en beschermt die minstens zo zorgvuldig als haar eigen vertrouwelijke informatie, en in elk geval met redelijke zorg.`, `De ${ER} deelt vertrouwelijke informatie alleen met personen die deze voor het Doel moeten kennen en die zelf tot geheimhouding verplicht zijn.`, `Moet de ${ER} vertrouwelijke informatie bekendmaken op grond van een wettelijke plicht of een bevel van een overheid of rechter, dan informeert zij de ${OR} vooraf, voor zover dat is toegestaan.`),
      C_("Teruggave en verwijdering", `Op verzoek van de ${OR} geeft de ${ER} vertrouwelijke informatie terug of verwijdert zij die, en bevestigt zij dat ${T}. Wettelijke bewaarplichten en automatische back-ups blijven onverlet. Voor die gegevens blijft deze overeenkomst gelden.`),
      C_("Geen rechten, geen verplichting", "Deze overeenkomst geeft geen rechten op vertrouwelijke informatie, in het bijzonder geen licentie. Geen van de partijen is verplicht informatie te verstrekken of een verdere overeenkomst te sluiten."),
      C_("Duur", `Deze overeenkomst geldt vanaf ondertekening. De geheimhoudingsplichten eindigen ${y} jaar na de laatste verstrekking. Voor bedrijfsgeheimen blijven zij gelden zolang de informatie een bedrijfsgeheim is.`)]}
  }[lg];
  return {title: t.title, recitals: [], clauses: t.cl, schedule: null, notes: []};
}

/* ---------------------------------------------------------------- sale of a used item */
function tplSale(x) {
  const lg = x.lang, f = x.f, V = x.R("seller"), K = x.R("buyer");
  const item = String(f.item || "").trim() || {de: "[Gegenstand]", en: "[item]", nl: "[artikel]"}[lg];
  const serial = String(f.serial || "").trim(), acc = String(f.accessories || "").trim();
  const defects = endDot(f.defects) || {de: "[bekannte Mängel, oder: keine bekannten Mängel]", en: "[known defects, or: no known defects]", nl: "[bekende gebreken, of: geen bekende gebreken]"}[lg];
  const price = x.money(f.price), date = x.date(f.handover), place = String(f.place || "").trim() || ph_("city", lg);
  const consumerSale = x.sellerBusiness && x.buyerConsumer;
  const cash = f.pay !== "transfer";
  const t = {
    de: {title: "Kaufvertrag über einen gebrauchten Gegenstand", cl: [
      C_("Kaufgegenstand", `Der ${V} verkauft dem ${K} den folgenden gebrauchten Gegenstand: ${item}${serial ? `, Serien- oder Identnummer ${serial}` : ""}.`, acc ? `Zum Kauf gehört folgendes Zubehör: ${endDot(acc)}` : "", `Der Gegenstand hat folgende bekannte Mängel und Gebrauchsspuren: ${defects}`),
      C_("Kaufpreis und Zahlung", `Der Kaufpreis beträgt ${price}.`, cash ? `Der ${K} zahlt den Kaufpreis bei der Übergabe in bar.` : `Der ${K} überweist den Kaufpreis vor der Übergabe auf ein Konto, das der ${V} benennt. Die Übergabe erfolgt, sobald der Betrag gutgeschrieben ist.`),
      C_("Übergabe und Eigentum", `Die Übergabe erfolgt am ${date} in ${place}.`, `Das Eigentum geht mit vollständiger Zahlung des Kaufpreises auf den ${K} über. Mit der Übergabe geht die Gefahr auf den ${K} über.`),
      consumerSale ? C_("Zustand und Mängel", `Für Mängel gelten die gesetzlichen Rechte des ${K}s. Die oben beschriebenen Mängel und Gebrauchsspuren sind bekannt und vereinbart.`)
        : x.law === "DE" ? C_("Zustand und Mängel", `Der Gegenstand wird verkauft, wie er bei der Besichtigung stand. Die Haftung des ${V}s für Sachmängel ist ausgeschlossen.`, `Dieser Ausschluss gilt nicht für Mängel, die der ${V} arglistig verschwiegen hat, nicht für die in diesem Vertrag beschriebene Beschaffenheit, nicht für Schäden aus der Verletzung von Leben, Körper oder Gesundheit und nicht für Schäden aus vorsätzlicher oder grob fahrlässiger Pflichtverletzung des ${V}s.`)
        : C_("Zustand und Mängel", `Der Gegenstand wird verkauft, wie er bei der Besichtigung stand. Der ${V} steht dafür ein, dass die Beschreibung in diesem Vertrag zutrifft. Im Übrigen haftet der ${V} nicht für Mängel.`, `Das gilt nicht für Mängel, die der ${V} kannte und verschwiegen hat, nicht bei Vorsatz oder grober Fahrlässigkeit und nicht für Tod oder Körperverletzung.`),
      C_("Zusicherungen des Verkäufers", `Der ${V} versichert, Eigentümer des Gegenstands zu sein und dass der Gegenstand frei von Rechten Dritter ist.`)]},
    en: {title: "Sale agreement for a used item", cl: [
      C_("The item", `The ${V} sells the following used item to the ${K}: ${item}${serial ? `, serial or identification number ${serial}` : ""}.`, acc ? `The sale includes the following accessories: ${endDot(acc)}` : "", `The item has the following known defects and signs of use: ${defects}`),
      C_("Price and payment", `The purchase price is ${price}.`, cash ? `The ${K} pays the price in cash on handover.` : `The ${K} pays the price by bank transfer to an account named by the ${V} before handover. Handover takes place once the amount has been credited.`),
      C_("Handover and ownership", `Handover takes place on ${date} at ${place}.`, `Ownership passes to the ${K} once the price has been paid in full. Risk passes to the ${K} on handover.`),
      consumerSale ? C_("Condition and defects", `The ${K}'s statutory rights for defects apply. The defects and signs of use described above are known and accepted.`)
        : x.law === "DE" ? C_("Condition and defects", `The item is sold as inspected. The ${V}'s liability for defects is excluded.`, `This exclusion does not apply to defects the ${V} fraudulently concealed, to the condition described in this agreement, to damage from injury to life, body or health, or to damage caused by an intentional or grossly negligent breach of duty by the ${V}.`)
        : C_("Condition and defects", `The item is sold as seen. The ${V} is responsible for the description in this agreement being accurate. Apart from that, the ${V} is not liable for defects.`, `This does not apply to defects the ${V} knew of and concealed, to intent or gross negligence, or to death or personal injury.`),
      C_("Assurances by the seller", `The ${V} confirms owning the item and that the item is free of third-party rights.`)]},
    nl: {title: "Koopovereenkomst voor een gebruikt artikel", cl: [
      C_("Het artikel", `De ${V} verkoopt aan de ${K} het volgende gebruikte artikel: ${item}${serial ? `, serie- of identificatienummer ${serial}` : ""}.`, acc ? `Bij de koop horen de volgende accessoires: ${endDot(acc)}` : "", `Het artikel heeft de volgende bekende gebreken en gebruikssporen: ${defects}`),
      C_("Koopprijs en betaling", `De koopprijs bedraagt ${price}.`, cash ? `De ${K} betaalt de koopprijs contant bij de overdracht.` : `De ${K} maakt de koopprijs vóór de overdracht over naar een rekening die de ${V} opgeeft. De overdracht vindt plaats zodra het bedrag is bijgeschreven.`),
      C_("Overdracht en eigendom", `De overdracht vindt plaats op ${date} in ${place}.`, `De eigendom gaat over op de ${K} zodra de koopprijs volledig is betaald. Het risico gaat bij de overdracht over op de ${K}.`),
      consumerSale ? C_("Staat en gebreken", `Voor gebreken gelden de wettelijke rechten van de ${K}. De hierboven beschreven gebreken en gebruikssporen zijn bekend en geaccepteerd.`)
        : x.law === "DE" ? C_("Staat en gebreken", `Het artikel wordt verkocht zoals bezichtigd. De aansprakelijkheid van de ${V} voor gebreken is uitgesloten.`, `Deze uitsluiting geldt niet voor gebreken die de ${V} bewust heeft verzwegen, niet voor de in deze overeenkomst beschreven staat, niet voor schade door letsel aan leven, lichaam of gezondheid en niet voor schade door een opzettelijke of grof nalatige plichtsschending van de ${V}.`)
        : C_("Staat en gebreken", `Het artikel wordt verkocht in de staat waarin het zich bij de bezichtiging bevond. De ${V} staat in voor de juistheid van de beschrijving in deze overeenkomst. Voor het overige is de ${V} niet aansprakelijk voor gebreken.`, `Dit geldt niet voor gebreken die de ${V} kende en heeft verzwegen, niet bij opzet of bewuste roekeloosheid en niet voor overlijden of letsel.`),
      C_("Verklaringen van de verkoper", `De ${V} verklaart eigenaar van het artikel te zijn en dat er geen rechten van derden op rusten.`)]}
  }[lg];
  const notes = [];
  if (consumerSale) notes.push("A business selling to a consumer cannot exclude liability for defects. In Germany the limitation period for used goods can only be shortened to one year by a separate, express agreement (§ 476 BGB). The template keeps the statutory rights.");
  return {title: t.title, recitals: [], clauses: t.cl, schedule: null, notes, cisg: true};
}

/* ---------------------------------------------------------------- outline only types, the facts go in as first sentences and the rest is yours to write */
const SKEL = {
  licence: {title: {de: "Lizenzvertrag über Marke und Logo", en: "Brand and logo licence agreement", nl: "Licentieovereenkomst voor merk en logo"},
    cl: [["Lizenzgegenstand", "Licensed marks and materials", "Licentieobject", "subject"], ["Einräumung der Lizenz", "Grant of the licence", "Verlening van de licentie", "grant"], ["Markenrichtlinien und Qualität", "Brand guidelines and quality", "Merkrichtlijnen en kwaliteit"], ["Lizenzgebühr", "Fee", "Licentievergoeding", "fee"], ["Inhaberschaft und Schutz der Marke", "Ownership and protection", "Eigendom en bescherming van het merk"], ["Laufzeit und Kündigung", "Term and termination", "Duur en beëindiging", "term"], ["Folgen der Beendigung", "After the licence ends", "Gevolgen van beëindiging"], ["Haftung", "Liability", "Aansprakelijkheid"]]},
  contributor: {title: {de: "Vereinbarung über Rechte an einem Werk", en: "Contributor rights agreement", nl: "Overeenkomst over rechten op een werk"},
    cl: [["Werk", "The work", "Het werk", "work"], ["Vergütung", "Fee", "Vergoeding", "fee"], ["Rechte am Werk", "Rights in the work", "Rechten op het werk"], ["Namensnennung", "Credit and moral rights", "Naamsvermelding", "credit"], ["Zusicherungen des Urhebers", "Assurances by the maker", "Verklaringen van de maker"], ["Portfolio", "Portfolio use", "Portfolio"], ["Vertraulichkeit", "Confidentiality", "Geheimhouding"], ["Haftung", "Liability", "Aansprakelijkheid"]]},
  custom: {title: {de: "Vertrag", en: "Agreement", nl: "Overeenkomst"},
    cl: [["Gegenstand", "Subject", "Onderwerp"], ["Weitere Regelungen", "Further terms", "Overige afspraken"]]}
};
function tplSkeleton(x) {
  const lg = x.lang, f = x.f, s = SKEL[x.type];
  const li = {de: 0, en: 1, nl: 2}[lg];
  const hint = {de: "[Text dieser Klausel]", en: "[text of this clause]", nl: "[tekst van deze bepaling]"}[lg];
  // Where a fact exists we put it in as a first sentence so the outline is still useful offline
  const fact = k => {
    if (x.type === "licence" && k === "subject" && f.subject) return {de: `Gegenstand der Lizenz ist: ${endDot(f.subject)}`, en: `This licence covers: ${endDot(f.subject)}`, nl: `Deze licentie betreft: ${endDot(f.subject)}`}[lg];
    if (x.type === "licence" && k === "grant") return {de: `Die Lizenz ist ${f.exclusive ? "ausschließlich" : "einfach"} und gilt für ${String(f.territory || "").trim() || "[Gebiet]"}. Zweck: ${String(f.purpose || "").trim() || "[Zweck]"}.`, en: `The licence is ${f.exclusive ? "exclusive" : "non-exclusive"} and covers ${String(f.territory || "").trim() || "[territory]"}. Purpose: ${String(f.purpose || "").trim() || "[purpose]"}.`, nl: `De licentie is ${f.exclusive ? "exclusief" : "niet-exclusief"} en geldt voor ${String(f.territory || "").trim() || "[gebied]"}. Doel: ${String(f.purpose || "").trim() || "[doel]"}.`}[lg];
    if (x.type === "licence" && k === "fee") return String(f.fee || "").trim() ? {de: `Die Lizenzgebühr beträgt ${x.money(f.fee)}.`, en: `The licence fee is ${x.money(f.fee)}.`, nl: `De licentievergoeding bedraagt ${x.money(f.fee)}.`}[lg] : {de: "Die Lizenz ist kostenlos.", en: "The licence is free of charge.", nl: "De licentie is kosteloos."}[lg];
    if (x.type === "licence" && k === "term") return f.end ? {de: `Die Lizenz gilt vom ${x.date(f.start)} bis zum ${x.date(f.end)}.`, en: `The licence runs from ${x.date(f.start)} to ${x.date(f.end)}.`, nl: `De licentie loopt van ${x.date(f.start)} tot en met ${x.date(f.end)}.`}[lg] : {de: `Die Lizenz gilt ab dem ${x.date(f.start)} auf unbestimmte Zeit.`, en: `The licence runs from ${x.date(f.start)} with no fixed end.`, nl: `De licentie geldt vanaf ${x.date(f.start)} voor onbepaalde tijd.`}[lg];
    if (x.type === "contributor" && k === "work" && f.work) return {de: `Das Werk ist: ${endDot(f.work)}`, en: `The work is: ${endDot(f.work)}`, nl: `Het werk is: ${endDot(f.work)}`}[lg];
    if (x.type === "contributor" && k === "fee") return {de: `Die Vergütung beträgt ${x.money(f.fee)} und ist am ${x.date(f.due)} fällig.`, en: `The fee is ${x.money(f.fee)}, due on ${x.date(f.due)}.`, nl: `De vergoeding bedraagt ${x.money(f.fee)} en is verschuldigd op ${x.date(f.due)}.`}[lg];
    if (x.type === "contributor" && k === "credit") return f.credit ? {de: "Der Urheber wird bei der Nutzung des Werks genannt, soweit das üblich ist.", en: "The maker is named as the author where this is usual.", nl: "De maker wordt vermeld voor zover dat gebruikelijk is."}[lg] : "";
    return "";
  };
  let title = s.title[lg];
  if (x.type === "custom" && String(f.title || "").trim()) title = String(f.title).trim();
  const cl = s.cl.map(c => C_(c[li], fact(c[3]) || hint, fact(c[3]) ? hint : ""));
  // Liability is the last outline clause for both of these, the real wording per law slots in there
  if (x.type === "contributor" || x.type === "licence") cl[cl.length - 1] = liabilityClause(x);
  return {title, recitals: [], clauses: cl, schedule: null, notes: ["This type gives the outline with the facts you entered. Press Write out the clauses and fill in the [bracketed] parts yourself."]};
}
const TPL = {payment: tplPayment, repay: tplRepay, service: tplService, nda: tplNda, sale: tplSale, licence: tplSkeleton, contributor: tplSkeleton, custom: tplSkeleton};

export { L, LANG_ADJ, UK_PART, PH, ph_, ROLE, TYPES, TYPE, PLAN_TYPES, TPL, finalClause, repaySchedule };
