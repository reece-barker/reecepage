// Business cards, the email signature and the compliments slip, ported from the Stationery Builder in the brand pack.
// They use the same details as the letters (My details) so a change of address is made once and every piece follows.
//
// The builder measured every line with a canvas and placed it by hand, here the layout is plain css instead and
// Chromium does the measuring when it prints, so the preview and the PDF are the same page again. The card is drawn
// at its real size in mm with the bleed round it, one side per PDF page, the slip is a DIN lang page (210 x 99 mm).
import { esc, withPlaceholders } from "./format.js";
import { LANG_FIELD } from "./letter.js";
import { businessType, cityLine, legalLines, senderName, taxLines } from "./business.js";
import { qrSvg } from "./qr.js";
import { PHOTO_EMAIL, photoTag } from "./photo.js";

// The brand colours, same as the brand pack
const C = { olive: "#33412A", olive80: "#5A6652", olive90: "#41532F", sage: "#9FB98F", sage50: "#C9D8BF", sage25: "#E4ECDF", blush: "#EFB9A4", cream: "#F9F4E8", leaf: "#C3D1B3", deep: "#4C5E3E" };
const SLOGAN = "Software that thinks like an ecosystem.";

const W = {
  de: { role: "Software und Green Tech", slip: "Mit besten Grüßen", details: "Angaben zum Unternehmen", detailsLaw: "Pflichtangaben", legal: "Impressum", privacy: "Datenschutz",
    paper: "Bitte nur drucken, wenn es wirklich nötig ist. Das spart Papier.",
    recycled: "Gedruckt auf 100 % Recyclingpapier", internship: "Ich suche ein Praktikum ab September 2027.",
    disclaimer: "Diese E-Mail und ihre Anhänge können vertrauliche Informationen enthalten und sind nur für den genannten Empfänger bestimmt. Wenn Sie nicht der richtige Empfänger sind, informieren Sie mich bitte und löschen Sie die Nachricht." },
  en: { role: "Software and green tech", slip: "With compliments", details: "Business details", detailsLaw: "Company details", legal: "Legal notice", privacy: "Privacy",
    paper: "Please only print this email if you really need to. It saves paper.",
    recycled: "Printed on 100% recycled paper", internship: "Looking for an internship from September 2027.",
    disclaimer: "This email and its attachments may contain confidential information and are intended only for the named recipient. If you are not the intended recipient, please tell me and delete the message." },
  nl: { role: "Software en groene technologie", slip: "Met vriendelijke groet", details: "Bedrijfsgegevens", detailsLaw: "Bedrijfsgegevens", legal: "Juridische informatie", privacy: "Privacy",
    paper: "Print deze e-mail alleen als het echt nodig is. Dat bespaart papier.",
    recycled: "Gedrukt op 100% gerecycled papier", internship: "Ik zoek een stage vanaf september 2027.",
    disclaimer: "Dit bericht en de bijlagen kunnen vertrouwelijke informatie bevatten en zijn alleen bestemd voor de genoemde ontvanger. Bent u niet de bedoelde ontvanger, laat het mij dan weten en verwijder het bericht." }
};
const words = (lang) => W[lang] || W.de;
// Quotation marks the way each language writes them
const QUOTES = { de: ["„", "“"], en: ["“", "”"], nl: ["“", "”"] };

const clean = (v) => String(v ?? "").trim();
const txt = (s) => withPlaceholders(s);
const isCompany = (details) => Boolean(businessType(details.entity).legal_form_default);
const webUrl = (details) => clean(details.web) ? `https://${clean(details.web).replace(/^https?:\/\//, "")}` : "";
const addressLine = (details) => [clean(details.street), cityLine(details, businessType(details.entity))].filter(Boolean).join(", ");

/** The fine print a business type has to give on business paper, with the firm name first for a company */
function fineLines(details, lang, { tax = false } = {}) {
  const lines = [...legalLines(details, lang)];
  if (tax) lines.push(...taxLines(details, lang));
  if (lines.length && isCompany(details)) lines.unshift(senderName(details));
  return lines;
}

/* ------------------------------------------------------------------ business cards */

const DESIGNS = {
  olive: { label: "Olive front, cream back",
    front: { bg: C.olive, logo: "reece-dove-long-stacked-colour-on-dark", slogan: C.cream },
    back: { bg: C.cream, ink: C.olive, sub: C.olive80, sym: "reece-dove-symbol-colour", qrDark: C.olive, qrLight: C.cream, band: "light" } },
  leaf: { label: "Cream front with a leaf border",
    front: { bg: C.cream, logo: "reece-dove-long-stacked-colour", slogan: C.olive80, border: true },
    back: { bg: C.olive, ink: C.cream, sub: C.sage50, sym: "reece-dove-symbol-colour-on-dark", qrDark: C.olive, qrLight: C.cream, qrBox: true, band: "dark" } },
  sage: { label: "Sage",
    front: { bg: C.sage, logo: "reece-dove-long-stacked-mono-olive", slogan: C.olive },
    back: { bg: C.sage25, ink: C.olive, sub: C.olive80, sym: "reece-dove-symbol-colour", qrDark: C.olive, qrLight: C.sage25, bar: C.sage } },
  white: { label: "Minimal white",
    front: { bg: "#FFFFFF", logo: "reece-dove-long-horizontal-colour", slogan: C.olive80, wide: true },
    back: { bg: "#FFFFFF", ink: C.olive, sub: C.olive80, sym: null, qrDark: C.olive, qrLight: "#FFFFFF", rule: C.sage } }
};
const SIZES = { eu: { w: 85, h: 55 }, us: { w: 88.9, h: 50.8 } };
// The compliments slip is a third of A4, same as Onlineprinters 1/3 A4 (9.9 x 21 cm trimmed)
const SLIP = { w: 210, h: 99 };
// How the card gets printed: the bleed is the colour running past the cut so a slightly off cut never shows a white
// edge. Onlineprinters wants 2 mm (data 8.9 x 5.9 cm for an 8.5 x 5.5 cm card), most other shops 3 mm, at home none
const PRINT = {
  shop2: { bleed: 2, label: "Print shop, 2 mm bleed (Onlineprinters)" },
  shop3: { bleed: 3, label: "Print shop with 3 mm bleed" },
  home: { bleed: 0, label: "Printing at home, cut size, no bleed" }
};
/** The box above the page with the notes for you that are never printed */
function notesAside(notes) {
  return notes.length ? `<aside class="doc-notes" aria-label="Notes for you, not printed"><strong>Notes for you, not printed</strong><ul>${notes.map((n) => `<li>${esc(n)}</li>`).join("")}</ul></aside>` : "";
}

/** The print setting of a card, older cards had a bleed tick box (3 mm) instead */
export function cardPrint(data) {
  if (Object.hasOwn(PRINT, data.print)) return { id: data.print, ...PRINT[data.print] };
  const id = data.bleed === false ? "home" : "shop3";
  return { id, ...PRINT[id] };
}

// One leaf is a lens between two points made of two equal circle arcs, the same shape as the pattern tile
function leafPath(cx, cy, len, angle, fat = 0.8) {
  const a = angle * Math.PI / 180, dx = Math.cos(a) * len / 2, dy = Math.sin(a) * len / 2, r = len * fat;
  const f = (n) => n.toFixed(3);
  return `M${f(cx - dx)} ${f(cy - dy)}A${f(r)} ${f(r)} 0 0 1 ${f(cx + dx)} ${f(cy + dy)}A${f(r)} ${f(r)} 0 0 1 ${f(cx - dx)} ${f(cy - dy)}Z`;
}

// A row of leaves along the bottom edge, running out into the bleed so the cut never shows a gap
function leafBand(w, h, b, dark) {
  const cols = dark ? [C.olive90, C.deep, C.olive90] : [C.sage, C.leaf, C.blush];
  const out = [];
  for (let x = -b + 2.5, i = 0; x < w + b; x += 8.4, i++) {
    const tilt = i % 3 === 2 ? 158 : (i % 2 ? -62 : -112), len = i % 3 === 2 ? 6.2 : 7.4, cy = i % 3 === 2 ? h - 2.2 : h + 0.2;
    out.push(`<path d="${leafPath(x + (i % 2 ? 1.2 : 0), cy, len, tilt)}" fill="${cols[i % 3]}"/>`);
  }
  return out.join("");
}

// The leaf border sits well inside the cut, 4.2 mm to the middle of the leaves, so their outer tips are about 2 mm from the edge. A cutter is
// allowed to be a mm out, and a border hugging the edge then looks thick on one side and gone on the other. Further in a mm either way barely shows
const BORDER_INSET = 4.2;

function leafBorder(w, h) {
  const cols = [C.sage, C.leaf, C.blush];
  const out = [];
  let i = 0;
  const d = BORDER_INSET;
  const edge = (x0, y0, x1, y1, base) => {
    const n = Math.max(1, Math.round(Math.hypot(x1 - x0, y1 - y0) / 8.6));
    for (let k = 0; k < n; k++, i++) {
      const t = (k + 0.5) / n;
      out.push(`<path d="${leafPath(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, i % 3 === 2 ? 5.2 : 6.4, base + (i % 2 ? 28 : -24))}" fill="${cols[i % 3]}"/>`);
    }
  };
  edge(d + 1, d, w - d - 1, d, 0); edge(w - d, d + 3.2, w - d, h - d - 3.2, 90); edge(w - d - 1, h - d, d + 1, h - d, 180); edge(d, h - d - 3.2, d, d + 3.2, 270);
  return out.join("");
}

/** The vCard in the QR code: name, phone, email, web. No address on purpose, it makes the code too dense for a card */
export function vcard(details, name) {
  const e = (s) => String(s).replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
  const parts = clean(name).split(/\s+/).filter(Boolean);
  const family = parts.length > 1 ? parts.at(-1) : "", given = parts[0] || "", middle = parts.slice(1, -1).join(" ");
  const out = ["BEGIN:VCARD", "VERSION:3.0", `N:${e(family)};${e(given)};${e(middle)};;`, `FN:${e(clean(name))}`];
  if (clean(details.phone)) out.push(`TEL;TYPE=CELL:${clean(details.phone).replace(/[^\d+]/g, "")}`);
  if (clean(details.email)) out.push(`EMAIL;TYPE=INTERNET:${clean(details.email)}`);
  if (webUrl(details)) out.push(`URL:${webUrl(details)}`);
  out.push("END:VCARD");
  return out.join("\r\n");
}

/* ------------------------------------------------------------------ the little icons on the back */

// Drawn here on a 24 unit grid with round strokes, plain shapes that print sharp at 2.4 mm. No brand logos, a
// person and a pair of code brackets say LinkedIn and GitHub well enough next to the address
const ICONS = {
  phone: '<rect x="7" y="2.5" width="10" height="19" rx="2.2"/><path d="M11 18.2h2"/>',
  email: '<rect x="3" y="5.5" width="18" height="13" rx="2"/><path d="m3.5 7 8.5 6 8.5-6"/>',
  web: '<circle cx="12" cy="12" r="9"/><ellipse cx="12" cy="12" rx="3.8" ry="9"/><path d="M3 12h18"/>',
  address: '<path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11z"/><circle cx="12" cy="10" r="2.3"/>',
  linkedin: '<circle cx="12" cy="8" r="3.6"/><path d="M5 20.5c.8-4 3.6-6.2 7-6.2s6.2 2.2 7 6.2"/>',
  github: '<path d="m8.5 7.5-5 4.5 5 4.5M15.5 7.5l5 4.5-5 4.5"/>'
};
const icon = (name) => `<svg class="card__icon" viewBox="0 0 24 24" aria-hidden="true">${ICONS[name]}</svg>`;
// linkedin.com/in/someone instead of the whole https://www. address, thats what fits on a card
const shortUrl = (url) => String(url || "").replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/$/, "");

/**
 * How much is on the back, roughly in lines, and from that how tight to set it. A card cant scroll, so instead of
 * cutting anything off the type gets a little smaller step by step, and past that the editor says its too much
 */
function backDensity({ contact, message, fine, hasRole }) {
  const messageLines = message ? Math.ceil(message.length / 46) : 0;
  const load = 2 + (hasRole ? 1 : 0) + contact + messageLines + fine * 0.8;
  if (load <= 7.5) return { cls: "", tooMuch: false };
  if (load <= 9) return { cls: " card__back--compact", tooMuch: false };
  return { cls: " card__back--tight", tooMuch: load > 10.5 };
}

// The quote's size from its length, so a short one is big and a long one still fits in a few balanced lines
function quoteSize(text) {
  const n = text.length;
  if (n <= 50) return "card__quote--short";
  if (n <= 100) return "card__quote--medium";
  if (n <= 150) return "card__quote--long";
  return "card__quote--longest";
}

function cardSide(inner, deco, { w, h, b, bleed, bg, side }) {
  const sw = bleed ? w + 2 * b : w, sh = bleed ? h + 2 * b : h, off = bleed ? b : 0;
  return `<section class="card card--${side}${bleed ? " card--bleed" : ""}" style="width:${sw}mm;height:${sh}mm;background:${bg}" aria-label="${side === "front" ? "Front" : "Back"}">
    <svg class="card__deco" viewBox="${-off} ${-off} ${sw} ${sh}" width="${sw}mm" height="${sh}mm" aria-hidden="true">${deco}</svg>
    <div class="card__trim" style="left:${off}mm;top:${off}mm;width:${w}mm;height:${h}mm">${inner}</div>
  </section>`;
}

export const card = {
  kind: "card",
  label: "Business card",
  code: "B",
  help: "Business cards in four designs, front and back, ready for a print shop: bleed, trim box, CMYK and nothing under 6 pt.",
  pdfFooter: false,
  fields: [
    LANG_FIELD,
    { name: "design", label: "Design", type: "select", required: true, options: Object.keys(DESIGNS), labels: Object.fromEntries(Object.entries(DESIGNS).map(([k, d]) => [k, d.label])) },
    { name: "format", label: "Size", type: "select", required: true, options: ["eu", "us"], labels: { eu: "EU, 85 x 55 mm", us: "US, 3.5 x 2 in" } },
    { name: "name", label: "Name", type: "text", max: 80 },
    { name: "role", label: "Line under the name", type: "text", max: 80 },
    { name: "front_text", label: "Under the logo", type: "select", required: true, options: ["slogan", "quote", "both", "none"], labels: { slogan: "The slogan", quote: "A quote", both: "A quote and the slogan", none: "Nothing, just the logo" } },
    { name: "slogan", label: "Slogan", type: "text", max: 60 },
    { name: "quote", label: "Quote", type: "object", help: "Wraps into balanced lines and gets smaller the longer it is. Up to about 150 characters reads well on a card", fields: [
      { name: "text", label: "The quote", type: "textarea", max: 220 },
      { name: "author", label: "Who said it", type: "text", max: 60 }
    ] },
    { name: "qr", label: "QR code on the back", type: "select", required: true, options: ["url", "vcard", "none"], labels: { url: "Your website", vcard: "Contact card (name, phone, email, web)", none: "No QR code" } },
    { name: "address", label: "Postal address", type: "checkbox" },
    { name: "linkedin", label: "LinkedIn", type: "checkbox", help: "From the site settings" },
    { name: "github", label: "GitHub", type: "checkbox", help: "From the site settings" },
    { name: "icons", label: "Icons in front of the phone number, email, website and the rest", type: "checkbox", default: true },
    { name: "photo", label: "My photo on the back", type: "checkbox", help: "A small round photo top right, in place of the little dove. The front stays the logo" },
    { name: "corner_note", label: "Small note in a corner", type: "text", max: 40, help: "Something like Printed on recycled paper. 6 pt, kept 4 mm inside the cut" },
    { name: "corner_side", label: "Which side the corner note goes on", type: "select", required: true, options: ["front", "back"], labels: { front: "Front, bottom left", back: "Back, under the fine print" } },
    { name: "message", label: "A line on the back", type: "textarea", max: 160, help: "Something like Looking for an internship from September 2027. Short reads best, the back gets tighter as it fills up" },
    { name: "fine", label: "The details your business type has to give", type: "checkbox", default: true, help: "Register, seat and directors for a company. A private person or freelancer has none" },
    { name: "tax", label: "Tax number or VAT ID", type: "checkbox" },
    { name: "print", label: "Printed by", type: "select", required: true, options: Object.keys(PRINT), labels: Object.fromEntries(Object.entries(PRINT).map(([k, v]) => [k, v.label])), help: "For a print shop the PDF has the bleed, a trim box and comes out in CMYK (FOGRA52, for uncoated paper). Page 1 is the front, page 2 the back, both the same way up" }
  ],

  defaults(details, lang = "de") {
    return { lang, design: "olive", format: businessType(details.entity).country === "US" ? "us" : "eu", name: details.full_name || "", role: words(lang).role, front_text: "slogan", slogan: SLOGAN, quote: { text: "", author: "" }, qr: "url", address: false, linkedin: false, github: false, icons: true, photo: false, message: words(lang).internship, corner_note: words(lang).recycled, corner_side: "back", fine: true, tax: false, print: "shop2" };
  },

  title(data) {
    return `${data.name || "Business card"}, ${DESIGNS[data.design]?.label.toLowerCase() || "card"}`;
  },

  render(data, { details, asset, profiles = {}, cmyk = null }) {
    const lang = data.lang || "de";
    const d = DESIGNS[data.design] || DESIGNS.olive;
    const notes = [];
    const size = SIZES[data.format] || SIZES.eu;
    const { w, h } = size;
    const print = cardPrint(data);
    const b = print.bleed;
    const bleed = b > 0;
    const F = d.front, B = d.back;

    // Front: the logo in the middle, under it the slogan, a quote or both. Older cards have no front_text yet and
    // keep showing their slogan
    const show = ["slogan", "quote", "both", "none"].includes(data.front_text) ? data.front_text : "slogan";
    const quote = data.quote && clean(data.quote.text) && (show === "quote" || show === "both") ? data.quote : null;
    const slogan = clean(data.slogan) && (show === "slogan" || show === "both") ? data.slogan : "";
    if ((show === "quote" || show === "both") && !quote) notes.push("The front is set to show a quote but there is no quote text yet.");
    if (quote && !clean(quote.author)) notes.push("The quote has no author yet.");
    if (quote && clean(quote.text).length > 150) notes.push("The quote is long for a card, it is set small to fit. Under about 150 characters reads better.");
    // with a quote the logo steps back so the words get the room
    const logoScale = quote ? (show === "both" ? 0.26 : 0.3) : (F.border ? 0.44 : 0.5);
    const logoStyle = F.wide ? `width:${(w * (quote ? 0.4 : 0.56)).toFixed(2)}mm` : `height:${(h * logoScale).toFixed(2)}mm`;
    const [open, close] = QUOTES[lang] || QUOTES.en;
    const quoteHtml = quote ? `<figure class="card__quote ${quoteSize(clean(quote.text))}"><blockquote>${esc(open)}${txt(clean(quote.text))}${esc(close)}</blockquote>${clean(quote.author) ? `<figcaption>${txt(quote.author)}</figcaption>` : ""}</figure>` : "";
    const corner = clean(data.corner_note);
    const cornerOnBack = corner && data.corner_side === "back";
    const cornerFront = corner && !cornerOnBack ? `<p class="card__corner${F.border ? " card__corner--border" : ""}" style="color:${F.slogan}">${txt(corner)}</p>` : "";
    const frontInner = `${cornerFront}<div class="card__front${quote ? " card__front--quote" : ""}${F.border ? " card__front--border" : ""}" style="color:${F.slogan}"><img src="${esc(asset(`images/brand/${F.logo}.svg`))}" alt="reece" style="${logoStyle}">${quoteHtml}${slogan ? `<p class="card__slogan">${txt(slogan)}</p>` : ""}</div>`;
    const front = cardSide(frontInner, F.border ? leafBorder(w, h) : "", { w, h, b, bleed, bg: F.bg, side: "front" });

    // Back: name and role at the top, contact in the middle, fine print and the QR code at the bottom
    // Each contact line with its icon: phone, email, website, then the extras that were ticked
    const contact = [["phone", clean(details.phone)], ["email", clean(details.email)], ["web", shortUrl(details.web)]];
    if (data.linkedin && profiles.linkedin) contact.push(["linkedin", shortUrl(profiles.linkedin)]);
    if (data.github && profiles.github) contact.push(["github", shortUrl(profiles.github)]);
    if (data.address && addressLine(details)) contact.push(["address", addressLine(details)]);
    const rows = contact.filter(([, value]) => value);
    const icons = data.icons !== false;
    const message = clean(data.message);
    const fine = data.fine === false ? [] : fineLines(details, lang, { tax: data.tax === true });
    const density = backDensity({ contact: rows.length, message, fine: fine.length + (clean(data.corner_note) && data.corner_side === "back" ? 1 : 0), hasRole: Boolean(clean(data.role)) });
    if (density.tooMuch) notes.push("The back is very full, it is set as small as it goes. Untick something or shorten the line on the back.");
    const qrText = data.qr === "vcard" ? vcard(details, data.name || details.full_name) : data.qr === "url" ? webUrl(details) : "";
    const qr = qrText ? `<div class="card__qr${B.qrBox ? " card__qr--box" : ""}">${qrSvg(qrText, { size: 14, dark: B.qrDark, light: B.qrLight, label: data.qr === "vcard" ? "QR code with my contact details" : `QR code for ${clean(details.web)}` })}</div>` : "";
    const band = B.band ? leafBand(w, h, b, B.band === "dark") : "";
    const bar = B.bar ? `<rect x="${-b}" y="${-b}" width="${b + 2.2}" height="${h + 2 * b}" fill="${B.bar}"/>` : "";
    const backInner = `<div class="card__back${B.band ? " card__back--band" : ""}${B.bar ? " card__back--bar" : ""}${density.cls}" style="color:${B.ink};--card-sub:${B.sub}">
      <div class="card__head">
        <div><p class="card__name">${txt(data.name || details.full_name || "[Name]")}</p>${clean(data.role) ? `<p class="card__role" style="color:${B.sub}">${txt(data.role)}</p>` : ""}</div>
        ${data.photo === true ? photoTag(asset, "card__photo") : B.sym ? `<img class="card__sym" src="${esc(asset(`images/brand/${B.sym}.svg`))}" alt="">` : ""}
      </div>
      <ul class="card__contact${icons ? " card__contact--icons" : ""}">${rows.map(([kind, value]) => `<li>${icons ? icon(kind) : ""}<span>${txt(value)}</span></li>`).join("")}</ul>
      ${message ? `<p class="card__message">${txt(message)}</p>` : ""}
      <div class="card__foot">
        <p class="card__fine" style="color:${B.sub}${B.rule ? `;border-top:0.3pt solid ${B.rule}` : ""}">${fine.map(txt).join("<br>")}${cornerOnBack ? `${fine.length ? "<br>" : ""}<span class="card__corner-line">${txt(corner)}</span>` : ""}</p>
        ${qr}
      </div>
    </div>`;
    const back = cardSide(backInner, bar + band, { w, h, b, bleed, bg: B.bg, side: "back" });

    const body = `<div class="cards cards--${data.format === "us" ? "us" : "eu"}${bleed ? ` cards--bleed cards--bleed${b}` : ""}">${front}${back}</div>`;
    if (b > 0 && cmyk && !cmyk.ready) notes.push(`The PDF comes out in RGB on this server because ${cmyk.reason}. The next deploy installs both, or the print shop converts it.`);
    if (fine.length > 5) notes.push("The fine print is long for a card, check it is still readable at this size.");
    return { body: notesAside(notes) + body, footer: "", title: `${senderName(details)}, business card`, notes, print: { w, h, bleed: b, cmyk: print.id !== "home" } };
  }
};

/* ------------------------------------------------------------------ compliments slip */

export const slip = {
  kind: "slip",
  label: "Compliments slip",
  code: "S",
  help: "A compliments slip, 1/3 A4 (210 x 99 mm, DIN lang) for a short note with something you send. Ready for a print shop: bleed, trim box, CMYK and nothing under 6 pt.",
  pdfFooter: false,
  fields: [
    LANG_FIELD,
    { name: "heading", label: "Heading", type: "text", max: 60 },
    { name: "message", label: "Short note", type: "textarea", max: 600, help: "Leave it empty to write by hand" },
    { name: "lines", label: "Writing lines when there is no note", type: "checkbox", default: true },
    { name: "photo", label: "My photo in the corner", type: "checkbox", help: "A small round photo next to your contact details" },
    { name: "slogan", label: "Slogan", type: "text", max: 60, help: "Empty for none" },
    { name: "print", label: "Printed by", type: "select", required: true, options: Object.keys(PRINT), labels: Object.fromEntries(Object.entries(PRINT).map(([k, v]) => [k, v.label])), help: "For a print shop the PDF is the slip plus its bleed (214 x 103 mm for Onlineprinters), has a trim box and comes out in CMYK (FOGRA52, for uncoated paper)" },
    { name: "back_page", label: "Empty back page for the print shop", type: "checkbox", default: true, help: "Their slips are printed on both sides (4/4) so the shop expects two pages. Untick it for a one sided order or at home" }
  ],

  defaults(details, lang = "de") {
    return { lang, heading: words(lang).slip, message: "", lines: true, photo: false, slogan: SLOGAN, print: "shop2", back_page: true };
  },

  title(data) {
    return data.heading || "Compliments slip";
  },

  render(data, { details, asset, cmyk = null }) {
    const lang = data.lang || "de";
    const contact = [clean(details.phone), clean(details.email), clean(details.web)].filter(Boolean);
    const fine = [`<strong>${txt(senderName(details))}</strong>`, txt(addressLine(details)), ...legalLines(details, lang).map(txt)].filter(Boolean);
    const lines = !clean(data.message) && data.lines !== false ? `<div class="slip__lines" aria-hidden="true">${"<span></span>".repeat(3)}</div>` : "";
    // Slips from before the print setting existed are printed by the shop like the cards now, thats what its for
    const print = Object.hasOwn(PRINT, data.print) ? { id: data.print, ...PRINT[data.print] } : { id: "shop2", ...PRINT.shop2 };
    const b = print.bleed, bleed = b > 0;
    // The page is the slip plus the bleed all round, the white paper means nothing runs into the bleed but the page
    // still has to be that size. The content sits in a box the size of the cut slip
    const pageStyle = `width:${SLIP.w + 2 * b}mm;height:${SLIP.h + 2 * b}mm`;
    const trimStyle = `left:${b}mm;top:${b}mm;width:${SLIP.w}mm;height:${SLIP.h}mm`;
    const pageClass = `slip${bleed ? ` slip--bleed slip--bleed${b}` : ""}`;
    const front = `<article class="${pageClass}" style="${pageStyle}" aria-label="Front">
  <div class="slip__trim" style="${trimStyle}">
    <header class="slip__head">
      <img class="slip__logo" src="${esc(asset("images/brand/reece-dove-long-horizontal-colour.svg"))}" alt="reece">
      <div class="slip__id"><div class="slip__contact"><p class="slip__name">${txt(details.full_name || "[Name]")}</p><p>${contact.map(txt).join("<br>")}</p></div>${data.photo === true ? photoTag(asset, "slip__photo") : ""}</div>
    </header>
    <h1 class="slip__heading">${txt(data.heading || words(lang).slip)}</h1>
    ${clean(data.message) ? `<p class="slip__message">${txt(data.message).replace(/\n/g, "<br>")}</p>` : lines}
    <footer class="slip__foot"><p>${fine.join(" · ")}</p>${clean(data.slogan) ? `<p class="slip__slogan">${txt(data.slogan)}</p>` : ""}</footer>
  </div>
</article>`;
    // The shops slips are printed on both sides, so page two is the empty back
    const backPage = bleed && data.back_page !== false ? `<article class="${pageClass} slip--back" style="${pageStyle}" aria-label="Back, empty"><div class="slip__trim" style="${trimStyle}"></div></article>` : "";
    const notes = [];
    if (bleed && cmyk && !cmyk.ready) notes.push(`The PDF comes out in RGB on this server because ${cmyk.reason}. The next deploy installs both, or the print shop converts it.`);
    if (fine.length > 4) notes.push("The fine print is long for a slip, check it still fits at the bottom.");
    return { body: notesAside(notes) + front + backPage, footer: "", title: `${senderName(details)}, ${slip.title(data)}`, notes, print: { w: SLIP.w, h: SLIP.h, bleed: b, cmyk: print.id !== "home" } };
  }
};

/* ------------------------------------------------------------------ email signature */

const SANS = "Arial,Helvetica,sans-serif", SERIF = "Georgia,'Times New Roman',serif";

// The signature colours. A mail app can show the signature on white or on near black and a copied signature only keeps its inline
// styles, so every colour is a mid tone that reads on both (about 4:1 on white and on a dark grey) and not the dark olive of the
// paper, which was 1.5:1 on a dark background. Three jobs so it isnt one flat green: leaf green for the name, clay (the blush of
// the brand, darkened) for the links, a warm grey for the small print. The mail apps that follow dark mode (Apple Mail, Outlook,
// Thunderbird) get the light brand colours on top of that from the style block, which is lost when a mail app strips it and
// then the mid tones still read
const INK = "#5E8A48", LINK = "#C4694F", SUB = "#857F73";
const DARK_CSS = `<style>@media (prefers-color-scheme:dark){.sg-ink{color:${C.cream} !important}.sg-link{color:${C.blush} !important}.sg-sub{color:${C.sage50} !important}}[data-ogsc] .sg-ink{color:${C.cream} !important}[data-ogsc] .sg-link{color:${C.blush} !important}[data-ogsc] .sg-sub{color:${C.sage50} !important}</style>`;

// Companies (and Dutch sole traders, and UK sole traders with a trading name) have to put their details in every
// business email, so even the minimal signature keeps them for those
function detailsRequired(details) {
  const t = businessType(details.entity);
  return isCompany(details) || t.id === "nl-eenmanszaak" || (t.id === "uk-sole" && Boolean(clean(details.trading_name)));
}

function detailLines(details, lang) {
  const first = [senderName(details), addressLine(details)].filter(Boolean).join(", ");
  return [first, ...legalLines(details, lang)].filter(Boolean);
}

/**
 * The signature as email html (tables and inline styles, the only thing every mail app shows the same) and as plain
 * text. preview swaps the hosted png for the svg and marks [placeholders]
 */
export function signatureParts(data, details, { baseUrl = "", asset = (p) => `/${p}`, preview = false, profiles = {} } = {}) {
  const lang = data.lang || "de";
  const w = words(lang);
  const style = ["full", "short", "minimal"].includes(data.style) ? data.style : "full";
  const mark = (s) => preview ? txt(s) : esc(s);
  const name = clean(data.name) || clean(details.full_name) || "[Name]";
  const web = clean(details.web), url = webUrl(details);
  const sep = `<span style="color:${C.blush}">&nbsp;&nbsp;|&nbsp;&nbsp;</span>`;
  const a = (href, text) => `<a class="sg-link" href="${esc(href)}" style="color:${LINK};text-decoration:none">${mark(text)}</a>`;
  const contact = [clean(details.phone) ? a(`tel:${clean(details.phone).replace(/[^\d+]/g, "")}`, details.phone) : "", clean(details.email) ? a(`mailto:${clean(details.email)}`, details.email) : "", web ? a(url, web) : ""].filter(Boolean).join(sep);
  // LinkedIn and GitHub from the site settings, as links with their names (the ticks on the form did nothing before)
  const social = [data.linkedin && profiles.linkedin ? ["LinkedIn", profiles.linkedin] : null, data.github && profiles.github ? ["GitHub", profiles.github] : null].filter(Boolean);
  const links = data.links !== false && baseUrl ? [[w.legal, `${baseUrl}/impressum`], [w.privacy, `${baseUrl}/privacy`]] : [];
  const linkHtml = links.map(([t, u]) => `<a class="sg-sub" href="${esc(u)}" style="color:${SUB};text-decoration:underline">${esc(t)}</a>`).join(sep);
  const required = detailsRequired(details);
  const detail = detailLines(details, lang);
  const showBlock = (businessType(details.entity).letter || []).length > 0;
  const td = (inner, extra = "") => `<td class="sg-ink" style="font-family:${SANS};font-size:13px;line-height:19px;color:${INK};${extra}">${inner}</td>`;
  const small = (inner, extra = "") => `<tr><td class="sg-sub" colspan="2" style="font-family:${SANS};font-size:11px;line-height:16px;color:${SUB};${extra}">${inner}</td></tr>`;
  const table = (inner) => `${preview ? "" : DARK_CSS}<table class="sg-ink" role="presentation" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;font-family:${SANS};font-size:13px;line-height:19px;color:${INK}">${inner}</table>`;
  const nameStyle = `font-family:${SERIF};font-weight:normal`;
  // The save paper line at the very bottom. Not in the minimal variant (its for replies in a thread, as short as it
  // gets) and an emptied field means none. Signatures from before the field existed get the default line
  const note = style === "minimal" ? "" : data.note === undefined ? w.paper : clean(data.note);

  let html;
  if (style === "minimal") {
    let inner = `<tr>${td(`<span class="sg-ink" style="${nameStyle};font-size:15px;color:${INK}">${mark(name)}</span>${web ? sep + a(url, web) : ""}`)}</tr>`;
    if (required) inner += `<tr>${td(mark(detail.join(" · ")), `font-size:11px;line-height:16px;color:${SUB};padding-top:4px`)}</tr>`;
    html = table(inner);
  } else {
    // The photo takes the dovess place when its ticked: round, clearly bigger than the dove is wide so the face reads
    const withPhoto = data.photo === true;
    const symbol = withPhoto ? (style === "full" ? 88 : 68) : style === "full" ? 64 : 48, symbolH = withPhoto ? symbol : Math.round(symbol * 202 / 249);
    const src = withPhoto ? (preview ? `/${PHOTO_EMAIL}` : `${baseUrl}/${PHOTO_EMAIL}`) : preview ? asset("images/brand/reece-dove-symbol-colour.svg") : `${baseUrl}/email/reece-dove-symbol-144.png`;
    let right = `<div class="sg-ink" style="${nameStyle};font-size:${style === "full" ? 19 : 17}px;line-height:24px;color:${INK}">${mark(name)}</div>`;
    if (clean(data.role)) right += `<div class="sg-sub" style="font-family:${SANS};font-size:13px;line-height:19px;color:${SUB}">${mark(data.role)}</div>`;
    right += `<div style="font-family:${SANS};font-size:13px;line-height:19px;padding-top:6px">${contact}</div>`;
    if (social.length) right += `<div style="font-family:${SANS};font-size:13px;line-height:19px">${social.map(([label, href]) => a(href, label)).join(sep)}</div>`;
    if (data.address && addressLine(details)) right += `<div class="sg-sub" style="font-family:${SANS};font-size:12px;line-height:18px;color:${SUB}">${mark(addressLine(details))}</div>`;
    if (clean(data.slogan)) right += `<div class="sg-sub" style="font-family:${SERIF};font-size:12px;line-height:18px;color:${SUB};padding-top:4px">${mark(data.slogan)}</div>`;
    let inner = `<tr><td valign="top" style="width:${symbol + 16}px;padding:2px 16px 0 0;vertical-align:top"><img src="${esc(src)}" width="${symbol}" height="${symbolH}" alt="${withPhoto ? "" : "reece"}" style="display:block;border:0;width:${symbol}px;height:${symbolH}px"></td><td valign="top" style="padding:0 0 0 16px;border-left:2px solid ${C.sage};vertical-align:top">${right}</td></tr>`;
    if (style === "full" && showBlock) inner += small(`<div class="sg-ink" style="font-weight:bold;color:${INK}">${esc(isCompany(details) ? w.detailsLaw : w.details)}</div><div>${mark(detail.join(" · "))}</div>`, "padding-top:14px");
    else if (style === "short" && required) inner += small(mark(detail.join(" · ")), "padding-top:10px");
    if (linkHtml) inner += small(linkHtml, "padding-top:8px");
    if (style === "full" && data.disclaimer) inner += small(esc(w.disclaimer), "padding-top:10px;font-size:10px;line-height:14px");
    // A small leaf and the line next to it, in its own little table so the leaf lines up with the text in Outlook too
    if (note) {
      const leaf = preview ? asset("images/brand/leaf-mark.svg") : `${baseUrl}/email/leaf-32.png`;
      inner += small(`<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse"><tr><td valign="middle" style="width:22px;padding:0 6px 0 0;vertical-align:middle"><img src="${esc(leaf)}" width="16" height="16" alt="" style="display:block;border:0;width:16px;height:16px"></td><td class="sg-sub" valign="middle" style="font-family:${SANS};font-size:11px;line-height:16px;color:${SUB};vertical-align:middle">${mark(note)}</td></tr></table>`, "padding-top:14px");
    }
    html = table(inner);
  }

  // The plain text version, for mail apps set to plain text. "-- " with the space is the standard signature separator
  let text;
  if (style === "minimal") {
    text = [`${name}${web ? ` | ${web}` : ""}`, ...(required ? [detail.join(" · ")] : [])].join("\n");
  } else {
    const lines = ["-- ", name];
    if (clean(data.role)) lines.push(clean(data.role));
    lines.push([clean(details.phone), clean(details.email), web].filter(Boolean).join(" | "));
    if (social.length) lines.push(social.map(([label, href]) => `${label}: ${href}`).join(" | "));
    if (data.address && addressLine(details)) lines.push(addressLine(details));
    if (clean(data.slogan)) lines.push(clean(data.slogan));
    if (style === "full" && showBlock) lines.push("", isCompany(details) ? w.detailsLaw : w.details, ...detail);
    else if (style === "short" && required) lines.push("", detail.join(" · "));
    if (links.length) lines.push("", ...links.map(([t, u]) => `${t}: ${u}`));
    if (style === "full" && data.disclaimer) lines.push("", w.disclaimer);
    if (note) lines.push("", note);
    text = lines.join("\n");
  }
  return { html, text, required, placeholders: /\[[^\]]+\]/.test(text) };
}

export const signature = {
  kind: "signature",
  label: "Email signature",
  code: "E",
  help: "An email signature for Outlook, Apple Mail, Gmail and the rest: copy it, or download it as an html file.",
  outputs: ["signature"],
  fields: [
    LANG_FIELD,
    { name: "style", label: "Variant", type: "select", required: true, options: ["full", "short", "minimal"], labels: { full: "Full, with the business details", short: "Short", minimal: "Minimal, for replies in a thread" } },
    { name: "name", label: "Name", type: "text", max: 80 },
    { name: "role", label: "Line under the name", type: "text", max: 80 },
    { name: "address", label: "Postal address", type: "checkbox" },
    { name: "linkedin", label: "LinkedIn", type: "checkbox", help: "From the site settings" },
    { name: "github", label: "GitHub", type: "checkbox", help: "From the site settings" },
    { name: "photo", label: "My photo instead of the dove", type: "checkbox", help: "A round photo next to your name. Not in the minimal variant" },
    { name: "links", label: "Links to the legal notice and privacy pages", type: "checkbox", default: true },
    { name: "slogan", label: "Slogan", type: "text", max: 60, help: "Empty for none" },
    { name: "note", label: "Save paper note", type: "text", max: 100, help: "The last line, with a small leaf in front of it. Empty for none, the minimal variant never has it" },
    { name: "disclaimer", label: "Confidentiality note (full variant only)", type: "checkbox" },
    { name: "dark", label: "Show the preview on a dark background", type: "checkbox", help: "To check it still reads when a mail app puts it on a dark background without changing its colours. Nothing changes in the signature" }
  ],

  defaults(details, lang = "de") {
    return { lang, style: "full", name: details.full_name || "", role: words(lang).role, address: false, links: true, slogan: SLOGAN, photo: false, note: words(lang).paper, disclaimer: false, dark: false };
  },

  title(data) {
    return `Email signature, ${data.style || "full"}`;
  },

  render(data, { details, asset, baseUrl, profiles = {} }) {
    const parts = signatureParts(data, details, { baseUrl, asset, preview: true, profiles });
    const notes = [];
    if (parts.placeholders) notes.push("Some details are still [placeholders], fill them in under My details before you copy it.");
    if (parts.required && data.style === "minimal") notes.push("Your business type has to give its details in every business email, so the minimal variant keeps them.");
    const body = `<div class="sig${data.dark ? " sig--dark" : ""}">
  ${notes.length ? `<aside class="doc-notes"><ul>${notes.map((n) => `<li>${esc(n)}</li>`).join("")}</ul></aside>` : ""}
  <section class="sig__mail" aria-label="The signature in an email"><p class="sig__fake">${esc({ de: "Viele Grüße", en: "Best wishes", nl: "Met vriendelijke groet" }[data.lang] || "Best wishes")}</p>${parts.html}</section>
  <section class="sig__plain" aria-label="Plain text version"><h2>Plain text version</h2><pre>${esc(parts.text)}</pre></section>
</div>`;
    return { body, footer: "", title: "Email signature", notes };
  }
};
