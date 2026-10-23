// The HTML for one picture or video from the media library, used in articles ([[media:slug]]) and on the media
// pages, so they look the same everywhere. Every value is escaped, titles and captions come from the admin form.

import { iconSvg } from "./icons.js";

const escape = (value) => String(value ?? "")
  .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

// How wide a picture shows at each size, so the browser picks the smallest file from srcset thats still sharp.
// Matches the widths in styles/components/_content-blocks.scss
const SIZES = {
  small: "(min-width: 40rem) 15rem, 100vw",
  medium: "(min-width: 40rem) 22rem, 100vw",
  text: "(min-width: 48rem) 44rem, 100vw",
  wide: "(min-width: 72rem) 52rem, 100vw",
  full: "100vw"
};

/** srcset from the smaller copies made at upload, plus the original as the biggest one */
function srcset(item) {
  if (!Array.isArray(item.variants) || !item.variants.length || !item.width) return "";
  const list = [...item.variants.filter((v) => v.width < item.width).map((v) => `${escape(v.src)} ${v.width}w`), `${escape(item.src)} ${item.width}w`];
  return ` srcset="${list.join(", ")}"`;
}

function imageTag(item, { eager, size = "text" }) {
  const dims = item.width && item.height ? ` width="${item.width}" height="${item.height}"` : "";
  const set = srcset(item);
  return `<img src="${escape(item.src)}"${set}${set ? ` sizes="${SIZES[size] || SIZES.text}"` : ""} alt="${escape(item.alt)}"${dims} loading="${eager ? "eager" : "lazy"}" decoding="async">`;
}

/**
 * @param {ReturnType<import("../services/media-service.js").MediaService["present"]>} item
 * @param {object} [options]
 * @param {boolean} [options.eager] load straight away (the first thing on a page), otherwise lazy
 * @param {boolean} [options.showCaption]
 * @param {{ size?: string, align?: string, caption?: string, link?: string }} [options.layout] how it sits in the
 *   text, from the block editor. caption here replaces the library caption, an empty one hides it
 */
export function mediaFigure(item, { eager = false, showCaption = true, layout = null } = {}) {
  const size = item.width && item.height ? ` width="${item.width}" height="${item.height}"` : "";
  const placed = layout ? ` content-figure content-figure--${layout.size || "text"}${(layout.size === "small" || layout.size === "medium") && layout.align && layout.align !== "center" ? ` content-figure--${layout.align}` : ""}` : "";
  // The credit always shows, licences like CC BY need it next to the work. The caption can be left out where the
  // page already says the same thing next to it
  const ownCaption = layout && layout.caption !== undefined ? layout.caption : item.caption;
  const captionText = showCaption && ownCaption ? escape(ownCaption) : "";
  const creditText = item.credit ? `<span class="media-credit">${escape(item.credit)}</span>` : "";
  const caption = captionText || creditText ? `<figcaption>${[captionText, creditText].filter(Boolean).join(" ")}</figcaption>` : "";
  if (item.isVideo) {
    const track = item.captionsSrc ? `<track kind="captions" src="${escape(item.captionsSrc)}" srclang="en" label="English" default>` : "";
    const transcript = item.transcript
      ? `<details class="media-transcript"><summary>Read the transcript</summary><p>${escape(item.transcript)}</p></details>`
      : "";
    // The credit goes last and small for videos, its still right next to the work like CC BY wants but it doesnt
    // sit under the player looking like a caption anymore
    const videoCaption = captionText ? `<figcaption>${captionText}</figcaption>` : "";
    const videoCredit = item.credit ? `<p class="media-credit media-credit--small">${escape(item.credit)}</p>` : "";
    const length = item.durationSeconds ? clock(item.durationSeconds) : "";
    // The play button is hidden untill main.js shows it, so without javascript its just the normal browser player
    const play = `<button class="video-frame__play" type="button" data-video-play hidden aria-label="Play the video: ${escape(item.title)}">`
      + `<span class="video-frame__pill"><span class="video-frame__icon">${iconSvg("play")}</span>`
      + `<span class="video-frame__label">Play${length ? ` <span class="video-frame__time">${length}</span>` : ""}</span></span></button>`;
    return `<figure class="media-figure media-figure--video${placed}">`
      + `<div class="video-frame" data-video>`
      + `<video controls playsinline preload="${eager ? "metadata" : "none"}"${item.posterSrc ? ` poster="${escape(item.posterSrc)}"` : ""}${size} aria-label="${escape(item.title)}">`
      + `<source src="${escape(item.src)}" type="${escape(item.mime)}">${track}`
      + `<p>Your browser cannot play this video. <a href="${escape(item.src)}">Download it</a> instead.</p></video>`
      + `${play}</div>`
      + `${videoCaption}${transcript}${videoCredit}</figure>`;
  }
  const image = imageTag(item, { eager, size: layout?.size });
  const linked = layout?.link ? `<a href="${escape(layout.link)}"${/^https?:\/\//i.test(layout.link) ? ' rel="noopener"' : ""}>${image}</a>` : image;
  return `<figure class="media-figure${placed}">${linked}${caption}</figure>`;
}

/** Pictures side by side. Each keeps its own alt text, credits are collected under the whole gallery */
export function galleryFigure(items, { columns = "3", caption = "", size = "wide" } = {}) {
  const pictures = items.filter((item) => item && !item.isVideo);
  if (!pictures.length) return "";
  const credits = [...new Set(pictures.map((item) => item.credit).filter(Boolean))];
  const lines = [caption ? escape(caption) : "", credits.length ? `<span class="media-credit">${credits.map(escape).join(" ")}</span>` : ""].filter(Boolean);
  const cols = ["2", "3", "4"].includes(String(columns)) ? String(columns) : "3";
  return `<figure class="content-gallery content-gallery--cols-${cols} content-figure content-figure--${size}">`
    + `<ul class="content-gallery__grid" role="list">${pictures.map((item) => `<li>${imageTag(item, { size: cols === "2" ? "medium" : "small" })}</li>`).join("")}</ul>`
    + `${lines.length ? `<figcaption>${lines.join(" ")}</figcaption>` : ""}</figure>`;
}

// 396 -> "6:36", same as the clock helper in the templates
function clock(seconds) {
  const total = Math.max(0, Math.round(Number(seconds) || 0));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

/** "PT6M36S" style length for structured data */
export function isoDuration(seconds) {
  if (!seconds) return undefined;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `PT${m ? `${m}M` : ""}${s}S`;
}
