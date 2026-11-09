// Turns a PDF from Chromium into one a print shop takes as it is: colours converted to CMYK with the FOGRA52
// profile (PSO Uncoated v3, what Onlineprinters wants for uncoated paper), fonts embedded, and a trim and bleed box
// on every page so the shop's software knows where to cut. Chromium can only make RGB, Ghostscript does the rest.
//
// Ghostscript and the profile are on the server (the deploy installs both, the profile cant live in the repo because
// ECI doesnt allow passing it on). Without them the PDF stays RGB and the editor says so, nothing breaks.
import { execFile } from "node:child_process";
import { access, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";

const run = promisify(execFile);
const MM = 72 / 25.4;

let cached = null;

/** Whether CMYK PDFs can be made here, checked once and then remembered until restart */
export async function cmykStatus(profile) {
  if (cached && cached.profile === profile) return cached;
  let ready = true, reason = "";
  try {
    await run("gs", ["--version"], { timeout: 5000 });
  } catch {
    ready = false;
    reason = "Ghostscript isnt installed on this server";
  }
  if (ready) {
    try {
      await access(profile);
    } catch {
      ready = false;
      reason = "the FOGRA52 colour profile isnt on this server";
    }
  }
  cached = { profile, ready, reason };
  return cached;
}

/**
 * @param {Buffer|Uint8Array} pdf what Chromium printed, one page per side
 * @param {object} options
 * @param {number} options.w the cut width in mm
 * @param {number} options.h the cut height in mm
 * @param {number} options.bleed the bleed on every side in mm
 * @param {string} options.profile the output ICC profile
 * @returns {Promise<{ pdf: Buffer, cmyk: boolean, reason?: string }>}
 */
export async function printReadyPdf(pdf, { w, h, bleed, profile }) {
  const status = await cmykStatus(profile);
  if (!status.ready) return { pdf: Buffer.from(pdf), cmyk: false, reason: status.reason };
  const dir = await mkdtemp(path.join(tmpdir(), "reece-print-"));
  try {
    const input = path.join(dir, "in.pdf"), output = path.join(dir, "out.pdf");
    await writeFile(input, pdf);
    // The boxes in points from the bottom left: the whole page is the media and bleed box, the trim box sits the
    // bleed in from every edge
    const b = bleed * MM, tw = w * MM, th = h * MM;
    const pw = (tw + 2 * b).toFixed(2), ph = (th + 2 * b).toFixed(2);
    const trim = [b, b, b + tw, b + th].map((n) => n.toFixed(2)).join(" ");
    const full = `0 0 ${pw} ${ph}`;
    await run("gs", [
      "-dSAFER", "-dBATCH", "-dNOPAUSE", "-dQUIET",
      "-sDEVICE=pdfwrite", "-dCompatibilityLevel=1.6",
      "-sColorConversionStrategy=CMYK", "-dProcessColorModel=/DeviceCMYK",
      `-sOutputICCProfile=${profile}`,
      "-dEmbedAllFonts=true", "-dSubsetFonts=true", "-dAutoRotatePages=/None",
      "-dDownsampleColorImages=false", "-dDownsampleGrayImages=false",
      // Chromium rounds the page to whole pixels (88.9 x 58.9 mm for 89 x 59), this puts it back to the exact size,
      // the content scales by about a thousandth
      "-dFIXEDMEDIA", `-dDEVICEWIDTHPOINTS=${pw}`, `-dDEVICEHEIGHTPOINTS=${ph}`, "-dPDFFitPage",
      "-o", output,
      // The boxes go on at the end of every page, a /PAGES pdfmark before the file is ignored by Ghostscript 10
      "-c", `<< /EndPage { exch pop 0 eq { [ /TrimBox [${trim}] /BleedBox [${full}] /PAGE pdfmark true } { false } ifelse } >> setpagedevice`,
      "-f", input
    ], { timeout: 60000 });
    return { pdf: await readFile(output), cmyk: true };
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
