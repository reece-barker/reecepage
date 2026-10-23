// The media library: pictures and videos uploaded on /admin/library, shown on /media and placed in articles with
// [[media:slug]]. Files are stored on disk in MEDIA_DIR under a name nobody can guess, the database keeps the rest.
//
// Uploads are checked by their first bytes, not by their name or the type the browser claims, and only these get in:
// JPEG, PNG, WebP and AVIF pictures, MP4 and WebM videos, and WebVTT or SRT captions. Nothing is ever executed,
// SVG and HTML are refused because a browser would run scripts inside them.
import { execFile } from "node:child_process";
import { randomBytes } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, open, rename, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { Op } from "sequelize";
import { slugify } from "../utils/text.js";
import { MEDIA_LIMITS } from "../models/media-item.js";
import { galleryFigure } from "../helpers/media-html.js";
import { readMediaPlaceholder } from "./content-blocks.js";

const run = promisify(execFile);

export class MediaError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.name = "MediaError";
    this.status = status;
  }
}

/** Works out what a file really is from its first bytes. Returns null for anything that isnt allowed */
export function sniff(head) {
  const b = head;
  const ascii = (start, end) => b.subarray(start, end).toString("latin1");
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return { kind: "image", mime: "image/jpeg", ext: "jpg" };
  if (ascii(0, 8) === "\x89PNG\r\n\x1a\n") return { kind: "image", mime: "image/png", ext: "png" };
  if (ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP") return { kind: "image", mime: "image/webp", ext: "webp" };
  if (ascii(4, 8) === "ftyp") {
    const brand = ascii(8, 12);
    if (brand === "avif" || brand === "avis") return { kind: "image", mime: "image/avif", ext: "avif" };
    if (["isom", "iso2", "iso4", "iso5", "iso6", "mp41", "mp42", "avc1", "M4V ", "dash", "MSNV"].includes(brand)) {
      return { kind: "video", mime: "video/mp4", ext: "mp4" };
    }
    return null; // HEIC, QuickTime and friends: browsers cant all play them, better converted first
  }
  if (b[0] === 0x1a && b[1] === 0x45 && b[2] === 0xdf && b[3] === 0xa3) return { kind: "video", mime: "video/webm", ext: "webm" };
  return null;
}

/** Width and height straight from the image header, so pages can reserve the space before it loads */
export function imageSize(buf, mime) {
  try {
    if (mime === "image/png") return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
    if (mime === "image/webp") {
      const chunk = buf.subarray(12, 16).toString("latin1");
      if (chunk === "VP8 ") return { width: buf.readUInt16LE(26) & 0x3fff, height: buf.readUInt16LE(28) & 0x3fff };
      if (chunk === "VP8L") {
        const bits = buf.readUInt32LE(21);
        return { width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1 };
      }
      if (chunk === "VP8X") return { width: buf.readUIntLE(24, 3) + 1, height: buf.readUIntLE(27, 3) + 1 };
    }
    if (mime === "image/jpeg") {
      let offset = 2;
      while (offset < buf.length - 9) {
        if (buf[offset] !== 0xff) { offset += 1; continue; }
        const marker = buf[offset + 1];
        const length = buf.readUInt16BE(offset + 2);
        // SOF0 to SOF15 hold the size, except the DHT, JPG and DAC markers that share the range
        if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
          return { height: buf.readUInt16BE(offset + 5), width: buf.readUInt16BE(offset + 7) };
        }
        offset += 2 + length;
      }
    }
    if (mime === "image/avif") {
      const at = buf.indexOf("ispe", 0, "latin1");
      if (at > 0) return { width: buf.readUInt32BE(at + 8), height: buf.readUInt32BE(at + 12) };
    }
  } catch {
    // A broken header just means no size, the picture still works
  }
  return { width: null, height: null };
}

/** SRT or WebVTT in, WebVTT out (browsers only take WebVTT in a <track>), plus the plain text as a transcript */
export function toWebVtt(text) {
  const source = String(text).replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n").trim();
  const isVtt = source.startsWith("WEBVTT");
  if (!isVtt && !/\d\d:\d\d:\d\d[,.]\d{3}\s*-->/.test(source)) throw new MediaError("Captions need to be a WebVTT or SRT file");
  const body = isVtt ? source.replace(/^WEBVTT[^\n]*\n/, "") : source;
  const cues = body.split(/\n{2,}/).map((block) => block.split("\n").filter((line) => !/^\d+$/.test(line.trim())));
  const vttCues = [];
  const words = [];
  for (const lines of cues) {
    const timeLine = lines.find((line) => line.includes("-->"));
    if (!timeLine) continue;
    const textLines = lines.slice(lines.indexOf(timeLine) + 1).filter(Boolean);
    vttCues.push(`${timeLine.replace(/(\d\d:\d\d:\d\d),(\d{3})/g, "$1.$2")}\n${textLines.join("\n")}`);
    words.push(textLines.join(" ").replace(/<[^>]+>/g, ""));
  }
  if (!vttCues.length) throw new MediaError("The captions file has no cues in it");
  return { vtt: `WEBVTT\n\n${vttCues.join("\n\n")}\n`, transcript: words.join(" ").replace(/\s+/g, " ").trim() };
}

function clean(value, max) {
  return typeof value === "string" ? value.normalize("NFC").trim().slice(0, max) : "";
}

export class MediaService {
  /**
   * @param {{ dir: string, models: object | null, logger: import("pino").Logger, maxImageBytes: number, maxVideoBytes: number }} deps
   */
  constructor({ dir, models, logger, maxImageBytes, maxVideoBytes }) {
    this.dir = dir;
    this.MediaItem = models?.MediaItem || null;
    this.logger = logger;
    this.maxImageBytes = maxImageBytes;
    this.maxVideoBytes = maxVideoBytes;
  }

  get available() { return Boolean(this.MediaItem); }

  url(file) { return file ? `/media/files/${file}` : null; }

  /** The shape templates get: urls instead of file names, nothing about the disk */
  present(item) {
    if (!item) return null;
    const data = typeof item.get === "function" ? item.get({ plain: true }) : item;
    let variants;
    try { variants = data.variants ? JSON.parse(data.variants) : []; } catch { variants = []; }
    return {
      ...data,
      variants: variants.filter((v) => v && v.file && v.width).map((v) => ({ width: v.width, src: this.url(v.file) })).sort((a, b) => a.width - b.width),
      src: this.url(data.file),
      posterSrc: this.url(data.poster),
      captionsSrc: this.url(data.captions),
      isVideo: data.kind === "video",
      ratio: data.width && data.height ? `${data.width} / ${data.height}` : "16 / 9",
      shortcode: `[[media:${data.slug}]]`
    };
  }

  async list({ publishedOnly = true } = {}) {
    if (!this.available) return [];
    const where = publishedOnly ? { published: true } : {};
    const rows = await this.MediaItem.findAll({ where, order: [["featured", "DESC"], ["createdAt", "DESC"]] });
    return rows.map((row) => this.present(row));
  }

  async featuredVideo() {
    if (!this.available) return null;
    const row = await this.MediaItem.findOne({ where: { published: true, featured: true, kind: "video" }, order: [["createdAt", "DESC"]] });
    return this.present(row);
  }

  async get(slug, { publishedOnly = true } = {}) {
    if (!this.available || !/^[a-z0-9-]{1,80}$/.test(String(slug))) return null;
    const row = await this.MediaItem.findOne({ where: { slug, ...(publishedOnly ? { published: true } : {}) } });
    return this.present(row);
  }

  async bySlugs(slugs, { publishedOnly = true } = {}) {
    if (!this.available || !slugs.length) return new Map();
    const rows = await this.MediaItem.findAll({ where: { slug: slugs, ...(publishedOnly ? { published: true } : {}) } });
    return new Map(rows.map((row) => [row.slug, this.present(row)]));
  }

  async ensureDir() {
    await mkdir(path.join(this.dir, ".incoming"), { recursive: true });
  }

  /**
   * Streams an upload to a temporary file, refusing it as soon as it gets too big. Returns the temp path and size
   * @param {import("node:stream").Readable} stream
   */
  async receive(stream, { declaredBytes } = {}) {
    await this.ensureDir();
    const limit = Math.max(this.maxImageBytes, this.maxVideoBytes);
    if (declaredBytes && declaredBytes > limit) throw new MediaError(`That file is too big, the limit is ${Math.round(limit / 1048576)} MB`, 413);
    const temp = path.join(this.dir, ".incoming", randomBytes(12).toString("hex"));
    const handle = await open(temp, "wx");
    let bytes = 0;
    try {
      for await (const chunk of stream) {
        bytes += chunk.length;
        if (bytes > limit) throw new MediaError(`That file is too big, the limit is ${Math.round(limit / 1048576)} MB`, 413);
        await handle.write(chunk);
      }
    } catch (error) {
      await handle.close();
      await rm(temp, { force: true });
      throw error;
    }
    await handle.close();
    if (!bytes) {
      await rm(temp, { force: true });
      throw new MediaError("The upload was empty");
    }
    return { temp, bytes };
  }

  async readHead(file, length = 256 * 1024) {
    const handle = await open(file, "r");
    try {
      const buffer = Buffer.alloc(length);
      const { bytesRead } = await handle.read(buffer, 0, length, 0);
      return buffer.subarray(0, bytesRead);
    } finally {
      await handle.close();
    }
  }

  /** Asks ffprobe for a video's size and length when it is installed, the site works without it */
  async probe(file) {
    try {
      const { stdout } = await run("ffprobe", ["-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height:format=duration", "-of", "json", file], { timeout: 20000 });
      const data = JSON.parse(stdout);
      const stream = data.streams?.[0] || {};
      return { width: stream.width || null, height: stream.height || null, durationSeconds: data.format?.duration ? Math.round(Number(data.format.duration)) : null };
    } catch {
      return { width: null, height: null, durationSeconds: null };
    }
  }

  /** A still from two seconds in, as the picture shown before a video plays. Needs ffmpeg, skipped without it */
  async makePoster(videoFile, slug) {
    const name = `${slug}-poster-${randomBytes(4).toString("hex")}.jpg`;
    try {
      await run("ffmpeg", ["-v", "error", "-ss", "2", "-i", videoFile, "-frames:v", "1", "-vf", "scale='min(1600,iw)':-2", "-q:v", "4", "-y", path.join(this.dir, name)], { timeout: 60000 });
      return existsSync(path.join(this.dir, name)) ? name : null;
    } catch {
      return null;
    }
  }

  /** Turns a received upload into a library item. Unpublished until it is switched on in the admin */
  async createFromTemp({ temp, bytes }, fields) {
    const head = await this.readHead(temp);
    const type = sniff(head);
    if (!type) {
      await rm(temp, { force: true });
      throw new MediaError("Only JPEG, PNG, WebP or AVIF pictures and MP4 or WebM videos can be uploaded", 415);
    }
    const max = type.kind === "image" ? this.maxImageBytes : this.maxVideoBytes;
    if (bytes > max) {
      await rm(temp, { force: true });
      throw new MediaError(`That ${type.kind} is too big, the limit is ${Math.round(max / 1048576)} MB`, 413);
    }
    const title = clean(fields.title, MEDIA_LIMITS.title);
    if (!title) {
      await rm(temp, { force: true });
      throw new MediaError("Give it a title");
    }
    const alt = clean(fields.alt, MEDIA_LIMITS.alt);
    if (type.kind === "image" && !alt) {
      await rm(temp, { force: true });
      throw new MediaError("Pictures need a description (alt text) for people who cannot see them");
    }

    const slug = `${slugify(title).slice(0, 60) || type.kind}-${randomBytes(3).toString("hex")}`;
    const file = `${slug}.${type.ext}`;
    await rename(temp, path.join(this.dir, file));

    let size = type.kind === "image" ? imageSize(head, type.mime) : { width: null, height: null };
    let durationSeconds = null;
    let poster = null;
    if (type.kind === "video") {
      const probed = await this.probe(path.join(this.dir, file));
      size = { width: probed.width, height: probed.height };
      durationSeconds = probed.durationSeconds;
      poster = await this.makePoster(path.join(this.dir, file), slug);
    }

    const row = await this.MediaItem.create({
      slug,
      kind: type.kind,
      title,
      alt,
      caption: clean(fields.caption, MEDIA_LIMITS.caption) || null,
      credit: clean(fields.credit, MEDIA_LIMITS.credit) || null,
      file,
      mime: type.mime,
      bytes,
      width: size.width,
      height: size.height,
      durationSeconds,
      poster,
      published: false,
      featured: false
    });
    this.logger?.info({ slug, kind: type.kind, bytes }, "media uploaded");
    return this.present(row);
  }

  async update(id, fields) {
    const row = await this.MediaItem.findByPk(id);
    if (!row) throw new MediaError("That item does not exist", 404);
    const title = clean(fields.title, MEDIA_LIMITS.title);
    if (!title) throw new MediaError("Give it a title");
    const alt = clean(fields.alt, MEDIA_LIMITS.alt);
    if (row.kind === "image" && !alt) throw new MediaError("Pictures need a description (alt text)");
    row.set({
      title,
      alt,
      caption: clean(fields.caption, MEDIA_LIMITS.caption) || null,
      credit: clean(fields.credit, MEDIA_LIMITS.credit) || null,
      published: fields.published === "on" || fields.published === true,
      featured: row.kind === "video" && (fields.featured === "on" || fields.featured === true)
    });
    await row.save();
    // Only one featured video at a time, it is the one on the home page
    if (row.featured) await this.MediaItem.update({ featured: false }, { where: { featured: true, id: { [Op.ne]: row.id } } });
    return this.present(row);
  }

  async attachCaptions(id, buffer) {
    const row = await this.MediaItem.findByPk(id);
    if (!row || row.kind !== "video") throw new MediaError("Captions only go on videos", 404);
    const { vtt, transcript } = toWebVtt(buffer.toString("utf8"));
    const name = `${row.slug}-captions-${randomBytes(4).toString("hex")}.vtt`;
    await writeFile(path.join(this.dir, name), vtt);
    if (row.captions) await rm(path.join(this.dir, row.captions), { force: true });
    row.set({ captions: name, transcript: transcript.slice(0, MEDIA_LIMITS.transcript) });
    await row.save();
    return this.present(row);
  }

  async attachPoster({ temp, bytes }, id) {
    const row = await this.MediaItem.findByPk(id);
    if (!row || row.kind !== "video") {
      await rm(temp, { force: true });
      throw new MediaError("Posters only go on videos", 404);
    }
    const type = sniff(await this.readHead(temp, 64));
    if (!type || type.kind !== "image" || bytes > this.maxImageBytes) {
      await rm(temp, { force: true });
      throw new MediaError("The poster has to be a JPEG, PNG, WebP or AVIF picture", 415);
    }
    const name = `${row.slug}-poster-${randomBytes(4).toString("hex")}.${type.ext}`;
    await rename(temp, path.join(this.dir, name));
    if (row.poster) await rm(path.join(this.dir, row.poster), { force: true });
    row.set({ poster: name });
    await row.save();
    return this.present(row);
  }

  /**
   * A smaller copy of a picture for srcset. The width is read from the file itself, not trusted from the browser,
   * and it has to be smaller than the original or theres no point. Uploading the same width again replaces it
   */
  async attachVariant({ temp, bytes }, id) {
    const row = await this.MediaItem.findByPk(id);
    const fail = async (message, status) => { await rm(temp, { force: true }); throw new MediaError(message, status); };
    if (!row || row.kind !== "image") return fail("Smaller copies only go on pictures", 404);
    const head = await this.readHead(temp, 64 * 1024);
    const type = sniff(head);
    if (!type || type.kind !== "image" || bytes > this.maxImageBytes) return fail("The copy has to be a JPEG, PNG, WebP or AVIF picture", 415);
    const { width } = imageSize(head, type.mime);
    if (!width || !row.width || width >= row.width) return fail("The copy has to be narrower than the original", 400);
    let list;
    try { list = row.variants ? JSON.parse(row.variants) : []; } catch { list = []; }
    if (list.length >= 6 && !list.some((v) => v.width === width)) return fail("That picture already has enough smaller copies", 400);
    const name = `${row.slug}-w${width}-${randomBytes(3).toString("hex")}.${type.ext}`;
    await rename(temp, path.join(this.dir, name));
    for (const old of list.filter((v) => v.width === width)) await rm(path.join(this.dir, old.file), { force: true });
    list = [...list.filter((v) => v.width !== width), { width, file: name }].sort((a, b) => a.width - b.width);
    row.set({ variants: JSON.stringify(list) });
    await row.save();
    return this.present(row);
  }

  async remove(id) {
    const row = await this.MediaItem.findByPk(id);
    if (!row) return false;
    let variants;
    try { variants = row.variants ? JSON.parse(row.variants).map((v) => v.file) : []; } catch { variants = []; }
    for (const name of [row.file, row.poster, row.captions, ...variants].filter(Boolean)) await rm(path.join(this.dir, name), { force: true });
    await row.destroy();
    this.logger?.info({ slug: row.slug }, "media deleted");
    return true;
  }

  async fileInfo(name) {
    if (!/^[a-z0-9-]+\.(jpg|png|webp|avif|mp4|webm|vtt)$/.test(name)) return null;
    const full = path.join(this.dir, name);
    try {
      const info = await stat(full);
      return info.isFile() ? { full, size: info.size } : null;
    } catch {
      return null;
    }
  }

}

/**
 * Replaces [[media:slug]] in rendered article html with the picture or video. A paragraph that only holds the code
 * becomes a figure, so it can be written on its own line in Markdown. Unknown or unpublished slugs just disappear
 */
/**
 * Swaps the media placeholders (from the block syntax in content-blocks.js) and any old style [[media:slug]] left
 * in the middle of a paragraph for the real figures, with one query for every picture on the page. Anything that
 * no longer exists in the library is quietly left out
 */
export async function renderMediaShortcodes(html, media, renderFigure, { publishedOnly = true, renderGallery = galleryFigure } = {}) {
  const placeholder = /<!--rp-media:([A-Za-z0-9_-]+)-->/g;
  const legacy = /(?:<p>)?\[\[media:([a-z0-9-]{1,80})\]\](?:<\/p>)?/g;
  const blocks = new Map();
  for (const match of html.matchAll(placeholder)) {
    const data = readMediaPlaceholder(match[1]);
    if (data) blocks.set(match[1], data);
  }
  const slugs = new Set([...html.matchAll(legacy)].map((match) => match[1]));
  for (const data of blocks.values()) for (const slug of data.kind === "gallery" ? data.slugs : [data.slug]) slugs.add(slug);
  if (!slugs.size) return html;
  const found = await media.bySlugs([...slugs], { publishedOnly });
  return html
    .replace(placeholder, (whole, key) => {
      const data = blocks.get(key);
      if (!data) return "";
      if (data.kind === "gallery") return renderGallery(data.slugs.map((slug) => found.get(slug)).filter(Boolean), data);
      return found.has(data.slug) ? renderFigure(found.get(data.slug), { layout: { size: data.size, align: data.align, caption: data.caption, link: data.link } }) : "";
    })
    .replace(legacy, (whole, slug) => (found.has(slug) ? renderFigure(found.get(slug)) : ""));
}
