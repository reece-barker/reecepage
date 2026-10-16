// Small text helpers that both the server code and the templates use

/** Turns any heading or title into a url friendly id: "Why green tech?" -> "why-green-tech" */
export function slugify(value) {
  return String(value ?? "")
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

/** Cuts text on a word boundary, used for meta descriptions so search results dont end mid word */
export function truncate(value, max = 160) {
  const text = String(value ?? "").replace(/\s+/g, " ").trim();
  if (text.length <= max) return text;
  const cut = text.slice(0, max - 1);
  const lastSpace = cut.lastIndexOf(" ");
  return `${(lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).replace(/[\s,.;:]+$/, "")}…`;
}

/** Plain text from a small bit of HTML, only for things like reading time and feeds, never for security */
export function stripTags(html) {
  return String(html ?? "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

export function readingMinutes(text, wordsPerMinute = 220) {
  const words = stripTags(text).split(" ").filter(Boolean).length;
  return Math.max(1, Math.round(words / wordsPerMinute));
}

const EM_DASH = /\u2014/;
/** House rule: no em dashes anywhere the public can read. The content checker uses this */
export function hasEmDash(value) {
  return EM_DASH.test(String(value ?? ""));
}
