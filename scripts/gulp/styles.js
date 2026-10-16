// Sass to CSS. Source maps only in development, they would expose the Sass sources in production
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import * as sass from "sass";
import { PATHS, PRODUCTION } from "./settings.js";

export async function styles() {
  const result = sass.compile(path.join(PATHS.styles, "main.scss"), {
    style: PRODUCTION ? "compressed" : "expanded",
    sourceMap: !PRODUCTION,
    sourceMapIncludeSources: !PRODUCTION
  });
  const outDir = path.join(PATHS.out, "css");
  await mkdir(outDir, { recursive: true });
  let css = result.css;
  if (!PRODUCTION && result.sourceMap) {
    await writeFile(path.join(outDir, "main.css.map"), JSON.stringify(result.sourceMap));
    css += "\n/*# sourceMappingURL=main.css.map */\n";
  }
  await writeFile(path.join(outDir, "main.css"), css);
}
