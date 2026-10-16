// The HTML for one picture or video from the media library, used in articles ([[media:slug]]) and on the media
// pages, so they look the same everywhere. Every value is escaped, titles and captions come from the admin form.

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
    return `<figure class="media-figure media-figure--video">`
      + `<video controls playsinline preload="${eager ? "metadata" : "none"}"${item.posterSrc ? ` poster="${escape(item.posterSrc)}"` : ""}${size} aria-label="${escape(item.title)}">`
      + `<source src="${escape(item.src)}" type="${escape(item.mime)}">${track}`
      + `<p>Your browser cannot play this video. <a href="${escape(item.src)}">Download it</a> instead.</p></video>`
      + `${caption}${transcript}</figure>`;
  }
  return `<figure class="media-figure"><img src="${escape(item.src)}" alt="${escape(item.alt)}"${size} loading="${eager ? "eager" : "lazy"}" decoding="async">${caption}</figure>`;
}

/** "PT6M36S" style length for structured data */
export function isoDuration(seconds) {
  if (!seconds) return undefined;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `PT${m ? `${m}M` : ""}${s}S`;
}
