// The HTML for one picture or video from the media library, used in articles ([[media:slug]]) and on the media
// pages, so they look the same everywhere. Every value is escaped, titles and captions come from the admin form.

import { iconSvg } from "./icons.js";

const escape = (value) => String(value ?? "")
  .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

/** @param {ReturnType<import("../services/media-service.js").MediaService["present"]>} item */
export function mediaFigure(item, { eager = false, showCaption = true } = {}) {
  const size = item.width && item.height ? ` width="${item.width}" height="${item.height}"` : "";
  // The credit always shows, licences like CC BY need it next to the work. The caption can be left out where the
  // page already says the same thing next to it
  const captionText = showCaption && item.caption ? escape(item.caption) : "";
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
    return `<figure class="media-figure media-figure--video">`
      + `<div class="video-frame" data-video>`
      + `<video controls playsinline preload="${eager ? "metadata" : "none"}"${item.posterSrc ? ` poster="${escape(item.posterSrc)}"` : ""}${size} aria-label="${escape(item.title)}">`
      + `<source src="${escape(item.src)}" type="${escape(item.mime)}">${track}`
      + `<p>Your browser cannot play this video. <a href="${escape(item.src)}">Download it</a> instead.</p></video>`
      + `${play}</div>`
      + `${videoCaption}${transcript}${videoCredit}</figure>`;
  }
  return `<figure class="media-figure"><img src="${escape(item.src)}" alt="${escape(item.alt)}"${size} loading="${eager ? "eager" : "lazy"}" decoding="async">${caption}</figure>`;
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
