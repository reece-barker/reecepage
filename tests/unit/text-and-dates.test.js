import { test } from "node:test";
import assert from "node:assert/strict";
import { slugify, truncate, stripTags, readingMinutes, hasEmDash } from "../../src/utils/text.js";
import { toDate, formatLongDate, formatLongDateGerman, formatMonthYear, isoDate } from "../../src/utils/dates.js";

test("slugify", () => {
  assert.equal(slugify("Why green tech?"), "why-green-tech");
  assert.equal(slugify("Café & Crème"), "cafe-and-creme");
  assert.equal(slugify("  --Hello--  "), "hello");
  assert.equal(slugify(null), "");
  assert.ok(slugify("a".repeat(200)).length <= 80);
});

test("truncate cuts on a word and adds an ellipsis", () => {
  assert.equal(truncate("short", 10), "short");
  const cut = truncate("The quick brown fox jumps over the lazy dog", 20);
  assert.ok(cut.length <= 20);
  assert.ok(cut.endsWith("…"));
  assert.ok(!cut.includes("jum"));
});

test("stripTags and reading time", () => {
  assert.equal(stripTags("<p>Hello <b>there</b></p>"), "Hello there");
  assert.equal(readingMinutes("word ".repeat(10)), 1);
  assert.equal(readingMinutes("word ".repeat(1100)), 5);
});

test("em dash detection", () => {
  assert.equal(hasEmDash("a — b"), true);
  assert.equal(hasEmDash("a - b, a – b"), false);
});

test("dates read the formats the content uses", () => {
  assert.equal(isoDate("2026"), "2026-01-01");
  assert.equal(isoDate("2026-02"), "2026-02-01");
  assert.equal(isoDate("2026-10-12"), "2026-10-12");
  assert.equal(isoDate(new Date(Date.UTC(2026, 9, 12))), "2026-10-12");
  assert.equal(toDate("not a date"), null);
  assert.equal(toDate(undefined), null);
});

test("dates are shown the British and German way", () => {
  assert.equal(formatLongDate("2026-10-12"), "12 October 2026");
  assert.equal(formatLongDateGerman("2026-10-12"), "12. Oktober 2026");
  assert.equal(formatMonthYear("2027-02"), "February 2027");
  assert.equal(formatLongDate("rubbish"), "");
});
