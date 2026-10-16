// Writes .br and .gz copies of text files next to them, so the server can send the smallest one without
// compressing on every request. Brotli at maximum quality is slow, which is fine at build time.
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { brotliCompressSync, gzipSync, constants } from "node:zlib";
import { PATHS, listFiles } from "./settings.js";

const COMPRESSIBLE = /\.(css|js|svg|json|txt)$/;

export async function compress() {
  for (const file of (await listFiles(PATHS.out)).filter((name) => COMPRESSIBLE.test(name))) {
    const full = path.join(PATHS.out, file);
    const data = await readFile(full);
    if (data.length < 1024) continue;
    await writeFile(`${full}.br`, brotliCompressSync(data, { params: { [constants.BROTLI_PARAM_QUALITY]: 11, [constants.BROTLI_PARAM_SIZE_HINT]: data.length } }));
    await writeFile(`${full}.gz`, gzipSync(data, { level: 9 }));
  }
}
