// Browser JavaScript. Minified with terser in production, copied as is in development so it is easy to debug
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { minify } from "terser";
import { PATHS, PRODUCTION, listFiles } from "./settings.js";

export async function scripts() {
  const outDir = path.join(PATHS.out, "js");
  await mkdir(outDir, { recursive: true });
  for (const file of (await listFiles(PATHS.scripts)).filter((name) => name.endsWith(".js"))) {
    const source = await readFile(path.join(PATHS.scripts, file), "utf8");
    let code = source;
    if (PRODUCTION) {
      // Any syntax error throws here and fails the build, nothing broken gets shipped quietly
      const result = await minify(source, { module: file === "tree.js", ecma: 2020, compress: { passes: 2 }, format: { comments: false } });
      code = result.code;
    }
    await mkdir(path.dirname(path.join(outDir, file)), { recursive: true });
    await writeFile(path.join(outDir, file), code);
  }
}
