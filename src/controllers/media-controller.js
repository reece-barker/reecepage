// /media (the public library), /media/:slug (one item), /media/files/:name (the files themselves) and the
// password protected /admin/media where Reece uploads, describes, publishes and deletes things.
import { buildAdminNav } from "./admin-controller.js";
import { readFile, rm } from "node:fs/promises";
import { notFound } from "../middleware/errors.js";
import { MediaError } from "../services/media-service.js";
import { mediaFigure, isoDuration } from "../helpers/media-html.js";

const FILE_TYPES = { jpg: "image/jpeg", png: "image/png", webp: "image/webp", avif: "image/avif", mp4: "video/mp4", webm: "video/webm", vtt: "text/vtt; charset=utf-8" };

function header(req, name, max) {
  const raw = req.get(name);
  if (!raw) return "";
  try { return decodeURIComponent(raw).slice(0, max); } catch { return ""; }
}

/**
 * @param {object} deps
 * @param {import("../services/media-service.js").MediaService} deps.media
 * @param {import("../services/seo-service.js").SeoService} deps.seo
 * @param {object} deps.config
 */
export function createMediaController({ media, seo, config }) {
  const videoSchema = (item) => item && item.isVideo ? {
    "@type": "VideoObject",
    name: item.title,
    description: item.caption || item.title,
    thumbnailUrl: item.posterSrc ? seo.absoluteUrl(item.posterSrc) : undefined,
    uploadDate: new Date(item.createdAt).toISOString(),
    duration: isoDuration(item.durationSeconds),
    contentUrl: seo.absoluteUrl(item.src),
    ...(item.transcript ? { transcript: item.transcript } : {})
  } : null;

  async function adminPage(res, { notice = null, error = null, status = 200 } = {}) {
    const items = await media.list({ publishedOnly: false });
    res.status(status).render("pages/admin-media", {
      layout: "admin",
      nav: buildAdminNav(config, "media"),
      section: "media",
      meta: seo.build({ title: "Media | Admin", description: "Upload and manage pictures and videos for reece.page.", path: "/admin/media", noindex: true }),
      items,
      notice,
      error,
      limits: { imageMb: Math.round(media.maxImageBytes / 1048576), videoMb: Math.round(media.maxVideoBytes / 1048576) },
      scripts: ["js/admin-media.js"]
    });
  }

  function sendJsonError(res, error) {
    const status = error instanceof MediaError ? error.status : 500;
    res.status(status).json({ ok: false, error: error instanceof MediaError ? error.message : "The upload failed on the server, it has been logged" });
  }

  return {
    async index(req, res, next) {
      if (!config.features.media) return next(notFound());
      try {
        const items = await media.list();
        const featured = items.find((item) => item.featured && item.isVideo) || null;
        res.render("pages/media", {
          meta: seo.build({
            title: "Media",
            description: "Videos and pictures by Reece Barker: a six minute introduction, and photos of the things he builds.",
            path: "/media",
            breadcrumbs: [{ label: "Media", href: "/media" }],
            schema: [videoSchema(featured)].filter(Boolean)
          }),
          bodyClass: "page-media",
          featured,
          featuredHtml: featured ? mediaFigure(featured, { eager: true }) : "",
          items: items.filter((item) => item !== featured)
        });
      } catch (error) { next(error); }
    },

    async show(req, res, next) {
      if (!config.features.media) return next(notFound());
      try {
        const item = await media.get(req.params.slug);
        if (!item) return next(notFound());
        res.render("pages/media-item", {
          meta: seo.build({
            title: item.title,
            description: item.caption || `${item.isVideo ? "A video" : "A picture"} from the media library of Reece Barker: ${item.title}.`,
            path: `/media/${item.slug}`,
            breadcrumbs: [{ label: "Media", href: "/media" }, { label: item.title, href: `/media/${item.slug}` }],
            schema: [videoSchema(item)].filter(Boolean)
          }),
          bodyClass: "page-media",
          item,
          figureHtml: mediaFigure(item, { eager: true })
        });
      } catch (error) { next(error); }
    },

    async file(req, res, next) {
      const info = await media.fileInfo(req.params.name);
      if (!info) return next(notFound());
      const ext = req.params.name.split(".").pop();
      res.sendFile(info.full, {
        headers: {
          "Content-Type": FILE_TYPES[ext],
          // Names carry a random part and never change, so browsers can keep them for a year
          "Cache-Control": "public, max-age=31536000, immutable",
          "Content-Disposition": "inline",
          "Cross-Origin-Resource-Policy": "same-origin"
        },
        acceptRanges: true,
        dotfiles: "deny"
      }, (error) => { if (error && !res.headersSent) next(error); });
    },

    admin: {
      async page(req, res, next) {
        try { await adminPage(res, { notice: req.query.saved ? "Saved." : req.query.deleted ? "Deleted." : null }); } catch (error) { next(error); }
      },

      async upload(req, res) {
        try {
          const received = await media.receive(req, { declaredBytes: Number(req.get("content-length")) || 0 });
          const item = await media.createFromTemp(received, {
            title: header(req, "x-media-title", 200),
            alt: header(req, "x-media-alt", 400),
            caption: header(req, "x-media-caption", 2100),
            credit: header(req, "x-media-credit", 1100)
          });
          res.status(201).json({ ok: true, item: { id: item.id, slug: item.slug, shortcode: item.shortcode, kind: item.kind, title: item.title, alt: item.alt, caption: item.caption || "", src: item.src, poster: item.posterSrc, width: item.width, height: item.height } });
        } catch (error) {
          if (!(error instanceof MediaError)) req.log?.error({ err: error }, "media upload failed");
          sendJsonError(res, error);
        }
      },

      async captions(req, res) {
        try {
          const received = await media.receive(req, { declaredBytes: Number(req.get("content-length")) || 0 });
          let buffer;
          try {
            if (received.bytes > 2 * 1048576) throw new MediaError("Captions files over 2 MB are not accepted", 413);
            buffer = await readFile(received.temp);
          } finally {
            await rm(received.temp, { force: true });
          }
          const item = await media.attachCaptions(Number(req.params.id), buffer);
          res.json({ ok: true, item: { id: item.id } });
        } catch (error) { sendJsonError(res, error); }
      },

      async variant(req, res) {
        try {
          const received = await media.receive(req, { declaredBytes: Number(req.get("content-length")) || 0 });
          const item = await media.attachVariant(received, Number(req.params.id));
          res.json({ ok: true, item: { id: item.id, variants: item.variants.map((v) => v.width) } });
        } catch (error) { sendJsonError(res, error); }
      },

      async poster(req, res) {
        try {
          const received = await media.receive(req, { declaredBytes: Number(req.get("content-length")) || 0 });
          const item = await media.attachPoster(received, Number(req.params.id));
          res.json({ ok: true, item: { id: item.id } });
        } catch (error) { sendJsonError(res, error); }
      },

      async update(req, res, next) {
        try {
          await media.update(Number(req.params.id), req.body || {});
          res.redirect(303, "/admin/media?saved=1");
        } catch (error) {
          if (error instanceof MediaError) return adminPage(res, { error: error.message, status: error.status }).catch(next);
          next(error);
        }
      },

      async remove(req, res, next) {
        try {
          await media.remove(Number(req.params.id));
          res.redirect(303, "/admin/media?deleted=1");
        } catch (error) { next(error); }
      }
    }
  };
}
