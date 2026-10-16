// Content hashing for production. main.css becomes main.4f3a9c1e2b.css and so on, the mapping goes into
// manifest.json for the server's asset helper. Because the name changes whenever the content does, browsers can
// cache these files for a year. References inside the CSS (fonts, images) are rewritten to the hashed names too.
import { createHash } from "node:crypto";
import { readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { PATHS, listFiles } from "./settings.js";

const HASHED_FOLDERS = ["css/", "js/", "images/", "fonts/"];

function hashedName(file, content) {
  const hash = createHash("sha256").update(content).digest("hex").slice(0, 10);
  const ext = path.extname(file);
  return `${file.slice(0, -ext.length)}.${hash}${ext}`;
}

export async function revision() {
  const manifest = {};
  const files = (await listFiles(PATHS.out)).filter((file) => HASHED_FOLDERS.some((folder) => file.startsWith(folder)) && !file.endsWith(".map"));

  // Hash everything except CSS first, CSS goes last because its content changes when its urls are rewritten
  for (const file of files.filter((name) => !name.endsWith(".css"))) {
    const full = path.join(PATHS.out, file);
    const target = hashedName(file, await readFile(full));
    await rename(full, path.join(PATHS.out, target));
    manifest[file] = target;
  }

  for (const file of files.filter((name) => name.endsWith(".css"))) {
    const full = path.join(PATHS.out, file);
    let css = await readFile(full, "utf8");
    css = css.replace(/url\(["']?(\.\.\/[^"')?#]+)([?#][^"')]*)?["']?\)/g, (match, url, suffix = "") => {
      const key = path.posix.normalize(path.posix.join(path.posix.dirname(file), url));
      if (!manifest[key]) throw new Error(`${file} points at ${url}, which the build did not produce`);
      return `url("${path.posix.relative(path.posix.dirname(file), manifest[key])}${suffix}")`;
    });
    const target = hashedName(file, css);
    await writeFile(path.join(PATHS.out, target), css);
    const { rm } = await import("node:fs/promises");
    await rm(full);
    manifest[file] = target;
  }

  await writeFile(path.join(PATHS.out, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
}
