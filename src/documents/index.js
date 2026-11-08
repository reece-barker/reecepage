// Every kind of document the admin can make, with the form it needs and how it is drawn. Adding a kind is one file
// with fields, defaults, title and render, then a line here.
import { letter } from "./letter.js";
import { invoice } from "./invoice.js";

export const KINDS = { letter, invoice };

export function documentKind(kind) {
  return Object.hasOwn(KINDS, kind) ? KINDS[kind] : null;
}

/** The form fields with the payment accounts filled into the account picker */
export function fieldsFor(kind, accounts = []) {
  const def = documentKind(kind);
  if (!def) return [];
  return def.fields.map((field) => field.name === "account" ? { ...field, options: accounts.map((a) => a.label).filter(Boolean) } : field);
}
