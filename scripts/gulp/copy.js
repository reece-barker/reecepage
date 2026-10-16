// Images, fonts and vendor files. SVGs go through svgo, but the rights metadata in the brand files is kept on purpose
import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { optimize } from "svgo";
import { PATHS, PRODUCTION, listFiles } from "./settings.js";

const SVGO_CONFIG = {
  multipass: true,
  plugins: [
    { name: "preset-default", params: { overrides: { removeMetadata: false, removeTitle: false, removeDesc: false, removeViewBox: false } } }
  ]
};

async function copyTree(from, to, transform) {
  for (const file of await listFiles(from)) {
    const target = path.join(to, file);
    await mkdir(path.dirname(target), { recursive: true });
    if (transform && (await transform(path.join(from, file), target))) continue;
    await copyFile(path.join(from, file), target);
  }
}

export async function images() {
  await copyTree(PATHS.images, path.join(PATHS.out, "images"), async (source, target) => {
    if (!PRODUCTION || !source.endsWith(".svg")) return false;
    const { data } = optimize(await readFile(source, "utf8"), { path: source, ...SVGO_CONFIG });
    await writeFile(target, data);
    return true;
  });
}

export async function fonts() {
  await copyTree(PATHS.fonts, path.join(PATHS.out, "fonts"));
}

// Vendor files keep their names, the version is in the folder name (three-r160) so they can be cached for a year
export async function vendor() {
  await copyTree(PATHS.vendor, path.join(PATHS.out, "vendor"));
}
