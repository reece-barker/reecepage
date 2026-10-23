// Sass to CSS. Two stylesheets: main.css for the site and admin.css for the signed in admin, so visitors never
// download the editor's styles. Source maps only in development, they would expose the Sass sources in production
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import * as sass from "sass";
import { PATHS, PRODUCTION } from "./settings.js";

const ENTRIES = ["main", "admin"];

export async function styles() {
  const outDir = path.join(PATHS.out, "css");
  await mkdir(outDir, { recursive: true });
  for (const name of ENTRIES) {
    const result = sass.compile(path.join(PATHS.styles, `${name}.scss`), {
      style: PRODUCTION ? "compressed" : "expanded",
      sourceMap: !PRODUCTION,
      sourceMapIncludeSources: !PRODUCTION
    });
    let css = result.css;
    if (!PRODUCTION && result.sourceMap) {
      await writeFile(path.join(outDir, `${name}.css.map`), JSON.stringify(result.sourceMap));
      css += `\n/*# sourceMappingURL=${name}.css.map */\n`;
    }
    await writeFile(path.join(outDir, `${name}.css`), css);
  }
}
