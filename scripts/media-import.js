// npm run media:import
//
// Imports everything sitting in media-inbox/ into the media library, it just uses media:add under the hood so theres
// only one way things get added. Sidecar files with the same name give it a title, captions, poster etc, theres more
// in media-inbox/README.md. Done files get moved to media-inbox/done/ but a yml with source: pointing somewhere else
// just gets renamed to .yml.done since theres nothing to move
import { execFile } from "node:child_process";
import { existsSync, readdirSync, readFileSync, renameSync, mkdirSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import * as yaml from "js-yaml";
import { ROOT_DIR } from "../src/config/index.js";

const run = promisify(execFile);
const INBOX = path.join(ROOT_DIR, "media-inbox");
const DONE = path.join(INBOX, "done");
const MEDIA = /\.(jpe?g|png|webp|gif|avif|mp4|m4v|mov|webm)$/i;
const POSTERS = [".jpg", ".jpeg", ".png", ".webp"];
const node = (script, args) => run(process.execPath, ["--disable-warning=ExperimentalWarning", path.join(ROOT_DIR, "scripts", script), ...args], { cwd: ROOT_DIR, maxBuffer: 1 << 24 });
const expand = (p) => (p.startsWith("~/") ? path.join(homedir(), p.slice(2)) : path.resolve(INBOX, p));
const titleFrom = (name) => path.parse(name).name.replace(/[-_]+/g, " ").replace(/^\w/, (c) => c.toUpperCase());

async function hasFfmpeg() {
  try { await run("ffmpeg", ["-version"]); return true; } catch { return false; }
}

if (!existsSync(INBOX)) mkdirSync(INBOX);
const files = readdirSync(INBOX);
const jobs = [];
// Files dropped in the inbox, doesnt matter if they have a yml next to them or not
for (const name of files.filter((f) => MEDIA.test(f))) {
  const base = path.parse(name).name;
  // A picture with the same name as a video is that videos poster not its own item
  if (POSTERS.includes(path.extname(name).toLowerCase()) && files.some((f) => f !== name && path.parse(f).name === base && /\.(mp4|m4v|mov|webm)$/i.test(f))) continue;
  const sidecar = files.find((f) => f === `${base}.yml` || f === `${base}.yaml`);
  jobs.push({ file: path.join(INBOX, name), meta: sidecar ? yaml.load(readFileSync(path.join(INBOX, sidecar), "utf8")) || {} : {}, sidecar, base, move: true });
}
// Yml files on there own that point at a file somewhere else on the computer
for (const name of files.filter((f) => /\.ya?ml$/.test(f))) {
  const meta = yaml.load(readFileSync(path.join(INBOX, name), "utf8")) || {};
  if (meta.source) jobs.push({ file: expand(String(meta.source)), meta, sidecar: name, base: path.parse(name).name, move: false });
}

if (!jobs.length) {
  console.log("Nothing in media-inbox/ to import. Drop pictures or videos in there, see media-inbox/README.md");
  process.exit(0);
}

await node("db.js", ["migrate"]);
const ffmpeg = await hasFfmpeg();
let failed = 0;

for (const job of jobs) {
  const { meta } = job;
  if (!existsSync(job.file)) {
    console.error(`Skipped ${job.sidecar}: cant find ${job.file}, fix the source line`);
    failed++;
    continue;
  }
  const args = [job.file, "--title", meta.title || titleFrom(job.file)];
  for (const key of ["alt", "caption", "credit"]) if (meta[key]) args.push(`--${key}`, String(meta[key]).trim());
  const captions = meta.captions ? expand(String(meta.captions)) : [".srt", ".vtt"].map((ext) => path.join(INBOX, job.base + ext)).find(existsSync);
  if (captions && existsSync(captions)) args.push("--captions", captions);
  const poster = meta.poster ? expand(String(meta.poster)) : POSTERS.map((ext) => path.join(INBOX, job.base + ext)).find(existsSync);
  if (poster && existsSync(poster) && poster !== job.file) args.push("--poster", poster);
  if ((meta.web || meta.faststart) && !ffmpeg) console.warn(`ffmpeg isnt installed so ${path.basename(job.file)} goes in as it is (brew install ffmpeg to fix that)`);
  else if (meta.web) args.push("--web");
  else if (meta.faststart) args.push("--faststart");
  if (meta.feature) args.push("--feature");
  else if (meta.publish) args.push("--publish");
  if (!/\.(mp4|m4v|mov|webm)$/i.test(job.file) && !meta.alt) {
    // Pictures need alt text, without it it still gets imported but stays unpublished untill i write one in the admin
    const i = args.indexOf("--publish");
    if (i > -1) args.splice(i, 1);
  }

  try {
    console.log(`Importing ${path.basename(job.file)}...`);
    const { stdout } = await node("media-add.js", args);
    process.stdout.write(stdout);
    mkdirSync(DONE, { recursive: true });
    const used = [job.sidecar, captions, poster].filter(Boolean).map((p) => path.basename(p));
    if (job.move) {
      renameSync(job.file, path.join(DONE, path.basename(job.file)));
      for (const f of used) if (existsSync(path.join(INBOX, f))) renameSync(path.join(INBOX, f), path.join(DONE, f));
    } else {
      renameSync(path.join(INBOX, job.sidecar), path.join(INBOX, `${job.sidecar}.done`));
    }
  } catch (error) {
    failed++;
    console.error(`Could not import ${path.basename(job.file)}: ${String(error.stderr || error.message).trim()}`);
  }
}
process.exitCode = failed ? 1 : 0;
