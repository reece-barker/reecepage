// Dates are shown the British way ("12 October 2026") and stored as ISO strings

const LONG = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
const LONG_DE = new Intl.DateTimeFormat("de-DE", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
const MONTH_YEAR = new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric", timeZone: "UTC" });

/** Accepts a Date, "2026-10-12" or "2026-10" and returns a Date at midnight UTC, or null when it cant be read */
export function toDate(value) {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value !== "string" && typeof value !== "number") return null;
  const text = String(value).trim();
  const match = /^(\d{4})(?:-(\d{2}))?(?:-(\d{2}))?$/.exec(text);
  const date = match
    ? new Date(Date.UTC(Number(match[1]), Number(match[2] || 1) - 1, Number(match[3] || 1)))
    : new Date(text);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatLongDate(value) {
  const date = toDate(value);
  return date ? LONG.format(date) : "";
}

/** "12. Oktober 2026", for the German halves of the legal pages */
export function formatLongDateGerman(value) {
  const date = toDate(value);
  return date ? LONG_DE.format(date) : "";
}

export function formatMonthYear(value) {
  const date = toDate(value);
  return date ? MONTH_YEAR.format(date) : "";
}

export function isoDate(value) {
  const date = toDate(value);
  return date ? date.toISOString().slice(0, 10) : "";
}

export function isoDateTime(value) {
  const date = toDate(value);
  return date ? date.toISOString() : "";
}
