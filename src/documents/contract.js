// Contracts, the third kind of paperwork. The wording comes from contract-templates.js (ported from the Contract
// Builder), this file is the bit around it: the form for each contract type, the parties from My details and the
// other party fields, the context the templates need and the A4 page.
//
// Two ways of working with the clauses. By default theyre written from the facts every time, so changing an amount
// or a date changes the text everywhere it apears. Once you press Write out the clauses they get copied into the
// form as plain text and from then on thats what gets printed, you can edit, reorder, remove or add clauses and the
// facts only change the parties and the payment schedule table. Clearing the clauses list goes back to the facts.
import { esc, formatIban, withPlaceholders } from "./format.js";
import { LANG_FIELD } from "./letter.js";
import { footerColumns } from "./page.js";
import { businessType, cityLine as businessCityLine, defaultCurrency, senderName } from "./business.js";
import {
  L, ph_, ROLE, TYPES, TYPE, PLAN_TYPES, TPL, UK_PART, cap, finalClause, firstOfNextMonth, fmtCents, fmtDate,
  paySchedule, parseMoney, repaySchedule
} from "./contract-templates.js";

const LAWS = { DE: "German law", UK: "UK law (England and Wales, Scotland or Northern Ireland from My details)", NL: "Dutch law", US: "The law of a US state" };
const CURRENCIES = ["EUR", "GBP", "USD"];
// The roles where you could be a consumer yourself, a private person paying, buying or hiring someone
const ME_CONSUMER_ROLES = ["debtor", "client", "seller", "buyer", "licensee", "brand"];
const NOT_ADVICE = "A template, not legal advice. Check it fits before anyone signs, and get it looked at for anything big.";

export const CONTRACT_TYPES = TYPES.map((t) => ({ id: t.id, label: t.label, hint: t.hint }));

const clean = (v) => String(v ?? "").trim();

/* ------------------------------------------------------------------ the form */

// The builder's fact fields turned into admin fields. Notes become the help text of the field after them
function factFields(type) {
  const out = [];
  let note = "";
  for (const fd of type.facts.flatMap((x) => x.row || [x])) {
    if (fd.kind === "note") { note = note ? `${note} ${fd.text}` : fd.text; continue; }
    const help = [note, fd.hint, fd.ph ? `For example: ${fd.ph.replace(/\n/g, " / ")}` : ""].filter(Boolean).join(" ");
    note = "";
    // the form adds (optional) itself, so the builder's own one comes off
    const field = { name: fd.k, label: fd.label.replace(/\s*\(optional\)/i, "") };
    if (fd.kind === "textarea") field.type = "textarea";
    else if (fd.kind === "date") field.type = "date";
    else if (fd.kind === "number") Object.assign(field, { type: "text", number: true });
    else if (fd.kind === "money") Object.assign(field, { type: "text", help: "120 or 1.250,50" });
    else if (fd.kind === "select") Object.assign(field, { type: "select", required: true, options: fd.opts.map((o) => o[0]), labels: Object.fromEntries(fd.opts) });
    else if (fd.kind === "check") Object.assign(field, { type: "checkbox", default: fd.def === true });
    else field.type = "text";
    if (help) field.help = field.help ? `${help} ${field.help}` : help;
    out.push(field);
  }
  return out;
}

/** The fields of a contract, they depend on its type, which is picked when its made and stays */
export function contractFields(data = {}, accounts = []) {
  const type = TYPE(data.type);
  const plan = PLAN_TYPES.includes(type.id);
  const fields = [
    LANG_FIELD,
    { name: "role", label: "Your side", type: "select", required: true, options: type.roles.map((r) => r.id), labels: Object.fromEntries(type.roles.map((r) => [r.id, r.label])) },
    { name: "law", label: "Law", type: "select", required: true, options: Object.keys(LAWS), labels: LAWS, help: "Defaults to the country of your business type" },
    { name: "us_state", label: "US state", type: "text", help: "Only for US law" },
    { name: "currency", label: "Currency", type: "select", required: true, options: CURRENCIES },
    { name: "other", label: "The other party", type: "object", fields: [
      { name: "kind", label: "They are", type: "select", required: true, options: ["consumer", "business"], labels: { consumer: "A private person (consumer)", business: "A business" } },
      { name: "name", label: "Name or company name", type: "text" },
      { name: "register", label: "Register entry (businesses)", type: "text", help: "For example: Amtsgericht München, HRB 123456" },
      { name: "rep", label: "Represented by (businesses)", type: "text", help: "Who signs for them" },
      { name: "street", label: "Street and number", type: "text" },
      { name: "postcode", label: "Postcode", type: "text" },
      { name: "city", label: "City", type: "text" },
      { name: "country", label: "Country", type: "text", help: "Leave empty when its the same as yours" }
    ] },
    { name: "facts", label: type.label, type: "object", help: type.hint, fields: factFields(type) }
  ];
  if (plan) {
    fields.push(
      { name: "account", label: "Your bank account (when you are owed the money)", type: "select", options: accounts.map((a) => a.label).filter(Boolean), help: "From Payment accounts. Empty uses the default one" },
      { name: "other_bank", label: "Their bank account (when they are owed the money)", type: "object", fields: [
        { name: "holder", label: "Account holder", type: "text" },
        { name: "bank", label: "Bank", type: "text" },
        { name: "iban", label: "IBAN", type: "text", iban: true },
        { name: "bic", label: "BIC", type: "text" }
      ] }
    );
  }
  fields.push(
    { name: "title", label: "Title", type: "text", max: 200, help: "Empty uses the standard title for this contract" },
    { name: "recitals", label: "Background (once written out)", type: "textarea", max: 5000, help: "Only used when the clauses are written out. An empty line starts the next point" },
    { name: "clauses", label: "Clauses (once written out)", type: "objects", itemLabel: "heading", singular: "clause", help: "Empty means the clauses are written from the facts and follow them. Press Write out the clauses to get them here to edit, reorder, remove or add to. Clear the list to go back to the facts.", fields: [
      { name: "heading", label: "Heading", type: "text", max: 200 },
      { name: "text", label: "Text", type: "textarea", max: 20000, help: "An empty line starts the next numbered paragraph, lines starting with - become (a), (b) and so on. [Square brackets] are still to fill in" },
      ...(plan ? [{ name: "schedule", label: "The payment schedule table goes after this clause", type: "checkbox" }] : [])
    ] }
  );
  return fields;
}

/** The facts with the type's defaults for anything not filled in yet */
function factsOf(type, facts = {}) {
  const f = { ...facts };
  for (const fd of type.facts.flatMap((x) => x.row || [x])) {
    if (fd.k && (f[fd.k] === undefined || f[fd.k] === "") && fd.def !== undefined) f[fd.k] = fd.def === "firstOfNextMonth" ? firstOfNextMonth() : fd.def;
  }
  return f;
}

/* ------------------------------------------------------------------ you and them */

const isCompany = (t) => Boolean(t.legal_form_default);

// Which of your details a business type shows on a contract, the same rules the builder had. Nothing tax related
function mine(details, key) {
  const t = businessType(details.entity);
  const tok = t.letter || [];
  const show = ["full_name", "street", "postcode", "city", "email", "phone", "web"].includes(key)
    || (key === "trading_name" && t.id !== "de-private")
    || (key === "legal_form" && isCompany(t))
    || (key === "seat" && tok.includes("seat"))
    || ((key === "register_court" || key === "register_number") && (tok.includes("register_court") || tok.includes("register_number")))
    || (key === "directors" && isCompany(t))
    || (["company_number", "registered_office", "registered_in", "kvk"].includes(key) && tok.includes(key));
  return show ? clean(details[key]) : "";
}

function firmName(details, lang) {
  const t = businessType(details.entity);
  const name = mine(details, "full_name") || ph_("name", lang);
  if (isCompany(t)) {
    const lf = mine(details, "legal_form") || t.legal_form_default;
    const base = mine(details, "trading_name") || ph_("company", lang);
    return base.endsWith(lf) ? base : `${base} ${lf}`;
  }
  if (t.id === "de-ek") { const base = mine(details, "trading_name") || name; return base.endsWith("e.K.") ? base : `${base} e.K.`; }
  return mine(details, "trading_name") || name;
}

/** Your lines in the parties block, with the register details a company has to give */
export function meLines(details, lang) {
  const t = businessType(details.entity), l = L[lang], M = (k) => mine(details, k);
  const name = M("full_name") || ph_("name", lang);
  const addr = [M("street") || ph_("street", lang), businessCityLine(details, t) || ph_("pcity", lang), l.countries[t.country]];
  const signer = M("directors") || ph_("dirs", lang);
  if (t.id === "de-ug" || t.id === "de-gmbh") return [firmName(details, lang), ...addr, l.regDE(M("register_court") || ph_("court", lang), M("register_number") || ph_("regno", lang)), `${cap(l.rep)}: ${signer}`];
  if (t.id === "de-ek") return [firmName(details, lang), `${cap(l.owner)}: ${name}`, ...addr, l.regDE(M("register_court") || ph_("court", lang), M("register_number") || ph_("regno", lang))];
  if (t.id === "uk-ltd") {
    const part = M("registered_in") || "England and Wales";
    const partL = (UK_PART[part] || {})[lang] || part;
    const office = M("registered_office");
    return [firmName(details, lang), l.regUK(partL, M("company_number") || ph_("compno", lang)), ...(office ? [`${cap(l.regoff)}: ${office}`] : addr), `${cap(l.rep)}: ${signer}`];
  }
  if (t.id === "nl-bv") return [firmName(details, lang), ...addr, `${l.seatNL(M("seat") || ph_("city", lang))}, ${l.kvk} ${M("kvk") || ph_("kvk", lang)}`, `${cap(l.rep)}: ${signer}`];
  const tn = M("trading_name");
  const out = [tn && tn !== name ? `${name}, ${l.tradingAs} ${tn}` : name, ...addr];
  if (t.id === "nl-eenmanszaak") out.push(`${l.kvk} ${M("kvk") || ph_("kvk", lang)}`);
  return out;
}

function meSig(details, lang) {
  const t = businessType(details.entity), l = L[lang];
  const name = mine(details, "full_name") || ph_("name", lang);
  if (isCompany(t)) return { name: firmName(details, lang), lines: [`${(mine(details, "directors") || ph_("dirs", lang)).split(/,| und | and | en /)[0].trim()}, ${t.id === "uk-ltd" ? l.director : l.dirs}`] };
  if (t.id === "de-ek") return { name: firmName(details, lang), lines: [`${name}, ${l.owner}`] };
  return { name, lines: [] };
}

function otherLines(other, lang) {
  const l = L[lang], O = (k) => clean(other[k]);
  const addr = [O("street") || ph_("street", lang), [O("postcode"), O("city")].filter(Boolean).join(" ") || ph_("pcity", lang), ...(O("country") ? [O("country")] : [])];
  if (other.kind !== "business") return [O("name") || ph_("name", lang), ...addr];
  return [O("name") || ph_("company", lang), ...(O("register") ? [O("register")] : []), ...addr, ...(O("rep") ? [`${cap(l.rep)}: ${O("rep")}`] : [])];
}

function otherSig(other, lang) {
  if (other.kind !== "business") return { name: clean(other.name) || ph_("name", lang), lines: [] };
  return { name: clean(other.name) || ph_("company", lang), lines: clean(other.rep) ? [clean(other.rep)] : [] };
}

/* ------------------------------------------------------------------ the context and the document */

/** Everything the templates read, made from the saved data, your details and the payment accounts */
export function contractContext(data, details, accounts = []) {
  const lang = ["de", "en", "nl"].includes(data.lang) ? data.lang : "de";
  const t = TYPE(data.type);
  const r = t.roles.find((x) => x.id === data.role) || t.roles[0];
  const ent = businessType(details.entity);
  const law = Object.hasOwn(LAWS, data.law) ? data.law : ent.country || "DE";
  const cur = CURRENCIES.includes(data.currency) ? data.currency : defaultCurrency(details);
  const other = { kind: "consumer", ...(data.other || {}) };
  const f = factsOf(t, data.facts);
  const mePrivate = details.entity === "de-private";
  const meConsumer = mePrivate && ME_CONSUMER_ROLES.includes(r.me);
  const otherConsumer = other.kind !== "business";
  const R = (k) => ROLE[k][lang];
  const x = {
    lang, law, type: t.id, typeRole: r.id, f, cur, R, meRoleKey: r.me, otherRoleKey: r.other, meRole: R(r.me), otherRole: R(r.other), meEntity: details.entity,
    otherConsumer, meConsumer, consumerAny: otherConsumer || meConsumer,
    clientConsumer: r.me === "client" ? meConsumer : otherConsumer,
    sellerBusiness: r.me === "seller" ? !mePrivate : other.kind === "business",
    buyerConsumer: r.me === "buyer" ? meConsumer : otherConsumer,
    contractorCountry: r.me === "contractor" ? ent.country : law,
    city: clean(details.city) || ph_("city", lang),
    ukPart: clean(details.registered_in) || "England and Wales",
    state: clean(data.us_state) || ph_("state", lang),
    money: (v) => { const c = parseMoney(v); return c == null || Number.isNaN(c) ? ph_("amount", lang) : fmtCents(c, lang, cur); },
    fmtCents: (c) => fmtCents(c, lang, cur),
    date: (iso) => fmtDate(iso, lang),
    lang1: null, lang2: null
  };
  if (PLAN_TYPES.includes(t.id)) {
    x.sched = t.id === "repay" ? repaySchedule(f) : paySchedule(f);
    if (r.me === "creditor") {
      // Your account: the one picked, otherwise the one marked default, otherwise the first
      const account = accounts.find((a) => a.label === data.account) || accounts.find((a) => a.default) || accounts[0] || {};
      // with an account picked a missing BIC or bank name is just left out, without one its all placeholders
      const has = Boolean(account.iban);
      x.creditorBank = { holder: clean(account.holder) || firmName(details, lang), iban: has ? formatIban(account.iban) : ph_("iban", lang), bic: clean(account.bic) || (has ? "" : ph_("bic", lang)), bank: clean(account.bank) || (has ? "" : ph_("bank", lang)) };
    } else {
      const b = data.other_bank || {};
      const has = Boolean(b.iban);
      x.creditorBank = { holder: clean(b.holder) || clean(other.name) || ph_("holder", lang), iban: has ? formatIban(b.iban) : ph_("iban", lang), bic: clean(b.bic) || (has ? "" : ph_("bic", lang)), bank: clean(b.bank) || (has ? "" : ph_("bank", lang)) };
    }
  }
  return { x, type: t, role: r, other, lang };
}

// Written out clause text back into paragraphs: an empty line starts a paragraph, "- " lines are its items
function parseClauseText(text) {
  return String(text || "").replace(/\r\n/g, "\n").split(/\n\s*\n/).map((block) => {
    const rows = block.split("\n").map((s) => s.trim()).filter(Boolean);
    const items = rows.filter((s) => /^[-•]\s+/.test(s)).map((s) => s.replace(/^[-•]\s+/, ""));
    const text = rows.filter((s) => !/^[-•]\s+/.test(s)).join("\n");
    return items.length ? { text, items } : { text };
  }).filter((p) => p.text || p.items);
}

/** The whole contract as a structure: title, parties, recitals, clauses, the schedule, signatures and notes */
export function buildContract(data, details, accounts = []) {
  const { x, type, other, lang } = contractContext(data, details, accounts);
  const body = TPL[type.id](x);
  let clauses = body.clauses.concat([finalClause(x, { cisg: body.cisg })]);
  let recitals = body.recitals || [];
  let schedule = body.schedule || null;
  const written = Array.isArray(data.clauses) && data.clauses.length > 0;
  if (written) {
    clauses = data.clauses.map((c) => ({ heading: clean(c.heading), paragraphs: parseClauseText(c.text), schedule: c.schedule === true }));
    recitals = String(data.recitals || "").split(/\n\s*\n/).map((s) => s.trim()).filter(Boolean).map((text) => ({ text }));
    // The table stays worked out from the facts, it just goes where the ticked clause is (or to the end)
    if (schedule) {
      const at = clauses.findIndex((c) => c.schedule);
      schedule = schedule.map((s) => ({ ...s, after_clause: at > -1 ? at + 1 : null }));
    }
  }
  const notes = [NOT_ADVICE, ...(body.notes || [])];
  if (written) notes.push("The clauses are written out, so changing the facts no longer changes their text. Clear the clauses list to go back to the facts.");
  return {
    lang,
    title: clean(data.title) || body.title,
    parties: [
      { role: x.meRole, lines: meLines(details, lang) },
      { role: x.otherRole, lines: otherLines(other, lang) }
    ],
    recitals,
    clauses,
    schedule,
    signatures: [{ role: x.meRole, ...meSig(details, lang) }, { role: x.otherRole, ...otherSig(other, lang) }],
    notes,
    written
  };
}

/** The generated clauses as plain text for the form, so they can be edited from there on */
export function writeOut(data, details, accounts = []) {
  const doc = buildContract({ ...data, clauses: [] }, details, accounts);
  const after = (doc.schedule || []).map((s) => s.after_clause).find(Boolean);
  return {
    recitals: doc.recitals.map((r) => r.text).join("\n\n"),
    clauses: doc.clauses.map((c, i) => {
      const text = c.paragraphs.map((p) => [
        p.text,
        ...(p.card || []).filter(([, value]) => clean(value)).map(([label, value]) => `${label}: ${value}`),
        ...(p.items || []).map((item) => `- ${item}`)
      ].filter(Boolean).join("\n")).join("\n\n");
      const out = { heading: c.heading, text };
      if (doc.schedule && after === i + 1) out.schedule = true;
      return out;
    })
  };
}

/* ------------------------------------------------------------------ the page */

// Keeps § 5, Nr. 7 and the like on one line
const glue = (s) => String(s ?? "").replace(/(§§?|Nr\.|Art\.|Abs\.|art\.|section|artikel|Artikel) (?=\d)/g, "$1\u00a0");
const txt = (s) => withPlaceholders(glue(s)).replace(/\n/g, "<br>");
const letter = (k) => String.fromCharCode(97 + (k % 26));

function scheduleHtml(s) {
  // Money columns go right, the running number column stays narrow on the left
  const numeric = s.columns.map((_, k) => k > 0 && s.rows.every((r) => !r[k] || /\d/.test(r[k]) && /^[-+]?[\d.,\s\u00a0]+\s?[€£$]?$|^[€£$]\s?[\d.,\s\u00a0]+$/.test(String(r[k]).trim())));
  const head = s.columns.map((c, k) => `<th${numeric[k] ? ' class="num"' : ""}>${esc(c)}</th>`).join("");
  const rows = s.rows.map((r, i) => `<tr${i === s.rows.length - 1 && !r[0] ? ' class="ct-sum"' : ""}>${r.map((c, k) => `<td${numeric[k] ? ' class="num"' : ""}>${txt(c)}</td>`).join("")}</tr>`).join("");
  // a short table moves to the next page in one piece, a long one breaks between rows with the head repeated
  return `<figure class="ct-schedule${s.rows.length <= 14 ? " ct-schedule--keep" : ""}">${s.label ? `<figcaption>${esc(s.label)}</figcaption>` : ""}<table class="inv-lines ct-table"><thead><tr>${head}</tr></thead><tbody>${rows}</tbody></table></figure>`;
}

function clauseHtml(c, i) {
  const multi = c.paragraphs.length > 1;
  const paras = c.paragraphs.map((p, j) => {
    const rows = (p.card || []).filter(([, v]) => clean(v));
    const card = rows.length ? `<dl class="inv-account ct-card">${rows.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${txt(v)}</dd></div>`).join("")}</dl>` : "";
    const items = (p.items || []).map((it, k) => `<div class="ct-item"><span class="ct-n">(${letter(k)})</span><div>${txt(it)}</div></div>`).join("");
    return `<div class="ct-p"><span class="ct-n">${multi ? `${i + 1}.${j + 1}` : ""}</span><div>${p.text ? txt(p.text) : ""}${card}${items}</div></div>`;
  }).join("");
  return `<section class="ct-clause"><h2 class="ct-h"><span class="ct-n">${i + 1}.</span>${c.heading ? txt(c.heading) : '<span class="ph">[Heading]</span>'}</h2>${paras}</section>`;
}

export const contract = {
  kind: "contract",
  label: "Contract",
  code: "C",
  help: "A contract from your templates: payment plans, freelance projects, NDAs, selling something and outlines to fill in, in German, English or Dutch.",
  choices: CONTRACT_TYPES,
  fixed: ["type"],
  fields: [LANG_FIELD],

  fieldsFor(data, accounts) {
    return contractFields(data, accounts);
  },

  defaults(details, lang = "de", accounts = [], { type } = {}) {
    const t = TYPE(type);
    const ent = businessType(details.entity);
    const data = {
      lang,
      type: t.id,
      role: t.roles[0].id,
      law: ent.country || "DE",
      currency: defaultCurrency(details),
      other: { kind: "consumer" },
      facts: factsOf(t, {})
    };
    const account = accounts.find((a) => a.default) || accounts[0];
    if (PLAN_TYPES.includes(t.id) && account?.label) data.account = account.label;
    return data;
  },

  title(data) {
    if (clean(data.title)) return clean(data.title);
    const t = TYPE(data.type);
    if (t.id === "custom" && clean(data.facts?.title)) return clean(data.facts.title);
    // The template title in the contracts language, the details dont change it so empty ones are fine
    try {
      return TPL[t.id](contractContext(data, { entity: "de-private" }).x).title;
    } catch {
      return t.label;
    }
  },

  render(data, { details, accounts = [], number, logo, preview = false }) {
    const doc = buildContract(data, details, accounts);
    const l = L[doc.lang];
    const contact = [details.email, details.phone, details.web].filter(Boolean).join(" · ");
    const parties = doc.parties.map((p, i) => {
      const as = l.as("\u0000").split("\u0000");
      return `${i ? `<p class="ct-between">${esc(l.and)}</p>` : ""}<div class="ct-party">${p.lines.map((line, j) => j === 0 ? `<strong>${txt(line)}</strong>` : txt(line)).join("<br>")}<br><span class="ct-as">${esc(as[0])}${esc(p.role)}${esc(as[1] || "")}</span></div>`;
    }).join("");
    const recitals = doc.recitals.length ? `<section class="ct-recitals"><h2 class="ct-h ct-h--plain">${esc(l.background)}</h2>${doc.recitals.map((r, i) => `<div class="ct-p"><span class="ct-n">${doc.recitals.length > 1 ? `(${String.fromCharCode(65 + i)})` : ""}</span><div>${txt(r.text)}</div></div>`).join("")}</section>` : "";
    const tables = (after) => (doc.schedule || []).filter((s) => after === null ? !s.after_clause || s.after_clause > doc.clauses.length : s.after_clause === after).map(scheduleHtml).join("");
    // The last clause and the signatures stay on the same page, a signature alone on a page could be put under anything
    const last = doc.clauses.length - 1;
    const clauses = doc.clauses.map((c, i) => i === last ? "" : clauseHtml(c, i) + tables(i + 1)).join("");
    const end = last > -1 ? clauseHtml(doc.clauses[last], last) + tables(last + 1) : "";
    const sigs = doc.signatures.map((s) => `<div class="ct-sig"><div class="ct-sig__line"></div><div class="ct-sig__label">${esc(l.place)}</div><div class="ct-sig__line ct-sig__line--big"></div><div class="ct-sig__who"><strong>${esc(s.role)}</strong><br>${txt(s.name)}${s.lines.map((line) => `<br>${txt(line)}`).join("")}</div></div>`).join("");
    const notes = preview && doc.notes.length ? `<aside class="doc-notes" aria-label="Notes for you, not printed"><strong>Notes for you, not printed</strong><ul>${doc.notes.map((n) => `<li>${esc(n)}</li>`).join("")}</ul></aside>` : "";

    const body = `${notes}<article class="doc doc--contract">
  <header class="ct-head">
    ${logo ? `<img class="din-logo" src="${esc(logo)}" alt="">` : ""}
    <div class="din-sender"><strong>${esc(firmName(details, doc.lang))}</strong>${contact ? `<br>${esc(contact)}` : ""}${number ? `<br>${esc(number)}` : ""}</div>
  </header>
  <h1 class="ct-title">${txt(doc.title)}</h1>
  <p class="ct-between">${esc(l.between)}</p>
  ${parties}
  ${recitals}
  ${clauses}
  <div class="ct-end">${end}${tables(null)}<div class="ct-sigs">${sigs}</div></div>
</article>`;
    const footer = footerColumns([[doc.title], [senderName(details), details.web].filter(Boolean)]);
    return { body, footer, number, title: `${senderName(details)}, ${doc.title}`, notes: doc.notes };
  },

  /** The same contract as plain blocks for the Word file */
  plain(data, { details, accounts = [] }) {
    const doc = buildContract(data, details, accounts);
    const l = L[doc.lang];
    const blocks = [{ text: doc.title, bold: true }, { empty: true }, { text: l.between }];
    doc.parties.forEach((p, i) => {
      if (i) blocks.push({ text: l.and });
      blocks.push({ text: p.lines.join("\n") }, { text: l.as(p.role) });
    });
    blocks.push({ empty: true });
    if (doc.recitals.length) {
      blocks.push({ text: l.background, bold: true });
      doc.recitals.forEach((r, i) => blocks.push({ text: `${doc.recitals.length > 1 ? `(${String.fromCharCode(65 + i)}) ` : ""}${r.text}` }));
      blocks.push({ empty: true });
    }
    const tables = (after) => (doc.schedule || []).filter((s) => after === null ? !s.after_clause || s.after_clause > doc.clauses.length : s.after_clause === after).forEach((s) => {
      if (s.label) blocks.push({ text: s.label, bold: true });
      blocks.push({ table: true, header: true, rows: [s.columns, ...s.rows], align: s.columns.map((_, k) => k > 1 ? "right" : "left") });
    });
    doc.clauses.forEach((c, i) => {
      blocks.push({ text: `${i + 1}. ${c.heading}`, bold: true });
      const multi = c.paragraphs.length > 1;
      c.paragraphs.forEach((p, j) => {
        if (p.text) blocks.push({ text: `${multi ? `${i + 1}.${j + 1} ` : ""}${p.text}` });
        (p.card || []).filter(([, v]) => clean(v)).forEach(([k, v]) => blocks.push({ runs: [{ text: `${k}: `, bold: true }, { text: v }] }));
        (p.items || []).forEach((it, k) => blocks.push({ text: `(${letter(k)}) ${it}` }));
      });
      tables(i + 1);
      blocks.push({ empty: true });
    });
    tables(null);
    doc.signatures.forEach((s) => {
      blocks.push({ empty: true }, { text: "______________________________" }, { text: l.place }, { empty: true }, { empty: true }, { text: "______________________________" }, { text: [s.role, s.name, ...s.lines].join("\n") });
    });
    return blocks;
  }
};

