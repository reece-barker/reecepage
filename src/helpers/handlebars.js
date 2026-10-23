// Handlebars helpers. Kept small and boring on purpose, logic belongs in the controllers and services,
// the templates should only decide how things look.
import { formatLongDate, formatLongDateGerman, formatMonthYear, isoDate, isoDateTime } from "../utils/dates.js";
import { truncate } from "../utils/text.js";
import { iconSvg } from "./icons.js";

const BRANCH_LABELS = { code: "Code", earth: "Earth", faith: "People" };

/**
 * @param {{ assets: import("../services/asset-manifest.js").AssetManifest }} deps
 * @param {typeof import("handlebars")} Handlebars needed for SafeString when a helper returns markup
 */
export function createHelpers({ assets }, Handlebars) {
  return {
    asset: (name) => assets.url(name),

    icon: (name, options) => new Handlebars.SafeString(iconSvg(name, { label: options?.hash?.label })),

    // Wraps each word of a heading in a span so the CSS can uncover them one after another. The text is escaped first
    matteWords: (text) => new Handlebars.SafeString(
      String(text ?? "").split(/\s+/).filter(Boolean)
        .map((word) => `<span class="word">${Handlebars.escapeExpression(word)}</span>`).join(" ")
    ),

    // Safe JSON inside a <script type="application/ld+json">. Escaping < stops a "</script>" in any title from
    // closing the tag early, which would otherwise be an XSS hole
    jsonLd: (value) => new Handlebars.SafeString(
      JSON.stringify(value).replace(/</g, "\\u003c").replace(/>/g, "\\u003e").replace(/&/g, "\\u0026")
    ),

    // Legal texts read their facts from config. A missing value shows as a highlighted [placeholder] in development,
    // and production refuses to start while the important ones are missing (see config/index.js)
    lv: (value, label) => new Handlebars.SafeString(
      value ? Handlebars.escapeExpression(value) : `<span class="placeholder-value">[${Handlebars.escapeExpression(typeof label === "string" ? label : "missing")}]</span>`
    ),

    eq: (a, b) => a === b,
    not: (value) => !value,
    and: (...args) => args.slice(0, -1).every(Boolean),
    or: (...args) => args.slice(0, -1).some(Boolean),
    includes: (list, value) => Array.isArray(list) && list.includes(value),
    add: (a, b) => Number(a) + Number(b),
    gt: (a, b) => Number(a) > Number(b),
    length: (list) => (Array.isArray(list) ? list.length : 0),

    longDate: (value) => formatLongDate(value),
    longDateDe: (value) => formatLongDateGerman(value),
    monthYear: (value) => formatMonthYear(value),
    isoDate: (value) => isoDate(value),
    isoDateTime: (value) => isoDateTime(value),
    year: () => new Date().getUTCFullYear(),

    truncate: (value, max) => truncate(value, typeof max === "number" ? max : 160),
    branchLabel: (branch) => BRANCH_LABELS[branch] || "",
    plural: (count, one, many) => (Number(count) === 1 ? one : many),
    join: (list, separator) => (Array.isArray(list) ? list.join(typeof separator === "string" ? separator : ", ") : ""),

    // aria-current for the nav, also true for sub pages so "Projects" stays marked on a project page
    isCurrent: (href, currentPath) => href === "/" ? currentPath === "/" : currentPath === href || currentPath.startsWith(`${href}/`),

    // Lets a template render a block only for the first n items: {{#each (limit list 3)}}
    limit: (list, count) => (Array.isArray(list) ? list.slice(0, count) : []),

    // A video length as minutes and seconds: 396 -> "6:36"
    clock: (seconds) => {
      const total = Math.max(0, Math.round(Number(seconds) || 0));
      return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
    },

    // A profile address without the https:// and www, for the CV: "github.com/reece-barker"
    shortUrl: (value) => String(value || "").replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, ""),

    // Telephone links need the number without spaces: "+49 162 5865374" -> "+491625865374"
    telHref: (value) => `tel:${String(value || "").replace(/[^\d+]/g, "")}`
  };
}
