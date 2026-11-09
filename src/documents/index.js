// Every kind of document the admin can make, with the form it needs and how it is drawn. Adding a kind is one file
// with fields, defaults, title and render, then a line here.
import { letter } from "./letter.js";
import { invoice } from "./invoice.js";
import { contract } from "./contract.js";
import { card, signature, slip } from "./stationery.js";

export const KINDS = { letter, invoice, contract, card, slip, signature };

export function documentKind(kind) {
  return Object.hasOwn(KINDS, kind) ? KINDS[kind] : null;
}

/**
 * The form fields with the payment accounts filled into the account picker. A contract's fields depend on its type
 * so that kind works them out from the saved data
 */
export function fieldsFor(kind, accounts = [], data = {}) {
  const def = documentKind(kind);
  if (!def) return [];
  if (def.fieldsFor) return def.fieldsFor(data, accounts);
  return def.fields.map((field) => field.name === "account" ? { ...field, options: accounts.map((a) => a.label).filter(Boolean) } : field);
}
