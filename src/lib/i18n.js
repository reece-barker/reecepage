// The two languages of the site and the little helpers around them, english lives at the normal adresses and german is
// the same adress with /de infront of it (/de/projects). Only the public pages are translated, admin and the legal pages
// stay english on purpose cause legal texts need a proper german version from someone who can actualy check it.
import { en } from "./locales/en.js";
import { de } from "./locales/de.js";

export const LANGUAGES = ["en", "de"];
export const DEFAULT_LANGUAGE = "en";

const DICTIONARIES = { en, de };

// What each language is called in its own words for the dropdown, plus the codes search engines and screenreaders want
// (hreflang for the link, lang on the html tag and locale for the share cards)
export const LANGUAGE_INFO = Object.freeze({
  en: { code: "en", short: "EN", name: "English", html: "en-GB", locale: "en_GB" },
  de: { code: "de", short: "DE", name: "Deutsch", html: "de", locale: "de_DE" }
});

// Pages that exist in german, anything else under /de goes back to the english adress so a made up german adress
// never shows a half translated page
const GERMAN_PATHS = [
  /^\/$/,
  /^\/about$/,
  /^\/projects(\/[a-z0-9-]+)?$/,
  /^\/writing(\/[a-z0-9-]+)?$/,
  /^\/contact(\/thank-you)?$/
];

// Same page but other name, the cv allready had its own german page before the switch was a thing
const GERMAN_ALIASES = { "/cv": "/lebenslauf", "/lebenslauf": "/lebenslauf" };

export function hasGermanVersion(path) {
  return GERMAN_PATHS.some((pattern) => pattern.test(path));
}

/**
 * Splits "/de/projects/x" into { lang: "de", path: "/projects/x" }, anything without the prefix is english.
 * "/delta" and "/design" are NOT german only "/de" and "/de/..." are
 */
export function splitLanguage(urlPath) {
  const match = /^\/de(\/.*)?$/.exec(urlPath);
  if (!match) return { lang: "en", path: urlPath };
  return { lang: "de", path: match[1] && match[1] !== "/" ? match[1].replace(/\/+$/, "") || "/" : "/" };
}

/** A path in the given language, localePath("de", "/projects") is "/de/projects" and localePath("de", "/") is just "/de" */
export function localePath(lang, path) {
  if (lang !== "de" || !path.startsWith("/")) return path;
  // Pages with no german version and files keep there normal adress
  const [clean, rest = ""] = splitOnce(path);
  if (GERMAN_ALIASES[clean]) return GERMAN_ALIASES[clean] + rest;
  if (!hasGermanVersion(clean)) return path;
  return (clean === "/" ? "/de" : `/de${clean}`) + rest;
}

function splitOnce(path) {
  const index = path.search(/[?#]/);
  return index === -1 ? [path, ""] : [path.slice(0, index), path.slice(index)];
}

/**
 * Where the other language of this page is, the cv pair is its own thing and pages without a german version send people
 * to the german home page instead of a dead end
 */
export function alternatePath(lang, path) {
  const clean = path.replace(/\/+$/, "") || "/";
  if (clean === "/cv" || clean === "/lebenslauf") return { en: "/cv", de: "/lebenslauf" };
  const english = clean;
  const german = hasGermanVersion(english) ? localePath("de", english) : "/de";
  return { en: lang === "de" && !hasGermanVersion(english) ? "/" : english, de: german };
}

function lookup(dictionary, key) {
  return key.split(".").reduce((node, part) => (node && typeof node === "object" ? node[part] : undefined), dictionary);
}

/** Fills the {name} placeholders, format("{count} min read", { count: 4 }) */
function format(text, values) {
  if (!values) return text;
  return text.replace(/\{(\w+)\}/g, (whole, name) => (values[name] !== undefined ? String(values[name]) : whole));
}

/**
 * Returns t(key, values) for one language, a key missing in german falls back to the english text (the tests make
 * sure that never happens) and a key missing everywhere shows the key itself so its obvious on the page.
 * t.has(key) says if a key exists and t.count(key, 3) picks key_one or key_other and fills in {count}
 */
export function translator(lang) {
  const primary = DICTIONARIES[lang] || en;
  const find = (key) => lookup(primary, key) ?? lookup(en, key);
  const t = (key, values) => {
    const found = find(key);
    return typeof found === "string" ? format(found, values) : key;
  };
  t.has = (key) => typeof find(key) === "string";
  t.count = (key, count, values) => t(`${key}_${Number(count) === 1 ? "one" : "other"}`, { count, ...values });
  return t;
}

/** Every key in a dictionary as "a.b.c" for the test that compares the two languages */
export function flatKeys(dictionary, prefix = "") {
  return Object.entries(dictionary).flatMap(([key, value]) => (
    value && typeof value === "object" ? flatKeys(value, `${prefix}${key}.`) : [`${prefix}${key}`]
  ));
}

export { en, de };
