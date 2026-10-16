// Shared paths and the one switch that matters: production or not
import path from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
export const PRODUCTION = process.env.NODE_ENV === "production" || process.argv.includes("--production");

export const PATHS = {
  styles: path.join(ROOT, "styles"),
  scripts: path.join(ROOT, "assets/js"),
  images: path.join(ROOT, "assets/images"),
  fonts: path.join(ROOT, "assets/fonts"),
  vendor: path.join(ROOT, "assets/vendor"),
  out: path.join(ROOT, "public/assets")
};

/** Every file under a folder, as paths relative to it */
export async function listFiles(dir) {
  const { readdir } = await import("node:fs/promises");
  const entries = await readdir(dir, { recursive: true, withFileTypes: true });
  return entries.filter((entry) => entry.isFile() && !entry.name.startsWith("."))
    .map((entry) => path.relative(dir, path.join(entry.parentPath ?? entry.path, entry.name)));
}
