// npm run media:add -- <file> --title "..." [options]
//
// Adds a picture or video to the media library from the command line, the same way the upload page does. Handy for
// big videos, copy the file to the server with scp and add it there.
//
//   --alt "..."          description for pictures (required for pictures)
//   --caption "..."      shown under it
//   --credit "..."       credit or licence line
//   --captions file.srt  captions for a video (.srt or .vtt), also becomes the transcript
//   --poster file.jpg    the still shown before a video plays (otherwise ffmpeg takes one, if installed)
//   --web                re-encode a video for the web first (H.264, max 1080p, AAC, fast start). Needs ffmpeg
//   --faststart          keep the video as it is, only move its index to the front so it starts playing sooner
//                        (a quick copy, no quality loss). Needs ffmpeg
//   --publish            publish straight away
//   --feature            make it the video on the home page (implies --publish)
import { execFile } from "node:child_process";
import { createReadStream, existsSync } from "node:fs";
import { readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { loadConfig } from "../src/config/index.js";
import { createLogger } from "../src/lib/logger.js";
import { createDatabase } from "../src/database/index.js";
import { MediaService } from "../src/services/media-service.js";

const run = promisify(execFile);
// Options that take a value, everything else starting with -- is a plain switch
const VALUED = new Set(["title", "alt", "caption", "credit", "captions", "poster"]);
const options = {};
const flags = new Set();
let file = null;
const args = process.argv.slice(2);
for (let i = 0; i < args.length; i++) {
  const name = args[i].startsWith("--") ? args[i].slice(2) : null;
  if (name && VALUED.has(name)) options[name] = args[++i];
  else if (name) flags.add(name);
  else file ??= args[i];
}
const option = (name) => options[name];
const flag = (name) => flags.has(name);

if (!file || !existsSync(file) || !option("title")) {
  console.error("Use: npm run media:add -- <file> --title \"Title\" [--alt ...] [--captions file.srt] [--web] [--publish] [--feature]");
  process.exit(1);
}

const config = loadConfig();
const logger = createLogger({ ...config, logLevel: "warn" });
const database = createDatabase(config, logger);
if (!database) {
  console.error("No database is configured, the media library needs one.");
  process.exit(1);
}
const media = new MediaService({ dir: config.media.dir, models: database.models, logger, maxImageBytes: config.media.maxImageBytes, maxVideoBytes: config.media.maxVideoBytes });

let source = file;
let encoded = null;
try {
  if (flag("web")) {
    encoded = path.join(tmpdir(), `media-web-${Date.now()}.mp4`);
    console.log("Re-encoding for the web, this takes a few minutes for a long video...");
    await run("ffmpeg", ["-v", "error", "-y", "-i", file,
      "-vf", "scale='min(1920,iw)':-2", "-c:v", "libx264", "-preset", "slow", "-crf", "23", "-profile:v", "high", "-pix_fmt", "yuv420p",
      "-c:a", "aac", "-b:a", "128k", "-movflags", "+faststart", encoded], { maxBuffer: 1 << 24 });
    source = encoded;
  } else if (flag("faststart")) {
    encoded = path.join(tmpdir(), `media-fast-${Date.now()}.mp4`);
    await run("ffmpeg", ["-v", "error", "-y", "-i", file, "-c", "copy", "-movflags", "+faststart", encoded], { maxBuffer: 1 << 24 });
    source = encoded;
  }
  const { size } = await stat(source);
  const received = await media.receive(createReadStream(source), { declaredBytes: size });
  let item = await media.createFromTemp(received, { title: option("title"), alt: option("alt"), caption: option("caption"), credit: option("credit") });
  if (option("poster")) {
    const { size: posterSize } = await stat(option("poster"));
    item = await media.attachPoster(await media.receive(createReadStream(option("poster")), { declaredBytes: posterSize }), item.id);
  }
  if (option("captions")) item = await media.attachCaptions(item.id, await readFile(option("captions")));
  if (flag("publish") || flag("feature")) {
    item = await media.update(item.id, { title: item.title, alt: item.alt, caption: item.caption, credit: item.credit, published: true, featured: flag("feature") });
  }
  console.log(`Added ${item.kind} "${item.title}" (${Math.round(item.bytes / 1048576)} MB)${item.published ? ", published" : ", not published yet"}${item.featured ? ", featured on the home page" : ""}.`);
  console.log(`Page: /media/${item.slug}   Article code: ${item.shortcode}`);
} catch (error) {
  console.error(`Could not add it: ${error.message}`);
  process.exitCode = 1;
} finally {
  if (encoded) await rm(encoded, { force: true });
  await database.close();
}
