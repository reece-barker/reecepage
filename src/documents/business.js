// Who is sending: the business details from the admin (Paperwork, My details) turned into the name, the address
// and the legally required lines for the business type, from entities.json. A private person in Germany prints
// nothing extra, a GmbH has to print its seat, register and directors on every letter (§ 35a GmbHG) and so on.
// The personal Steuer-IdNr. has no field anywhere, it never goes on a letter or invoice.
import { readFileSync } from "node:fs";

const ENTITIES = JSON.parse(readFileSync(new URL("./entities.json", import.meta.url), "utf8"));
import { words } from "./words.js";

export const BUSINESS_TYPES = ENTITIES.types;

export function businessType(id) {
  return ENTITIES.types.find((t) => t.id === id) || ENTITIES.types[0];
}

const isCompany = (type) => Boolean(type.legal_form_default);
const clean = (v) => String(v ?? "").trim();

/**
 * The details from the admin list (My details) as one flat object, with the site's owner settings filling in
 * whatever hasnt been typed yet, so the first letter already has a name and an address
 */
export function businessDetails(doc, owner = {}) {
  const d = doc && typeof doc === "object" ? doc : {};
  return {
    entity: d.entity || "de-private",
    full_name: d.full_name || owner.name || "",
    trading_name: d.trading_name || "",
    legal_form: d.legal_form || "",
    street: d.street || owner.street || "",
    postcode: d.postcode || owner.postcode || "",
    city: d.city || owner.city || "",
    country: d.country || owner.country || "",
    phone: d.phone || (owner.show_phone ? owner.phone : "") || "",
    email: d.email || owner.email || "",
    web: d.web || "",
    small_business: Boolean(d.small_business),
    prefix: String(d.prefix || "RP").replace(/[^A-Za-z0-9]/g, "").slice(0, 8) || "RP",
    ...(d.tax || {}),
    ...(d.company || {})
  };
}

/** Postcode and city in the order the country writes them */
export function cityLine(details, type) {
  const postcode = clean(details.postcode), city = clean(details.city);
  if (type.country === "UK") return [city, postcode].filter(Boolean).join(" ");
  if (type.country === "US") return [city, postcode].filter(Boolean).join(", ");
  return [postcode, city].filter(Boolean).join(" ");
}

/** The name a letter is from: the firm with its legal form for a company, otherwise the person */
export function senderName(details) {
  const type = businessType(details.entity);
  if (isCompany(type)) {
    const base = clean(details.trading_name) || clean(details.full_name) || "[Firmenname]";
    const form = clean(details.legal_form) || type.legal_form_default;
    return base.endsWith(form) ? base : `${base} ${form}`;
  }
  return clean(details.trading_name) || clean(details.full_name) || "[Name]";
}

/** Name and address, line by line, for the letterhead and the parties of a contract */
export function senderLines(details, lang) {
  const type = businessType(details.entity);
  const w = words(lang);
  const out = [senderName(details)];
  if (!isCompany(type) && clean(details.trading_name) && clean(details.full_name) && clean(details.trading_name) !== clean(details.full_name)) {
    out.push(`${w.owner}: ${clean(details.full_name)}`);
  }
  if (clean(details.street)) out.push(clean(details.street));
  const city = cityLine(details, type);
  if (city) out.push(city);
  if (clean(details.country) && type.country !== "DE" && lang !== "en") out.push(clean(details.country));
  return out;
}

/** The small line above the window of a DIN letter, so a returned letter finds its way back */
export function returnLine(details) {
  const type = businessType(details.entity);
  return [senderName(details), clean(details.street), cityLine(details, type)].filter(Boolean).join(", ");
}

/** The lines the law wants on a business letter for this type (register, seat, directors), with their labels */
export function legalLines(details, lang) {
  const type = businessType(details.entity);
  const w = words(lang);
  const out = [];
  for (const key of type.letter || []) {
    if (key === "seat" && clean(details.seat)) out.push(`${w.seat}: ${clean(details.seat)}`);
    if (key === "register_court" && clean(details.register_court)) out.push(`${w.register}: ${clean(details.register_court)}${clean(details.register_number) ? `, ${clean(details.register_number)}` : ""}`);
    if (key === "directors" && clean(details.directors)) out.push(`${w.directors}: ${clean(details.directors)}`);
    if (key === "kvk" && clean(details.kvk)) out.push(`${w.kvk} ${clean(details.kvk)}`);
    if (key === "company_number" && clean(details.company_number)) out.push(`${w.companyNo} ${clean(details.company_number)}`);
    if (key === "registered_in" && clean(details.registered_in)) out.push(`${w.registeredIn} ${clean(details.registered_in)}`);
    if (key === "registered_office" && clean(details.registered_office)) out.push(clean(details.registered_office));
  }
  return out;
}

/** Tax numbers this type can have and that are filled in, in print order */
export function taxLines(details, lang) {
  const type = businessType(details.entity);
  const w = words(lang);
  const labels = { tax_number: w.taxNumber, vat_id: w.vatId, w_id: w.wId, btw_id: w.btw };
  return (type.tax || []).filter((key) => clean(details[key])).map((key) => `${labels[key]}: ${clean(details[key])}`);
}

/** Whats missing that this type has to print, so the editor can say so before anything is sent */
export function missingRequired(details, kind) {
  const type = businessType(details.entity);
  const missing = [];
  for (const key of type.letter || []) {
    if (key === "full_name" && !clean(details.full_name)) missing.push("full_name");
    if (key === "street_postcode_city" && (!clean(details.street) || !clean(details.city))) missing.push("street");
    if (["seat", "register_court", "register_number", "directors", "kvk", "company_number", "registered_in", "registered_office"].includes(key) && !clean(details[key])) missing.push(key);
  }
  if (kind === "invoice") {
    for (const rule of type.invoice || []) {
      if (rule === "tax_number_or_vat_id" && !clean(details.tax_number) && !clean(details.vat_id)) missing.push("tax_number");
      if (rule === "btw_id" && !clean(details.btw_id)) missing.push("btw_id");
    }
  }
  return missing;
}

/** Germany, UK sole traders not registered for VAT and the like can invoice without VAT */
export function smallBusinessAllowed(details) {
  const type = businessType(details.entity);
  return Boolean(type.kleinunternehmer) || type.id === "de-private" || (type.country === "NL" && !isCompany(type)) || type.country === "UK" || type.country === "US";
}

export function defaultCurrency(details) {
  return { UK: "GBP", US: "USD" }[businessType(details.entity).country] || "EUR";
}
