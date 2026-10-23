// Makes the downloadable CV (content/cv/reece-barker-cv.pdf) straight from the /cv page so the pdf and the page cant
// ever end up saying diffrent things.
//
//   npm run cv:pdf
//
// Run it whenever cv.yml, the timeline, skills or the cv projects change or just press the button in the admin which
// does the same thing. It reads LEGAL_PHONE from .env so my number only ends up on the pdf if show_phone is on in cv.yml
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
