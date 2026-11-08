// The German CV fills in what nobody translated, and the PDF page count the admin reports
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { germanWhen } from "../../src/controllers/profile-controller.js";
import { countPages, findCvPdf } from "../../src/services/cv-pdf.js";

test("dates without a German version are translated the obvious way", () => {
  assert.equal(germanWhen("Since 09/2024"), "Seit 09/2024");
  assert.equal(germanWhen("06/2024 to 07/2026"), "06/2024 bis 07/2026");
  assert.equal(germanWhen("Summers 2021, 2022 and 2023"), "Sommer 2021, 2022 und 2023");
  assert.equal(germanWhen("2026"), "2026");
});

test("pages are counted from the PDF itself", () => {
  const pdf = Buffer.from("%PDF-1.7\n1 0 obj << /Type /Pages /Count 2 >>\n2 0 obj << /Type /Page >>\n3 0 obj << /Type/Page >>");
  assert.equal(countPages(pdf), 2);
});

test("the newest copy of a CV PDF wins, wherever it is", async () => {
  const committed = mkdtempSync(path.join(tmpdir(), "cv-a-"));
  const madeOnServer = mkdtempSync(path.join(tmpdir(), "cv-b-"));
  writeFileSync(path.join(committed, "reece-barker-cv.pdf"), "old");
  writeFileSync(path.join(madeOnServer, "reece-barker-cv.pdf"), "new");
  utimesSync(path.join(committed, "reece-barker-cv.pdf"), new Date("2026-01-01"), new Date("2026-01-01"));
  const found = await findCvPdf([committed, madeOnServer], "en");
  assert.equal(found.file, path.join(madeOnServer, "reece-barker-cv.pdf"));
  assert.equal(await findCvPdf([committed], "de"), null);
});
