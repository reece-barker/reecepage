// The production build writes a .br and a .gz copy next to every text asset. This serves those copies when the
// browser accepts them, so the server never compresses the same file twice. Anything else falls through to the
// normal static files (and the compression middleware for pages).
import { existsSync } from "node:fs";
import path from "node:path";

const TEXT_TYPES = { ".css": "text/css; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".svg": "image/svg+xml", ".json": "application/json", ".txt": "text/plain; charset=utf-8" };
const HASHED_FILE = /\.[0-9a-f]{10}\.\w+$/;

/** @param {{ publicDir: string }} options */
export function precompressedAssets({ publicDir }) {
  const known = new Map(); // "file.br" -> exists, files only change on deploy so this never needs clearing

  function has(file) {
    if (!known.has(file)) known.set(file, existsSync(file));
    return known.get(file);
  }

  return (req, res, next) => {
    if ((req.method !== "GET" && req.method !== "HEAD") || !req.path.startsWith("/assets/")) return next();
    const type = TEXT_TYPES[path.extname(req.path)];
    if (!type) return next();

    // path.join plus the startsWith check keeps ../ tricks inside public/
    const file = path.join(publicDir, decodeURIComponent(req.path));
    if (!file.startsWith(publicDir + path.sep)) return next();

    const accepts = req.get("accept-encoding") || "";
    const encoding = /\bbr\b/.test(accepts) && has(`${file}.br`) ? "br" : /\bgzip\b/.test(accepts) && has(`${file}.gz`) ? "gzip" : null;
    if (!encoding) return next();

    res.set({
      "Content-Type": type,
      "Content-Encoding": encoding,
      Vary: "Accept-Encoding",
      "Cache-Control": HASHED_FILE.test(req.path) || req.path.includes("/vendor/") ? "public, max-age=31536000, immutable" : "public, max-age=86400"
    });
    res.sendFile(`${file}.${encoding === "br" ? "br" : "gz"}`, { dotfiles: "deny", headers: {}, lastModified: true }, (error) => {
      if (error && !res.headersSent) next();
    });
  };
}
