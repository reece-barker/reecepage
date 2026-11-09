// The HTML shell every document is printed from: the same markup goes into the live preview next to the form and
// into Chromium for the PDF, so the preview is what you get. Letters follow DIN 5008 form B on A4: letterhead 45 mm,
// address window from 45 mm, the information block from 50 mm at 125 mm from the left, the subject at 98.46 mm (all in
// styles/paperwork.scss). The fold and punch marks are left off: theyre optional in DIN 5008, and Chromium wont print
// anything in the left margin where they belong.
import { esc } from "./format.js";
import { words } from "./words.js";

/**
 * @param {object} options
 * @param {string} options.title for the browser tab and the PDF's title
 * @param {string} options.lang
 * @param {string} options.body the document itself
 * @param {string} options.stylesheet the href of the compiled paperwork.css
 * @param {string} [options.footer] the footer lines, shown under the sheet in the preview (the PDF prints them on every page)
 * @param {boolean} [options.preview] marks placeholders and shows the page edges
 */
export function pageHtml({ title, lang, body, stylesheet, footer = "", preview = false, base = "" }) {
  return `<!doctype html>
<html lang="${esc(lang === "en" ? "en-GB" : lang)}">
<head>
<meta charset="utf-8">
${base ? `<base href="${esc(base)}">` : ""}
<title>${esc(title)}</title>
<link rel="stylesheet" href="${esc(stylesheet)}">
</head>
<body class="paper${preview ? " paper--preview" : ""}">
${body}
${preview && footer ? `<footer class="doc-footer-preview" aria-label="Footer on every page">${footer}</footer>` : ""}
</body>
</html>`;
}

/** The footer Chromium prints on every page: the fine print and Page x of y. Inline styles only, its a template */
export function pdfFooterTemplate({ lang, footer, number }) {
  const w = words(lang);
  const pageNo = `${w.page} <span class="pageNumber"></span> ${w.of} <span class="totalPages"></span>`;
  return `<div style="width:100%;font-family:'Nunito Sans',Arial,sans-serif;font-size:6.6pt;line-height:1.35;color:#5a6652;padding:0 20mm 0 25mm;-webkit-print-color-adjust:exact;">
  <div style="border-top:0.5pt solid #d6cfb8;padding-top:2mm;display:flex;gap:6mm;justify-content:space-between;">
    <div style="display:flex;gap:6mm;flex-wrap:wrap;">${footer}</div>
    <div style="white-space:nowrap;text-align:right;">${number ? `${esc(number)}<br>` : ""}${pageNo}</div>
  </div>
</div>`;
}

/** Columns of the footer: each is a list of short lines */
export function footerColumns(columns) {
  return columns.filter((col) => col.length).map((col) => `<div>${col.map(esc).join("<br>")}</div>`).join("");
}
