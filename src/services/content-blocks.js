// The extra Markdown the block editor writes, on top of normal Markdown. Each one sits on its own line(s) so the
// files still read fine as plain text and GitHub shows them sensibly:
//
//   [[media:my-photo size=wide align=center caption="Text under it"]]   a picture or video from the media library
//   [[gallery:one,two,three columns=3 caption="Text"]]                  pictures side by side
//   [[button href="/contact" label="Get in touch" style=primary]]       a link that looks like a button
//   :::note title="Good to know"                                        a callout box: note, tip or warning
//   Any Markdown in here
//   :::
//   :::quote cite="Name, their role"                                    a quote with who said it
//   The quote
//   :::
//
// Media and galleries need the database to know the file, size and alt text, so here they only become a
// placeholder comment and renderMediaShortcodes in media-service.js swaps them for the real thing per request.

export const IMAGE_SIZES = ["small", "medium", "text", "wide", "full"];
export const ALIGNS = ["left", "center", "right"];
export const CALLOUTS = ["note", "tip", "warning"];
export const BUTTON_STYLES = ["primary", "secondary"];

const escapeHtml = (value) => String(value ?? "")
  .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

/**
 * Reads key=value pairs. Values are a bare word or "double quoted" with \" and \\ inside.
 * Anything it doesnt understand is skipped rather than thrown, a typo in a file shouldnt take a page down
 */
export function parseAttributes(text) {
  const out = {};
  const pattern = /([a-z][a-z0-9_-]*)=(?:"((?:[^"\\]|\\.)*)"|([^\s"\]]+))/gi;
  for (const match of String(text || "").matchAll(pattern)) {
    out[match[1].toLowerCase()] = match[2] !== undefined ? match[2].replace(/\\(.)/g, "$1") : match[3];
  }
  return out;
}

/** The other way round, for the editor and tests: { size: "wide", caption: "A \"b\"" } -> size=wide caption="A \"b\"" */
export function formatAttributes(attrs) {
  return Object.entries(attrs)
    .filter(([, value]) => value !== undefined && value !== null && value !== "")
    .map(([key, value]) => (/^[a-z0-9-]+$/i.test(String(value)) ? `${key}=${value}` : `${key}="${String(value).replace(/\\/g, "\\\\").replace(/"/g, "\\\"")}"`))
    .join(" ");
}

const pick = (value, allowed, fallback) => (allowed.includes(value) ? value : fallback);

/** Media placeholder: base64url JSON in an HTML comment, nothing in it can close the comment early */
export function mediaPlaceholder(data) {
  return `<!--rp-media:${Buffer.from(JSON.stringify(data)).toString("base64url")}-->`;
}

export function readMediaPlaceholder(encoded) {
  try { return JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")); } catch { return null; }
}

/** Only links that are safe to put in an href: this site, https, http and mailto */
export function safeHref(value) {
  const href = String(value || "").trim();
  if (/^(\/(?!\/)|#|https?:\/\/|mailto:)/i.test(href)) return href;
  return null;
}

/** Adds the block syntax to a Marked instance */
export function renderBlockSyntax(marked) {
  marked.use({
    extensions: [
      {
        name: "rpMedia",
        level: "block",
        start(src) { return src.match(/^\[\[(media|gallery):/m)?.index; },
        tokenizer(src) {
          const match = /^\[\[(media|gallery):([a-z0-9,-]{1,800})(?:\s+([^\]\n]*))?\]\](?:\n+|$)/.exec(src);
          if (!match) return undefined;
          const attrs = parseAttributes(match[3]);
          const slugs = match[2].split(",").filter((slug) => /^[a-z0-9-]{1,80}$/.test(slug)).slice(0, 12);
          if (!slugs.length) return undefined;
          return { type: "rpMedia", raw: match[0], kind: match[1], slugs, attrs };
        },
        renderer(token) {
          const a = token.attrs;
          const data = token.kind === "gallery"
            ? { kind: "gallery", slugs: token.slugs, columns: pick(String(a.columns), ["2", "3", "4"], token.slugs.length >= 3 ? "3" : "2"), caption: a.caption, size: pick(a.size, ["text", "wide", "full"], "wide") }
            : { kind: "media", slug: token.slugs[0], size: pick(a.size, IMAGE_SIZES, "text"), align: pick(a.align, ALIGNS, "center"), caption: a.caption, link: safeHref(a.link) || undefined };
          return `${mediaPlaceholder(data)}\n`;
        }
      },
      {
        name: "rpButton",
        level: "block",
        start(src) { return src.match(/^\[\[button\s/m)?.index; },
        tokenizer(src) {
          const match = /^\[\[button\s+([^\]\n]*)\]\](?:\n+|$)/.exec(src);
          if (!match) return undefined;
          return { type: "rpButton", raw: match[0], attrs: parseAttributes(match[1]) };
        },
        renderer(token) {
          const href = safeHref(token.attrs.href);
          const label = String(token.attrs.label || "").trim();
          if (!href || !label) return "";
          const style = pick(token.attrs.style, BUTTON_STYLES, "primary");
          const external = /^https?:\/\//i.test(href) && !/^https?:\/\/(www\.)?reece\.page/i.test(href);
          return `<p class="content-button"><a class="button${style === "secondary" ? " button--secondary" : ""}" href="${escapeHtml(href)}"${external ? ' rel="noopener"' : ""}>${escapeHtml(label)}</a></p>\n`;
        }
      },
      {
        name: "rpContainer",
        level: "block",
        start(src) { return src.match(/^:::[a-z]/m)?.index; },
        tokenizer(src) {
          // :::kind attrs, then everything up to a line that is only ::: (the first one, callouts dont nest)
          const match = /^:::([a-z]+)([^\n]*)\n([\s\S]*?)\n:::[ \t]*(?:\n+|$)/.exec(src);
          if (!match) return undefined;
          const kind = match[1];
          if (![...CALLOUTS, "quote"].includes(kind)) return undefined;
          const token = { type: "rpContainer", raw: match[0], kind, attrs: parseAttributes(match[2]), tokens: [] };
          this.lexer.blockTokens(match[3], token.tokens);
          return token;
        },
        renderer(token) {
          const inner = this.parser.parse(token.tokens);
          if (token.kind === "quote") {
            const cite = String(token.attrs.cite || "").trim();
            return `<figure class="content-quote"><blockquote>\n${inner}</blockquote>${cite ? `<figcaption>${escapeHtml(cite)}</figcaption>` : ""}</figure>\n`;
          }
          const title = String(token.attrs.title || "").trim();
          const label = { note: "Note", tip: "Tip", warning: "Warning" }[token.kind];
          return `<aside class="callout callout--${token.kind}" aria-label="${escapeHtml(title || label)}">${title ? `<p class="callout__title">${escapeHtml(title)}</p>` : ""}\n${inner}</aside>\n`;
        }
      }
    ]
  });
}
