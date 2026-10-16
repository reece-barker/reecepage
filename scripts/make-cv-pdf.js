// Makes the downloadable CV, content/cv/reece-barker-cv.pdf, from the /cv page so the PDF and the page never disagree.
//
//   npm run cv:pdf
//
// Run it after changing cv.yml, the timeline, skills or the projects on the CV, or press the button in the admin.
// It reads LEGAL_PHONE from .env so the phone number makes it onto the PDF when show_phone is on in cv.yml
import { existsSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";
import { ROOT_DIR } from "../src/config/index.js";
import { startLocalServer, chromiumOptions } from "./lib/local-server.js";

const OUT = path.join(ROOT_DIR, "content/cv/reece-barker-cv.pdf");

if (!process.env.LEGAL_PHONE && existsSync(path.join(ROOT_DIR, ".env"))) {
  try { process.loadEnvFile(path.join(ROOT_DIR, ".env")); } catch { /* no .env is fine, the pdf just has no phone number */ }
}

const server = await startLocalServer();
const browser = await chromium.launch(chromiumOptions());
try {
  const page = await browser.newPage();
  const response = await page.goto(`${server.url}/cv`, { waitUntil: "networkidle" });
  if (!response?.ok()) throw new Error(`/cv answered ${response?.status()}, is the site building ok?`);
  await page.emulateMedia({ media: "print", colorScheme: "light" });
  await mkdir(path.dirname(OUT), { recursive: true });
  await page.pdf({ path: OUT, format: "A4", printBackground: true, preferCSSPageSize: true, pageRanges: "1" });
  console.log(`CV saved to ${path.relative(ROOT_DIR, OUT)}`);
} finally {
  await browser.close();
  await server.close();
}
