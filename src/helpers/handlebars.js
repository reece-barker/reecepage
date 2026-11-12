// Handlebars helpers. Kept small and boring on purpose, logic belongs in the controllers and services,
// the templates should only decide how things look.
import { formatLongDate, formatLongDateGerman, formatMonthYear, formatMonthYearGerman, isoDate, isoDateTime } from "../utils/dates.js";
import { localePath, translator } from "../lib/i18n.js";
import { truncate } from "../utils/text.js";
import { iconSvg } from "./icons.js";

// Which language the page is in. Every template gets lang from the language middleware, anything rendered without it
// (the legal templates, tests) is English
const langOf = (options) => options?.data?.root?.lang || "en";

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

    // Text for the current language: {{t "nav.menu"}}, with values {{t "home.videoLong" length="6:36"}}. t is escaped like
    // any other output, so the texts in the dictionaries never hold html
    t: (key, options) => translator(langOf(options))(key, options?.hash),
    // Like t, for the texts that hold an email address: {email} in the text becomes a mailto link. The text and the
    // address are escaped first, so only the link this helper makes is html
    tMail: (key, email, options) => {
      const marker = "\u0000";
      const text = Handlebars.escapeExpression(translator(langOf(options))(key, { ...options?.hash, email: marker }));
      const address = Handlebars.escapeExpression(email);
      return new Handlebars.SafeString(text.replace(marker, `<a href="mailto:${address}">${address}</a>`));
    },
    // "2 minutes" or "a moment", for the too many requests page
    waitText: (minutes, options) => {
      const t = translator(langOf(options));
      return Number(minutes) > 0 ? t.count("errors.minute", Number(minutes)) : t("errors.aMoment");
    },
    // The one or other form for a number: {{tn "projects.project" count}}
    tn: (key, count, options) => translator(langOf(options)).count(key, count, options?.hash),
    // An adress in the current language, {{lp "/projects"}} is /de/projects on the german pages
    lp: (path, options) => localePath(langOf(options), String(path)),

    // The name of the analytics service for the cookie banner text
    analyticsName: (provider) => (provider === "umami" ? "Umami" : "Plausible"),

    eq: (a, b) => a === b,
    not: (value) => !value,
    and: (...args) => args.slice(0, -1).every(Boolean),
    or: (...args) => args.slice(0, -1).some(Boolean),
    includes: (list, value) => Array.isArray(list) && list.includes(value),
    add: (a, b) => Number(a) + Number(b),
    gt: (a, b) => Number(a) > Number(b),
    lower: (value) => String(value ?? "").toLowerCase(),
    // Why a revision was saved, in words for the revisions list in the admin
    revisionReason: (reason) => ({ save: "Saved", publish: "Published", autosave: "Autosaved", import: "Imported from the files", restore: "Restored", draft: "Switched to draft", trash: "Moved to the trash" }[reason] || reason),
    length: (list) => (Array.isArray(list) ? list.length : 0),

    longDate: (value, options) => (langOf(options) === "de" ? formatLongDateGerman(value) : formatLongDate(value)),
    longDateDe: (value) => formatLongDateGerman(value),
    monthYear: (value, options) => (langOf(options) === "de" ? formatMonthYearGerman(value) : formatMonthYear(value)),
    isoDate: (value) => isoDate(value),
    isoDateTime: (value) => isoDateTime(value),
    year: () => new Date().getUTCFullYear(),

    truncate: (value, max) => truncate(value, typeof max === "number" ? max : 160),
    branchLabel: (branch, options) => (["code", "earth", "faith"].includes(branch) ? translator(langOf(options))(`branch.${branch}`) : ""),
    plural: (count, one, many) => (Number(count) === 1 ? one : many),
    htmlLang: (options) => (langOf(options) === "de" ? "de" : "en-GB"),
    join: (list, separator) => (Array.isArray(list) ? list.join(typeof separator === "string" ? separator : ", ") : ""),

    // aria-current for the nav, also true for sub pages so "Projects" stays marked on a project page
    isCurrent: (href, currentPath) => {
      // The german cv has its own adress so the menu entry for the cv stays marked there
      const here = currentPath === "/lebenslauf" ? "/cv" : currentPath;
      return href === "/" ? here === "/" : here === href || here.startsWith(`${href}/`);
    },

    // Lets a template render a block only for the first n items: {{#each (limit list 3)}}
    limit: (list, count) => (Array.isArray(list) ? list.slice(0, count) : []),

    // A video length as minutes and seconds: 396 -> "6:36"
    clock: (seconds) => {
      const total = Math.max(0, Math.round(Number(seconds) || 0));
      return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
    },

    // A profile address without the https:// and www, for the CV: "github.com/reece-barker"
    shortUrl: (value) => String(value || "").replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, ""),

    // Telephone links need the number without spaces: "+49 170 1234567" -> "+491701234567"
    telHref: (value) => `tel:${String(value || "").replace(/[^\d+]/g, "")}`
  };
}
