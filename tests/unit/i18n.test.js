// The language helpers and the two dictionaries, same keys in both and adresses built the right way round
import { test } from "node:test";
import assert from "node:assert/strict";
import { alternatePath, de, en, flatKeys, hasGermanVersion, localePath, splitLanguage, translator } from "../../src/lib/i18n.js";

test("german has every key english has, and the other way round", () => {
  const english = flatKeys(en).sort();
  const german = flatKeys(de).sort();
  assert.deepEqual(german.filter((key) => !english.includes(key)), [], "keys only in German");
  assert.deepEqual(english.filter((key) => !german.includes(key)), [], "keys only in English");
});

test("every text in both languages is filled, has no em dash and keeps the same placeholders", () => {
  const placeholders = (text) => (text.match(/\{\w+\}/g) || []).sort().join(",");
  // The singular form of a plural is allowed to leave the number out ("1 Punkt"), the plural form never is
  for (const key of flatKeys(en).filter((name) => !name.endsWith("_one"))) {
    const read = (dictionary) => key.split(".").reduce((node, part) => node[part], dictionary);
    const english = read(en);
    const german = read(de);
    assert.ok(typeof german === "string" && german.trim(), `${key} is empty in German`);
    assert.ok(!german.includes("—") && !english.includes("—"), `${key} has an em dash`);
    assert.equal(placeholders(german), placeholders(english), `${key} has different placeholders`);
  }
});

test("addresses get /de in front only for pages that exist in German", () => {
  assert.equal(localePath("de", "/"), "/de");
  assert.equal(localePath("de", "/projects"), "/de/projects");
  assert.equal(localePath("de", "/projects/kino"), "/de/projects/kino");
  assert.equal(localePath("de", "/projects?branch=code"), "/de/projects?branch=code");
  assert.equal(localePath("de", "/about#skills"), "/de/about#skills");
  assert.equal(localePath("de", "/cv"), "/lebenslauf");
  assert.equal(localePath("de", "/privacy"), "/privacy");
  assert.equal(localePath("de", "/admin/login"), "/admin/login");
  assert.equal(localePath("de", "https://github.com/reece-barker"), "https://github.com/reece-barker");
  assert.equal(localePath("en", "/projects"), "/projects");
});

test("the prefix is read from the start of the path only", () => {
  assert.deepEqual(splitLanguage("/de"), { lang: "de", path: "/" });
  assert.deepEqual(splitLanguage("/de/"), { lang: "de", path: "/" });
  assert.deepEqual(splitLanguage("/de/projects/kino"), { lang: "de", path: "/projects/kino" });
  assert.deepEqual(splitLanguage("/design"), { lang: "en", path: "/design" });
  assert.deepEqual(splitLanguage("/delta/de"), { lang: "en", path: "/delta/de" });
  assert.ok(hasGermanVersion("/contact/thank-you"));
  assert.ok(!hasGermanVersion("/contact/thank-you/x"));
  assert.ok(!hasGermanVersion("/admin"));
});

test("the other language of a page: the same page when there is one, the German home page when there is not", () => {
  assert.deepEqual(alternatePath("en", "/projects/kino"), { en: "/projects/kino", de: "/de/projects/kino" });
  assert.deepEqual(alternatePath("de", "/"), { en: "/", de: "/de" });
  assert.deepEqual(alternatePath("en", "/privacy"), { en: "/privacy", de: "/de" });
  assert.deepEqual(alternatePath("en", "/cv"), { en: "/cv", de: "/lebenslauf" });
  assert.deepEqual(alternatePath("de", "/lebenslauf"), { en: "/cv", de: "/lebenslauf" });
});

test("t fills placeholders, picks one or other and falls back to english", () => {
  const t = translator("de");
  assert.equal(t("contact.errors.messageShort", { min: 10 }), "Bitte schreiben Sie mindestens 10 Zeichen, damit ich weiß, worum es geht.");
  assert.equal(t.count("errors.minute", 1), "1 Minute");
  assert.equal(t.count("errors.minute", 3), "3 Minuten");
  assert.equal(translator("en").count("errors.minute", 3), "3 minutes");
  assert.equal(t("does.not.exist"), "does.not.exist");
  assert.ok(t.has("nav.projects"));
  assert.ok(!t.has("nav.nothing"));
});
