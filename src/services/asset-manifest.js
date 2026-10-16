// Maps a source asset name ("css/main.css") to the file the build produced ("css/main.4f3a9c1e.css").
// The manifest is written by `npm run build`. Without it (tests, a fresh clone) the plain names are used.
import { existsSync, readFileSync } from "node:fs";

export class AssetManifest {
  /** @param {{ file: string, prefix?: string, reload?: boolean }} options */
  constructor({ file, prefix = "/assets/", reload = false }) {
    this.file = file;
    this.prefix = prefix;
    this.reload = reload;
    this.entries = null;
  }

  read() {
    if (this.entries && !this.reload) return this.entries;
    this.entries = existsSync(this.file) ? JSON.parse(readFileSync(this.file, "utf8")) : {};
    return this.entries;
  }

  /** @param {string} name path relative to the assets folder, without a leading slash */
  url(name) {
    const clean = String(name).replace(/^\/+/, "");
    return `${this.prefix}${this.read()[clean] || clean}`;
  }

  has(name) {
    return Object.prototype.hasOwnProperty.call(this.read(), String(name).replace(/^\/+/, ""));
  }
}
