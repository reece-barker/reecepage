// Takes full page screenshots of the main pages at a few sizes in both themes, for checking the design by eye.
//
//   node scripts/screenshots.js [outdir] [path ...]
//
// Pictures go to var/screenshots by default (ignored by git).
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";
import { ROOT_DIR } from "../src/config/index.js";
import { startLocalServer, chromiumOptions } from "./lib/local-server.js";

const outDir = path.resolve(process.argv[2] || path.join(ROOT_DIR, "var/screenshots"));
const paths = process.argv.slice(3).length ? process.argv.slice(3) : ["/", "/about", "/projects", "/projects/microclimate-startup", "/contact", "/privacy", "/nope"];
const viewports = (process.env.VIEWPORTS || "desktop:1440x900,mobile:390x844").split(",").map((v) => {
  const [name, size] = v.split(":");
  const [width, height] = size.split("x").map(Number);
  return { name, width, height };
});
const themes = (process.env.THEMES || "light,dark").split(",");

const server = await startLocalServer();
const browser = await chromium.launch(chromiumOptions());
await mkdir(outDir, { recursive: true });
try {
  for (const vp of viewports) {
    for (const theme of themes) {
      const context = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, colorScheme: theme, reducedMotion: process.env.MOTION === "full" ? "no-preference" : "reduce" });
      const page = await context.newPage();
      page.on("console", (msg) => { if (msg.type() === "error") console.warn(`  console error on ${page.url()}: ${msg.text()}`); });
      page.on("pageerror", (error) => console.warn(`  page error on ${page.url()}: ${error.message}`));
      for (const p of paths) {
        await page.goto(server.url + p, { waitUntil: "load" });
        // Scroll through so lazy images and reveals all run, then back to the top
        await page.evaluate(async () => {
          for (let y = 0; y < document.body.scrollHeight; y += 600) { window.scrollTo(0, y); await new Promise((r) => setTimeout(r, 60)); }
          window.scrollTo(0, 0);
        });
        await page.waitForTimeout(Number(process.env.WAIT || 600));
        const name = `${vp.name}-${theme}-${p === "/" ? "home" : p.slice(1).replace(/\//g, "_")}.png`;
        await page.screenshot({ path: path.join(outDir, name), fullPage: process.env.FULL !== "0" });
        console.log(name);
      }
      await context.close();
    }
  }
} finally {
  await browser.close();
  await server.close();
}
