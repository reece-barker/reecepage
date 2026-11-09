// Makes the downloadable CVs (content/cv/reece-barker-cv.pdf and reece-barker-lebenslauf.pdf) straight from the /cv
// and /lebenslauf pages so the pdfs and the pages cant ever end up saying diffrent things.
//
//   npm run cv:pdf
//
// This one reads the files in content/, so run it after a git pull and commit the pdfs. On the live site the
// button in the admin CV editor does the same from the database, those copies go in var/cv and the newer one wins.
// It reads LEGAL_PHONE from .env so my number only ends up on the pdf if show_phone is on in cv.yml
import { existsSync } from "node:fs";
import path from "node:path";
import { ROOT_DIR } from "../src/config/index.js";
import { makeCvPdfs } from "../src/services/cv-pdf.js";
import { startLocalServer } from "./lib/local-server.js";

if (!process.env.LEGAL_PHONE && existsSync(path.join(ROOT_DIR, ".env"))) {
  try { process.loadEnvFile(path.join(ROOT_DIR, ".env")); } catch { /* no .env is fine, the pdf just has no phone number */ }
}

const server = await startLocalServer();
try {
  const made = await makeCvPdfs({ baseUrl: server.url, outDir: path.join(ROOT_DIR, "content/cv") });
  for (const pdf of made) console.log(`${path.relative(ROOT_DIR, pdf.file)}, ${pdf.pages} ${pdf.pages === 1 ? "page" : "pages"}`);
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  await server.close();
}
