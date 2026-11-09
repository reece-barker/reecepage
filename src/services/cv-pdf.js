// Turns the CV pages into the PDFs people download, with Chromium printing the real page so the PDF and the page cant
// say diffrent things. Two places use it:
//
//   npm run cv:pdf             on your computer, from the files in content/, saved to content/cv and committed
//   the button in the admin    on the live site, from the database, saved to var/cv
//
// The site serves whichever copy is newer. On the server Chromium comes from `npx playwright-core install chromium`
// (the deploy does that) plus the system libraries from `sudo npx playwright-core install-deps chromium`, once.
import { mkdir, readFile, rename, stat } from "node:fs/promises";
import path from "node:path";

export const CV_VERSIONS = {
  en: { path: "/cv", file: "reece-barker-cv.pdf", label: "English CV" },
  de: { path: "/lebenslauf", file: "reece-barker-lebenslauf.pdf", label: "German Lebenslauf" }
};

export class CvPdfError extends Error {}

/** Chromium from the container, the CHROMIUM_PATH setting, or the one Playwright downloaded, whichever is there */
export function chromiumOptions(env = process.env) {
  const options = { args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist", "--disable-crash-reporter"] };
  if (env.CHROMIUM_PATH) options.executablePath = env.CHROMIUM_PATH;
  return options;
}

async function loadChromium() {
  try {
    return (await import("playwright-core")).chromium;
  } catch {
    throw new CvPdfError("playwright-core isnt installed, run npm ci");
  }
}

/** How many pages a PDF has, so the admin can say "2 pages" and you notice when the CV grows */
export function countPages(buffer) {
  return (buffer.toString("latin1").match(/\/Type\s*\/Page(?!s)/g) || []).length;
}

/**
 * Prints each CV page to a PDF. Writes to a temporary file first, so a download in the middle never gets half a file
 * @param {object} options
 * @param {string} options.baseUrl where the site answers, like http://127.0.0.1:3000
 * @param {string} options.outDir the folder the PDFs go in
 * @returns {Promise<Array<{ lang: string, file: string, pages: number }>>}
 */
export async function makeCvPdfs({ baseUrl, outDir, versions = Object.keys(CV_VERSIONS), env = process.env }) {
  const chromium = await loadChromium();
  let browser;
  try {
    browser = await chromium.launch(chromiumOptions(env));
  } catch (error) {
    const first = String(error.message).split("\n").find((line) => line.trim()) || "";
    if (/Executable doesn't exist|install/i.test(error.message)) {
      throw new CvPdfError("Chromium isnt installed on this machine. On the server: npx playwright-core install chromium, then sudo npx playwright-core install-deps chromium");
    }
    throw new CvPdfError(`Chromium wouldnt start: ${first}`);
  }
  const made = [];
  try {
    await mkdir(outDir, { recursive: true });
    const page = await browser.newPage();
    await page.emulateMedia({ media: "print", colorScheme: "light" });
    for (const lang of versions) {
      const version = CV_VERSIONS[lang];
      const response = await page.goto(`${baseUrl}${version.path}`, { waitUntil: "networkidle", timeout: 30000 });
      if (!response?.ok()) throw new CvPdfError(`${version.path} answered ${response?.status()}, the page has to work before it can be printed`);
      // Fonts have to be there before printing, otherwise the PDF falls back to a system font
      await page.evaluate(() => globalThis.document.fonts.ready);
      const target = path.join(outDir, version.file);
      const temporary = `${target}.part`;
      await page.pdf({ path: temporary, format: "A4", printBackground: true, preferCSSPageSize: true });
      await rename(temporary, target);
      made.push({ lang, file: target, pages: countPages(await readFile(target)) });
    }
  } finally {
    await browser.close();
  }
  return made;
}

/**
 * Prints a page of the running site to a PDF and returns the bytes, for the admin's paperwork. Chromium opens the
 * address like a browser would (so the site's own stylesheet and pictures load, a page put in with setContent
 * has no origin and the site refuses to hand it the css). footerTemplate is printed on every page (Chromium
 * fills in the page numbers), in the bottom margin the page's own @page rule leaves free
 */
export async function printUrl({ url, footerTemplate = "", env = process.env }) {
  const chromium = await loadChromium();
  let browser;
  try {
    browser = await chromium.launch(chromiumOptions(env));
  } catch (error) {
    if (/Executable doesn't exist|install/i.test(error.message)) {
      throw new CvPdfError("Chromium isnt installed on this machine. On the server: npx playwright-core install chromium, then sudo npx playwright-core install-deps chromium");
    }
    throw new CvPdfError(`Chromium wouldnt start: ${String(error.message).split("\n")[0]}`);
  }
  try {
    const page = await browser.newPage();
    await page.emulateMedia({ media: "print", colorScheme: "light" });
    const response = await page.goto(url, { waitUntil: "networkidle", timeout: 30000 });
    if (!response?.ok()) throw new CvPdfError(`the page to print answered ${response?.status()}`);
    await page.evaluate(() => globalThis.document.fonts.ready);
    const pdf = await page.pdf({
      format: "A4",
      printBackground: true,
      preferCSSPageSize: true,
      displayHeaderFooter: Boolean(footerTemplate),
      headerTemplate: "<span></span>",
      footerTemplate: footerTemplate || "<span></span>"
    });
    return { pdf, pages: countPages(pdf) };
  } finally {
    await browser.close();
  }
}

/** The newest copy of a CV PDF out of the folders it can be in, or null when there is none */
export async function findCvPdf(dirs, lang) {
  const version = CV_VERSIONS[lang];
  if (!version) return null;
  let best = null;
  for (const dir of dirs) {
    const file = path.join(dir, version.file);
    const info = await stat(file).catch(() => null);
    if (info && (!best || info.mtime > best.date)) best = { file, date: info.mtime, name: version.file };
  }
  return best;
}
