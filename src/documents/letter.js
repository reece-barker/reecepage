// A business letter on DIN 5008 form B. The wording is exactly what you type: nothing is added, no legal phrases
// slipped in. The only automatic parts are the letterhead, the return line, the dates and the fine print the
// business type needs.
import { esc, formatDate, formatIban, lines, paragraphs, today, withPlaceholders } from "./format.js";
import { words } from "./words.js";
import { footerColumns } from "./page.js";
import { legalLines, returnLine, senderLines, senderName, taxLines } from "./business.js";

const GREETING = { de: "Sehr geehrte Damen und Herren,", en: "Dear Sir or Madam,", nl: "Geachte heer, mevrouw," };
const CLOSING = { de: "Mit freundlichen Grüßen", en: "Kind regards", nl: "Met vriendelijke groet" };

export const LANG_FIELD = { name: "lang", label: "Language", type: "select", options: ["de", "en", "nl"], required: true, help: "de German, en English, nl Dutch. The fixed words follow it, your own text stays as you type it" };

export const letter = {
  kind: "letter",
  label: "Letter",
  code: "L",
  help: "A DIN 5008 letter on your letterhead, for a Kündigung, a reply to an office or anything else on paper.",
  fields: [
    LANG_FIELD,
    { name: "recipient", label: "To (one line each: name, street, postcode and city)", type: "textarea", required: true },
    { name: "date", label: "Date", type: "date", required: true },
    { name: "subject", label: "Subject", type: "text", required: true, max: 200 },
    { name: "salutation", label: "Greeting", type: "text" },
    { name: "body", label: "Text", type: "textarea", max: 20000, help: "An empty line starts a new paragraph, lines starting with - become a list. [Square brackets] are marked as still to fill in" },
    { name: "closing", label: "Closing", type: "text" },
    { name: "signature", label: "Name under the signature", type: "text" },
    { name: "enclosures", label: "Enclosures", type: "strings" },
    { name: "refs", label: "References (all optional)", type: "object", fields: [
      { name: "your_ref", label: "Your reference", type: "text" },
      { name: "your_message", label: "Their message of", type: "date" },
      { name: "our_ref", label: "Our reference", type: "text" },
      { name: "customer_no", label: "Customer or project number", type: "text" }
    ] },
    { name: "account", label: "Bank account in the footer", type: "select", options: [], help: "From Payment accounts. Leave empty for none" }
  ],

  defaults(details, lang = "de") {
    return {
      lang,
      recipient: "",
      date: today(),
      subject: "",
      salutation: GREETING[lang] || GREETING.de,
      body: "",
      closing: CLOSING[lang] || CLOSING.de,
      signature: details.full_name || "",
      enclosures: [],
      refs: {},
      account: ""
    };
  },

  title(data) {
    return data.subject || "Letter";
  },

  render(data, { details, accounts = [], number, logo }) {
    const lang = data.lang || "de";
    const w = words(lang);
    const refs = data.refs || {};
    const info = [
      [w.yourRef, refs.your_ref],
      [w.yourMessage, refs.your_message ? formatDate(refs.your_message, lang) : ""],
      [w.ourRef, refs.our_ref],
      [w.customerNo, refs.customer_no],
      [w.documentNo, number],
      [w.phone, details.phone],
      [w.email, details.email],
      [w.date, formatDate(data.date, lang)]
    ].filter(([, value]) => value);
    const enclosures = (data.enclosures || []).filter(Boolean);
    const sender = senderLines(details, lang);

    const body = `<article class="doc doc--letter">
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
    <h1 class="din-subject">${withPlaceholders(data.subject) || '<span class="ph">[Subject]</span>'}</h1>
  </div>
  <div class="din-body">
    ${data.salutation ? `<p>${withPlaceholders(data.salutation)}</p>` : ""}
    ${paragraphs(data.body)}
    <div class="din-sign">
      ${data.closing ? `<p>${withPlaceholders(data.closing)}</p>` : ""}
      <div class="din-sign__space" aria-hidden="true"></div>
      ${data.signature ? `<p>${withPlaceholders(data.signature)}</p>` : ""}
    </div>
    ${enclosures.length ? `<p class="din-enclosures"><strong>${esc(enclosures.length === 1 ? w.enclosure : w.enclosures)}</strong><br>${enclosures.map(withPlaceholders).join("<br>")}</p>` : ""}
  </div>
</article>`;

    return { body, footer: footer(details, accounts, data.account, lang), number, title: `${senderName(details)}, ${letter.title(data)}` };
  },

  /** The same letter as plain blocks for the Word file */
  plain(data, { details, number }) {
    const lang = data.lang || "de";
    const w = words(lang);
    const refs = data.refs || {};
    const blocks = [
      { text: senderLines(details, lang).join("\n") },
      { empty: true },
      { text: String(data.recipient || "").trim() },
      { empty: true },
      ...[[w.yourRef, refs.your_ref], [w.ourRef, refs.our_ref], [w.customerNo, refs.customer_no], [w.documentNo, number]]
        .filter(([, v]) => v).map(([label, value]) => ({ runs: [{ text: `${label}: `, bold: true }, { text: value }] })),
      { text: formatDate(data.date, lang), align: "right" },
      { empty: true },
      { text: data.subject || "", bold: true },
      { empty: true }
    ];
    if (data.salutation) blocks.push({ text: data.salutation });
    for (const para of String(data.body || "").replace(/\r\n/g, "\n").split(/\n{2,}/).map((p) => p.trim()).filter(Boolean)) blocks.push({ text: para });
    blocks.push({ empty: true });
    if (data.closing) blocks.push({ text: data.closing });
    blocks.push({ empty: true }, { empty: true });
    if (data.signature) blocks.push({ text: data.signature });
    const enclosures = (data.enclosures || []).filter(Boolean);
    if (enclosures.length) blocks.push({ empty: true }, { text: enclosures.length === 1 ? w.enclosure : w.enclosures, bold: true }, { text: enclosures.join("\n") });
    return blocks;
  }
};

/** The fine print on every page: contact, what the law wants for this business type, tax numbers and the bank */
export function footer(details, accounts, accountId, lang) {
  const w = words(lang);
  const contact = [details.phone ? `${w.phone} ${details.phone}` : "", details.email, details.web].filter(Boolean);
  const legal = [...legalLines(details, lang), ...taxLines(details, lang)];
  const account = accounts.find((a) => a.id === accountId || a.label === accountId);
  const bank = account ? [account.bank, `${w.iban} ${formatIban(account.iban)}`, account.bic ? `${w.bic} ${account.bic}` : ""].filter(Boolean) : [];
  return footerColumns([contact, legal, bank]);
}
