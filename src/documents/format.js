// Numbers, money and dates for letters, invoices and contracts, in German, English or Dutch. Money is always whole
// cents (integers), never floats, so 0.1 + 0.2 never turns into 0.30000000000000004 on an invoice.

export const LANGS = ["de", "en", "nl"];
const CURRENCY_SIGN = { EUR: "€", GBP: "£", USD: "$" };

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" }[c]));
export { esc };

/** Text with [placeholders] marked, so whats still to fill in stands out in the preview (never in the PDF colour) */
export function withPlaceholders(text) {
  return esc(text).replace(/\[[^\]]{1,80}\]/g, (m) => `<span class="ph">${m}</span>`);
}

/** Lines of text as HTML, each line its own line, empty lines dropped */
export function lines(text) {
  return String(text || "").split(/\r?\n/).map((l) => l.trim()).filter(Boolean).map(withPlaceholders).join("<br>");
}

/**
 * Plain paragraphs from a textarea: an empty line starts a new paragraph, a line starting with "- " is a list item.
 * Thats all the formatting a letter needs, and it can be written the same way into Word
 */
export function paragraphs(text) {
  const blocks = String(text || "").replace(/\r\n/g, "\n").split(/\n{2,}/).map((b) => b.trim()).filter(Boolean);
  return blocks.map((block) => {
    const rows = block.split("\n");
    if (rows.every((r) => /^-\s+/.test(r))) return `<ul>${rows.map((r) => `<li>${withPlaceholders(r.replace(/^-\s+/, ""))}</li>`).join("")}</ul>`;
    return `<p>${rows.map(withPlaceholders).join("<br>")}</p>`;
  }).join("");
}

/**
 * "12,50", "12.50", "1.234,56" or "1,234.56" as cents. When both separators are there the last one is the decimal
 * one, a single separator followed by one or two digits is decimal, otherwise its a thousands separator. Returns
 * null for anything that isnt an amount
 */
export function parseMoney(value) {
  if (typeof value === "number") return Number.isFinite(value) ? Math.round(value * 100) : null;
  let s = String(value ?? "").trim().replace(/[€£$\s]/g, "");
  if (!s) return null;
  const negative = /^[-\u2212]/.test(s);
  s = s.replace(/^[-\u2212]/, "");
  if (!/^[\d.,]+$/.test(s)) return null;
  let decimal = "";
  if (s.includes(",") && s.includes(".")) decimal = s.lastIndexOf(",") > s.lastIndexOf(".") ? "," : ".";
  else {
    const sep = s.includes(",") ? "," : s.includes(".") ? "." : "";
    if (sep && s.split(sep).length === 2 && /^\d{1,2}$/.test(s.split(sep)[1])) decimal = sep;
  }
  const [whole, fraction = ""] = decimal ? [s.slice(0, s.lastIndexOf(decimal)), s.slice(s.lastIndexOf(decimal) + 1)] : [s, ""];
  const digits = whole.replace(/[.,]/g, "");
  if (!/^\d*$/.test(digits) || !/^\d{0,2}$/.test(fraction) || (!digits && !fraction)) return null;
  const cents = Number(digits || "0") * 100 + Number((fraction + "00").slice(0, 2));
  return negative ? -cents : cents;
}

/** A quantity like 1,5 or 2 as thousandths, so hours and pieces both work without floats */
export function parseQuantity(value) {
  const s = String(value ?? "").trim().replace(",", ".");
  if (!/^-?\d+(\.\d{1,3})?$/.test(s)) return null;
  const [whole, fraction = ""] = s.replace("-", "").split(".");
  const milli = Number(whole) * 1000 + Number((fraction + "000").slice(0, 3));
  return s.startsWith("-") ? -milli : milli;
}

/** Rounds a / b to the nearest whole number, halves away from zero (the way tax offices round) */
export function roundDiv(a, b) {
  const sign = a < 0 ? -1 : 1;
  return sign * Math.floor((2 * Math.abs(a) + b) / (2 * b));
}

function group(digits, sep) {
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, sep);
}

export function formatMoney(cents, lang = "de", currency = "EUR") {
  const negative = cents < 0;
  const abs = Math.abs(cents);
  const whole = String(Math.floor(abs / 100));
  const fraction = String(abs % 100).padStart(2, "0");
  const number = lang === "en" ? `${group(whole, ",")}.${fraction}` : `${group(whole, ".")},${fraction}`;
  const sign = CURRENCY_SIGN[currency] || currency;
  const minus = negative ? "−" : "";
  // English puts the sign first (£1,200.00), German and Dutch after with a space (1.200,00 €)
  if (lang === "en") return `${minus}${sign}${number}`;
  if (lang === "nl") return `${minus}${sign} ${number}`;
  return `${minus}${number} ${sign}`;
}

export function formatQuantity(milli, lang = "de") {
  const whole = Math.trunc(milli / 1000);
  const fraction = String(Math.abs(milli) % 1000).padStart(3, "0").replace(/0+$/, "");
  return fraction ? `${whole}${lang === "en" ? "." : ","}${fraction}` : String(whole);
}

export function formatRate(basisPoints, lang = "de") {
  const whole = Math.floor(basisPoints / 100);
  const fraction = String(basisPoints % 100).padStart(2, "0").replace(/0+$/, "");
  const number = fraction ? `${whole}${lang === "en" ? "." : ","}${fraction}` : String(whole);
  return lang === "en" ? `${number}%` : `${number} %`;
}

const MONTHS = {
  de: ["Januar", "Februar", "März", "April", "Mai", "Juni", "Juli", "August", "September", "Oktober", "November", "Dezember"],
  en: ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"],
  nl: ["januari", "februari", "maart", "april", "mei", "juni", "juli", "augustus", "september", "oktober", "november", "december"]
};

/** 2026-11-08 as 8. November 2026, 8 November 2026 or 8 november 2026 */
export function formatDate(iso, lang = "de") {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || ""));
  if (!m) return iso ? String(iso) : "";
  const day = Number(m[3]);
  const month = MONTHS[lang]?.[Number(m[2]) - 1] || MONTHS.en[Number(m[2]) - 1];
  return lang === "de" ? `${day}. ${month} ${m[1]}` : `${day} ${month} ${m[1]}`;
}

/** 2026-11-08 as 08.11.2026 (German short form, used in tables) or 08/11/2026 or 08-11-2026 */
export function formatShortDate(iso, lang = "de") {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || ""));
  if (!m) return iso ? String(iso) : "";
  if (lang === "en") return `${m[3]}/${m[2]}/${m[1]}`;
  if (lang === "nl") return `${m[3]}-${m[2]}-${m[1]}`;
  return `${m[3]}.${m[2]}.${m[1]}`;
}

export function addDays(iso, days) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || ""));
  if (!m) return "";
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]) + (Number(days) || 0)));
  return d.toISOString().slice(0, 10);
}

export function today(now = new Date()) {
  return now.toISOString().slice(0, 10);
}

/** An IBAN in groups of four, the way people read it out */
export function formatIban(iban) {
  return String(iban || "").replace(/\s+/g, "").toUpperCase().replace(/(.{4})/g, "$1 ").trim();
}

/** The IBAN check digits (ISO 13616 mod 97), so a typo is caught before it goes on an invoice */
export function ibanIsValid(iban) {
  const s = String(iban || "").replace(/\s+/g, "").toUpperCase();
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{10,30}$/.test(s)) return false;
  const moved = s.slice(4) + s.slice(0, 4);
  const digits = moved.replace(/[A-Z]/g, (c) => String(c.charCodeAt(0) - 55));
  let rest = 0;
  for (const ch of digits) rest = (rest * 10 + Number(ch)) % 97;
  return rest === 1;
}
