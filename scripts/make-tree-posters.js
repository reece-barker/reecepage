// Makes the still pictures of the home page tree (one light, one dark). They show while three.js loads, when WebGL
// isnt there, when someone has save data on, and in the print and no script versions.
//
//   npm run images:tree
//
// It opens the real home page in Chromium with reduced motion on, so the tree draws its finished state in one go,
// then takes a picture of just the canvas with a see through background and saves it as WebP.
// Needs a dev build of the assets first (npm run build:dev). Run it again whenever tree.js or the colours change.
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";
import { ROOT_DIR } from "../src/config/index.js";
import { startLocalServer, chromiumOptions } from "./lib/local-server.js";

const SIZE = 900;
const OUT_DIR = path.join(ROOT_DIR, "assets/images/tree");

async function main() {
  await mkdir(OUT_DIR, { recursive: true });
  const server = await startLocalServer();
  const browser = await chromium.launch(chromiumOptions());
  try {
    for (const theme of ["light", "dark"]) {
      const page = await browser.newPage({ viewport: { width: 1400, height: 1000 }, reducedMotion: "reduce", colorScheme: theme });
      const errors = [];
      page.on("pageerror", (error) => errors.push(error.message));
      await page.goto(`${server.url}/`, { waitUntil: "load" });
      // Fix the stage at the poster size so the camera frames it the same way every time
      await page.evaluate(({ size, theme }) => {
        document.documentElement.dataset.theme = theme;
        const stage = document.querySelector("[data-tree-stage]");
        stage.style.position = "fixed";
        stage.style.inset = "0 auto auto 0";
        stage.style.width = `${size}px`;
        stage.style.height = `${size}px`;
        stage.style.zIndex = "999";
        // Only the tree in the picture, nothing from the page behind it
        document.body.style.visibility = "hidden";
        stage.style.visibility = "visible";
        document.documentElement.style.background = "transparent";
        document.body.style.background = "transparent";
        document.dispatchEvent(new CustomEvent("themechange", { detail: { theme } }));
        stage.querySelectorAll("img").forEach((img) => img.remove());
      }, { size: SIZE, theme });
      await page.waitForFunction(() => document.documentElement.dataset.treeReady === "true", null, { timeout: 30000 });
      // A couple of frames so the resize and the colours have landed
      await page.waitForTimeout(800);
      const png = await page.locator("[data-tree-canvas]").screenshot({ omitBackground: true });

      // Chromium does the WebP encoding, so no image library is needed
      const webp = await page.evaluate(async ({ data, size }) => {
        const img = new Image();
        img.src = `data:image/png;base64,${data}`;
        await img.decode();
        const canvas = document.createElement("canvas");
        canvas.width = size;
        canvas.height = size;
        canvas.getContext("2d").drawImage(img, 0, 0, size, size);
        return canvas.toDataURL("image/webp", 0.86).split(",")[1];
      }, { data: png.toString("base64"), size: SIZE });

      const file = path.join(OUT_DIR, `tree-poster-${theme}.webp`);
      await writeFile(file, Buffer.from(webp, "base64"));
      if (errors.length) console.warn(`  page errors (${theme}): ${errors.join("; ")}`);
      console.log(`wrote ${path.relative(ROOT_DIR, file)} (${Math.round(Buffer.from(webp, "base64").length / 1024)} KB)`);
      await page.close();
    }
  } finally {
    await browser.close();
    await server.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
