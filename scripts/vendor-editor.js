// npm run vendor:editor: copies the block editor (Editor.js and its tools), marked and the passkey browser library
// from node_modules into assets/vendor, so the admin loads them from this site like three.js. Run it after
// updating any of those packages, and commit what it writes. The tools are joined into one file so the editor
// page loads three scripts instead of nine.
//
// Editor.js and its tools add <style> elements as they load. The content security policy only lets those in with
// the page's nonce, the admin layout gives them that (see the comment in views/layouts/admin.hbs)
import { readFileSync } from "node:fs";
import { copyFile, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { ROOT_DIR } from "../src/config/index.js";

const nm = (...parts) => path.join(ROOT_DIR, "node_modules", ...parts);
// Read straight from the folder, some packages dont let their package.json be imported
const version = (name) => JSON.parse(readFileSync(nm(name, "package.json"), "utf8")).version;

const EDITOR_DIR = path.join(ROOT_DIR, "assets/vendor", `editorjs-${version("@editorjs/editorjs")}`);
const PASSKEY_DIR = path.join(ROOT_DIR, "assets/vendor", `simplewebauthn-browser-${version("@simplewebauthn/browser")}`);
const MARKED_DIR = path.join(ROOT_DIR, "assets/vendor", `marked-${version("marked").split(".")[0]}`);

const TOOLS = [
  ["@editorjs/header", "header.umd.js"],
  ["@editorjs/list", "editorjs-list.umd.js"],
  ["@editorjs/quote", "quote.umd.js"],
  ["@editorjs/code", "code.umd.js"],
  ["@editorjs/delimiter", "delimiter.umd.js"],
  ["@editorjs/table", "table.umd.js"],
  ["@editorjs/inline-code", "inline-code.umd.js"]
];

async function fresh(dir) {
  await rm(dir, { recursive: true, force: true });
  await mkdir(dir, { recursive: true });
}

await fresh(EDITOR_DIR);
await copyFile(nm("@editorjs/editorjs/dist/editorjs.umd.js"), path.join(EDITOR_DIR, "editorjs.umd.js"));
await copyFile(nm("@editorjs/editorjs/LICENSE"), path.join(EDITOR_DIR, "LICENSE.txt"));
const tools = [];
for (const [name, file] of TOOLS) tools.push(`/* ${name} ${version(name)}, MIT licence */`, await readFile(nm(name, "dist", file), "utf8"));
await writeFile(path.join(EDITOR_DIR, "tools.umd.js"), `${tools.join("\n")}\n`);

await fresh(PASSKEY_DIR);
await copyFile(nm("@simplewebauthn/browser/dist/bundle/index.umd.min.js"), path.join(PASSKEY_DIR, "index.umd.min.js"));
await copyFile(nm("@simplewebauthn/browser/LICENSE.md"), path.join(PASSKEY_DIR, "LICENSE.md"));

await fresh(MARKED_DIR);
await copyFile(nm("marked/lib/marked.umd.js"), path.join(MARKED_DIR, "marked.umd.js"));
await copyFile(nm("marked/LICENSE"), path.join(MARKED_DIR, "LICENSE.txt"));

console.log(`Vendored into ${[EDITOR_DIR, PASSKEY_DIR, MARKED_DIR].map((dir) => path.relative(ROOT_DIR, dir)).join(", ")}`);
