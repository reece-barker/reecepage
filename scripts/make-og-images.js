// Makes the share pictures (Open Graph, 1200 x 630) that show up when a link to the site is posted somewhere.
//
//   npm run images:og
//
// One default picture for the site, plus one per project page and per article, built from the same content and
// brand files as the site so they never go out of date. Chromium draws a small HTML card and takes a picture of it.
// Run it again after adding or renaming a project or article.
import { mkdir, readFile, writeFile, rm } from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";
import { ROOT_DIR } from "../src/config/index.js";
import { ContentService } from "../src/services/content-service.js";
import { chromiumOptions } from "./lib/local-server.js";

const OUT = path.join(ROOT_DIR, "assets/images/og");
const BRANCH_COLOURS = { code: "#4a7f93", earth: "#5e8a4e", faith: "#b8735c" };
const BRANCH_NAMES = { code: "Code", earth: "Earth", faith: "Faith" };

const escape = (value) => String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

async function dataUri(relative, type) {
  const file = await readFile(path.join(ROOT_DIR, relative));
  return `data:${type};base64,${file.toString("base64")}`;
}

async function loadAssets() {
  return {
    serif: await dataUri("assets/fonts/YoungSerif-Regular-latin.woff2", "font/woff2"),
    sans: await dataUri("assets/fonts/NunitoSans-Variable-latin.woff2", "font/woff2"),
    dove: await dataUri("assets/images/brand/reece-dove-symbol-colour.svg", "image/svg+xml"),
    tree: await dataUri("assets/images/tree/tree-poster-light.webp", "image/webp")
  };
}

function page(assets, body) {
  return `<!doctype html><html><head><meta charset="utf-8"><style>
    @font-face { font-family: "Young Serif"; src: url(${assets.serif}) format("woff2"); }
    @font-face { font-family: "Nunito Sans"; src: url(${assets.sans}) format("woff2"); font-weight: 200 1000; }
    * { margin: 0; box-sizing: border-box; }
    html, body { width: 1200px; height: 630px; }
    body { background: #f9f4e8; color: #33412a; font-family: "Nunito Sans", sans-serif; position: relative; overflow: hidden; }
    .card { position: absolute; inset: 64px 72px; display: flex; flex-direction: column; }
    .top { display: flex; align-items: center; gap: 16px; font-weight: 700; font-size: 26px; }
    .top img { width: 72px; height: auto; }
    h1 { font-family: "Young Serif", serif; font-weight: 400; letter-spacing: -0.01em; line-height: 1.04; margin-top: auto; }
    p { font-size: 30px; line-height: 1.35; color: #5a6652; margin-top: 22px; max-width: 30ch; }
    .meta { display: flex; gap: 14px; align-items: center; font-size: 24px; font-weight: 700; margin-top: 30px; color: #5a6652; }
    .meta i { width: 18px; height: 18px; display: inline-block; }
    .tree { position: absolute; right: -40px; bottom: -20px; width: 640px; height: 640px; }
    .rule { position: absolute; left: 0; right: 0; bottom: 0; height: 14px; background: #33412a; }
  </style></head><body>${body}<div class="rule"></div></body></html>`;
}

function defaultCard(assets) {
  return page(assets, `
    <img class="tree" src="${assets.tree}" alt="">
    <div class="card">
      <div class="top"><img src="${assets.dove}" alt="">reece.page</div>
      <h1 style="font-size:104px">Reece<br>Barker</h1>
      <p>Code for a living world.</p>
    </div>`);
}

function itemCard(assets, { title, summary, branch, label }) {
  // Long titles get a smaller size so they still fit in three lines
  const size = title.length > 42 ? 64 : title.length > 26 ? 76 : 92;
  const colour = BRANCH_COLOURS[branch];
  return page(assets, `
    <div class="card" style="right:300px">
      <div class="top"><img src="${assets.dove}" alt="">reece.page</div>
      <h1 style="font-size:${size}px">${escape(title)}</h1>
      <p style="max-width:34ch;font-size:27px">${escape(summary)}</p>
      <div class="meta">${colour ? `<i style="background:${colour}"></i>${BRANCH_NAMES[branch]}<span style="width:12px"></span>` : ""}${escape(label)}</div>
    </div>
    <img class="tree" style="width:520px;height:520px;right:-120px;bottom:-40px;opacity:.9" src="${assets.tree}" alt="">`);
}

async function main() {
  const content = new ContentService({ contentDir: path.join(ROOT_DIR, "content") });
  content.load();
  const assets = await loadAssets();
  const browser = await chromium.launch(chromiumOptions());
  const tab = await browser.newPage({ viewport: { width: 1200, height: 630 } });

  async function shoot(html, relative) {
    const file = path.join(OUT, relative);
    await mkdir(path.dirname(file), { recursive: true });
    await tab.setContent(html, { waitUntil: "load" });
    await tab.evaluate(() => document.fonts.ready);
    await writeFile(file, await tab.screenshot({ type: "png" }));
    console.log(`wrote assets/images/og/${relative}`);
  }

  try {
    // Start clean so a renamed project doesnt leave an old picture behind
    await rm(path.join(OUT, "projects"), { recursive: true, force: true });
    await rm(path.join(OUT, "writing"), { recursive: true, force: true });
    await shoot(defaultCard(assets), "default.png");
    for (const project of content.listProjects().filter((p) => p.hasPage)) {
      await shoot(itemCard(assets, { title: project.title, summary: project.summary, branch: project.branch, label: project.kind }), `projects/${project.slug}.png`);
    }
    for (const article of content.listArticles()) {
      await shoot(itemCard(assets, { title: article.title, summary: article.summary, label: `${article.readingMinutes} minute read` }), `writing/${article.slug}.png`);
    }
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
