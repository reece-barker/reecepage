// An invoice in the same letter layout, with the line items worked out in whole cents. VAT is added up per rate
// over the net totals, rounded half away from zero, the way the tax offices do it. A small business (§ 19 UStG,
// the Dutch KOR, not VAT registered in the UK) gets no VAT and the note that says why.
import { addDays, esc, formatDate, formatMoney, formatQuantity, formatRate, lines, paragraphs, parseMoney, parseQuantity, roundDiv, today } from "./format.js";
import { words } from "./words.js";
import { LANG_FIELD, footer } from "./letter.js";
import { businessType, defaultCurrency, returnLine, senderLines, senderName, smallBusinessAllowed, taxLines } from "./business.js";

const VAT_RATES = { DE: ["19", "7", "0"], UK: ["20", "5", "0"], NL: ["21", "9", "0"], US: ["0"] };
const INTRO = {
  de: "Vielen Dank für Ihren Auftrag. Ich berechne Ihnen folgende Leistungen:",
  en: "Thank you for your order. I am invoicing you for the following:",
  nl: "Hartelijk dank voor uw opdracht. Hierbij breng ik u het volgende in rekening:"
};

/** The sums of an invoice, everything in cents. bad lists the rows that dont add up, so nothing wrong gets printed */
export function invoiceTotals(items = [], { small = false } = {}) {
  const rows = [];
  const byRate = new Map();
  const bad = [];
  items.forEach((item, index) => {
    if (!item || (!item.description && !item.price)) return;
    const quantity = parseQuantity(item.quantity ?? "1");
    const price = parseMoney(item.price);
    const rate = small ? 0 : Math.round(Number(String(item.vat ?? "0").replace(",", ".")) * 100);
    if (quantity === null || price === null || !Number.isFinite(rate)) { bad.push(index + 1); return; }
    const net = roundDiv(quantity * price, 1000);
    rows.push({ ...item, quantity, price, rate, net });
    byRate.set(rate, (byRate.get(rate) || 0) + net);
  });
  const rates = [...byRate.entries()].sort((a, b) => b[0] - a[0]).map(([rate, net]) => ({ rate, net, vat: roundDiv(net * rate, 10000) }));
  const net = rates.reduce((sum, r) => sum + r.net, 0);
  const vat = rates.reduce((sum, r) => sum + r.vat, 0);
  return { rows, rates, net, vat, total: net + vat, bad };
}

export const invoice = {
  kind: "invoice",
  label: "Invoice",
  code: "I",
  help: "An invoice with numbered lines, VAT or the small business note, and your bank account from Payment accounts.",
  fields: [
    LANG_FIELD,
    { name: "recipient", label: "To (one line each: name, street, postcode and city)", type: "textarea", required: true },
    { name: "date", label: "Invoice date", type: "date", required: true },
    { name: "service", label: "Date or period of the work", type: "text", required: true, help: "Required on a German invoice, for example 03.11.2026 or October 2026" },
    { name: "due_days", label: "Days to pay", type: "text", number: true },
    { name: "currency", label: "Currency", type: "select", options: ["EUR", "GBP", "USD"] },
    { name: "small_business", label: "Small business, no VAT (Kleinunternehmer § 19 UStG and the like)", type: "checkbox" },
    { name: "reverse_charge", label: "Reverse charge (the client pays the VAT, business clients abroad)", type: "checkbox" },
    { name: "items", label: "Lines", type: "objects", itemLabel: "description", itemMeta: ["quantity", "price"], singular: "line", openEmpty: true, fields: [
      { name: "description", label: "What", type: "textarea", required: true },
      { name: "quantity", label: "Quantity", type: "text", help: "1, 2,5 and so on" },
      { name: "unit", label: "Unit", type: "text", help: "Hours, pieces, flat" },
      { name: "price", label: "Price per unit, net", type: "text", help: "120 or 120,50" },
      { name: "vat", label: "VAT %", type: "text", help: "19, 7 or 0. Ignored for a small business" }
    ] },
    { name: "intro", label: "Text above the lines", type: "textarea" },
    { name: "outro", label: "Text under the totals", type: "textarea" },
    { name: "refs", label: "References (all optional)", type: "object", fields: [
      { name: "your_ref", label: "Their order or reference", type: "text" },
      { name: "customer_no", label: "Customer or project number", type: "text" }
    ] },
    { name: "account", label: "Pay to", type: "select", options: [], required: true, help: "From Payment accounts" }
  ],

  defaults(details, lang = "de", accounts = []) {
    const type = businessType(details.entity);
    const vat = details.small_business ? "0" : (VAT_RATES[type.country] || ["0"])[0];
    const preferred = accounts.find((a) => a.default) || accounts[0];
    return {
      lang,
      recipient: "",
      date: today(),
      service: "",
      due_days: 14,
      currency: defaultCurrency(details),
      small_business: Boolean(details.small_business) && smallBusinessAllowed(details),
      reverse_charge: false,
      items: [{ description: "", quantity: "1", unit: "", price: "", vat }],
      intro: INTRO[lang] || INTRO.de,
      outro: "",
      refs: {},
      account: preferred ? preferred.label : ""
    };
  },

  title(data) {
    const first = (data.items || []).find((i) => i && i.description);
    return first ? String(first.description).split("\n")[0].slice(0, 80) : "Invoice";
  },

  render(data, { details, accounts = [], number, logo }) {
    const lang = data.lang || "de";
    const w = words(lang);
    const currency = data.currency || defaultCurrency(details);
    const small = Boolean(data.small_business);
    const sums = invoiceTotals(data.items, { small });
    const money = (cents) => formatMoney(cents, lang, currency);
    const due = data.due_days ? addDays(data.date, Number(data.due_days)) : "";
    const account = accounts.find((a) => a.label === data.account);
    const refs = data.refs || {};
    const info = [
      [w.invoiceNo, number],
      [w.invoiceDate, formatDate(data.date, lang)],
      [w.serviceDate, data.service],
      [w.yourRef, refs.your_ref],
      [w.customerNo, refs.customer_no],
      ...taxLines(details, lang).map((l) => l.split(": ")),
      [w.email, details.email]
    ].filter(([, value]) => value);

    const rows = sums.rows.map((row, i) => `<tr>
      <td class="num">${i + 1}</td>
      <td>${lines(row.description)}</td>
      <td class="num">${esc(formatQuantity(row.quantity, lang))}${row.unit ? ` ${esc(row.unit)}` : ""}</td>
      <td class="num">${esc(money(row.price))}</td>
      ${small ? "" : `<td class="num">${esc(formatRate(row.rate, lang))}</td>`}
      <td class="num">${esc(money(row.net))}</td>
    </tr>`).join("");

    const totals = small
      ? `<tr class="total"><th colspan="2">${esc(w.totalDue)}</th><td class="num">${esc(money(sums.total))}</td></tr>`
      : `<tr><th colspan="2">${esc(w.net)}</th><td class="num">${esc(money(sums.net))}</td></tr>
         ${sums.rates.map((r) => `<tr><th colspan="2">${esc(w.vat(formatRate(r.rate, lang)))}</th><td class="num">${esc(money(r.vat))}</td></tr>`).join("")}
         <tr class="total"><th colspan="2">${esc(w.totalDue)}</th><td class="num">${esc(money(sums.total))}</td></tr>`;

    const sender = senderLines(details, lang);
    const body = `<article class="doc doc--invoice">
  <div class="din-first">
    <header class="din-head">
      ${logo ? `<img class="din-logo" src="${esc(logo)}" alt="">` : ""}
      <div class="din-sender">${sender.map((l, i) => i === 0 ? `<strong>${esc(l)}</strong>` : esc(l)).join("<br>")}${details.web ? `<br>${esc(details.web)}` : ""}</div>
    </header>
    <div class="din-window">
      <p class="din-return">${esc(returnLine(details))}</p>
      <p class="din-address">${lines(data.recipient) || '<span class="ph">[Name and address]</span>'}</p>
    </div>
    <dl class="din-info">
      ${info.map(([label, value]) => `<div><dt>${esc(label)}</dt><dd>${esc(value)}</dd></div>`).join("")}
    </dl>
    <h1 class="din-subject">${esc(w.invoice)} ${esc(number || "")}</h1>
  </div>
  <div class="din-body">
    ${paragraphs(data.intro)}
    ${sums.bad.length ? `<p class="ph">Line ${sums.bad.join(", ")}: the quantity or price isnt a number</p>` : ""}
    <table class="inv-lines">
      <thead><tr>
        <th class="num">${esc(w.position)}</th><th>${esc(w.description)}</th><th class="num">${esc(w.quantity)}</th>
        <th class="num">${esc(w.unitPrice)}</th>${small ? "" : `<th class="num">${esc(w.vatRate)}</th>`}<th class="num">${esc(w.amount)}</th>
      </tr></thead>
      <tbody>${rows || `<tr><td colspan="${small ? 5 : 6}"><span class="ph">[Add a line]</span></td></tr>`}</tbody>
    </table>
    <table class="inv-totals"><tbody>${totals}</tbody></table>
    ${small ? `<p class="inv-note">${esc(w.smallBusiness)}</p>` : ""}
    ${data.reverse_charge && !small ? `<p class="inv-note">${esc(w.reverseCharge)}</p>` : ""}
    ${due ? `<p>${esc(w.payBy(formatDate(due, lang)))}</p>` : ""}
    ${account ? `<dl class="inv-account">
      <div><dt>${esc(w.accountHolder)}</dt><dd>${esc(account.holder || senderName(details))}</dd></div>
      ${account.bank ? `<div><dt>${esc(w.bank)}</dt><dd>${esc(account.bank)}</dd></div>` : ""}
      <div><dt>${esc(w.iban)}</dt><dd>${esc(String(account.iban || "").replace(/\s+/g, "").replace(/(.{4})/g, "$1 ").trim())}</dd></div>
      ${account.bic ? `<div><dt>${esc(w.bic)}</dt><dd>${esc(account.bic)}</dd></div>` : ""}
      <div><dt>${esc(w.reference)}</dt><dd>${esc(number || "")}</dd></div>
    </dl>` : `<p class="ph">[Pick the account to be paid to]</p>`}
    ${paragraphs(data.outro)}
  </div>
</article>`;
    return { body, footer: footer(details, accounts, "", lang), number, title: `${w.invoice} ${number || ""}`.trim(), totals: sums };
  },

  /** The same invoice as plain blocks for the Word file: the lines and totals as a plain table */
  plain(data, { details, accounts = [], number }) {
    const lang = data.lang || "de";
    const w = words(lang);
    const currency = data.currency || defaultCurrency(details);
    const small = Boolean(data.small_business);
    const sums = invoiceTotals(data.items, { small });
    const money = (cents) => formatMoney(cents, lang, currency);
    const account = accounts.find((a) => a.label === data.account);
    const header = [w.position, w.description, w.quantity, w.unitPrice, ...(small ? [] : [w.vatRate]), w.amount];
    const rows = sums.rows.map((row, i) => [String(i + 1), String(row.description || ""), `${formatQuantity(row.quantity, lang)}${row.unit ? ` ${row.unit}` : ""}`, money(row.price), ...(small ? [] : [formatRate(row.rate, lang)]), money(row.net)]);
    const totals = small ? [[w.totalDue, money(sums.total)]] : [[w.net, money(sums.net)], ...sums.rates.map((r) => [w.vat(formatRate(r.rate, lang)), money(r.vat)]), [w.totalDue, money(sums.total)]];
    const due = data.due_days ? addDays(data.date, Number(data.due_days)) : "";
    const blocks = [
      { text: senderLines(details, lang).join("\n") },
      { empty: true },
      { text: String(data.recipient || "").trim() },
      { empty: true },
      { runs: [{ text: `${w.invoiceNo}: `, bold: true }, { text: number || "" }] },
      { runs: [{ text: `${w.invoiceDate}: `, bold: true }, { text: formatDate(data.date, lang) }] },
      ...(data.service ? [{ runs: [{ text: `${w.serviceDate}: `, bold: true }, { text: data.service }] }] : []),
      ...taxLines(details, lang).map((l) => ({ text: l })),
      { empty: true },
      { text: `${w.invoice} ${number || ""}`, bold: true },
      { empty: true },
      ...(data.intro ? [{ text: data.intro }] : []),
      { table: true, header: true, rows: [header, ...rows], align: header.map((_, i) => (i === 1 ? "left" : "right")) },
      { table: true, rows: totals, align: ["left", "right"] }
    ];
    if (small) blocks.push({ text: w.smallBusiness });
    if (data.reverse_charge && !small) blocks.push({ text: w.reverseCharge });
    if (due) blocks.push({ text: w.payBy(formatDate(due, lang)) });
    if (account) blocks.push({ text: [`${w.accountHolder}: ${account.holder || senderName(details)}`, account.bank ? `${w.bank}: ${account.bank}` : "", `${w.iban}: ${String(account.iban || "").replace(/\s+/g, "").replace(/(.{4})/g, "$1 ").trim()}`, account.bic ? `${w.bic}: ${account.bic}` : "", `${w.reference}: ${number || ""}`].filter(Boolean).join("\n") });
    if (data.outro) blocks.push({ empty: true }, { text: data.outro });
    return blocks;
  }
};
