// The private admin: link board and status at /admin, editors for projects, articles and the data files,
// the Markdown preview and the CV PDF button. Media has its own controller.
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { DATA_SCHEMAS, DOCUMENT_SCHEMAS } from "../admin/schemas.js";
import { ENDPOINT_GROUPS, EXTERNAL_LINKS } from "../admin/endpoints.js";
import { EditorError } from "../services/content-editor.js";
import { renderMediaShortcodes } from "../services/media-service.js";
import { renderMarkdown } from "../services/content-service.js";
import { mediaFigure } from "../helpers/media-html.js";
import { notFound } from "../middleware/errors.js";

const run = promisify(execFile);

/** JSON that is safe inside a <script> element: no "</script>" can close it early */
const safeJson = (value) => JSON.stringify(value).replace(/</g, "\\u003c");

/**
 * @param {object} deps
 * @param {object} deps.config
 * @param {import("../services/seo-service.js").SeoService} deps.seo
 * @param {import("../services/content-service.js").ContentService} deps.content
 * @param {import("../services/content-editor.js").ContentEditor} deps.editor
 * @param {import("../services/media-service.js").MediaService} deps.media
 * @param {ReturnType<import("../services/status-service.js").createStatusService>} deps.status
 */
export function createAdminController({ config, seo, content, editor, media, status }) {
  const meta = (title) => seo.build({ title, description: "reece.page admin", path: "/admin", noindex: true });
  const editing = () => config.admin.contentEditing;

  function sendError(res, error) {
    if (error instanceof EditorError) return res.status(error.status).json({ ok: false, error: error.message, errors: error.errors });
    res.status(500).json({ ok: false, error: "Saving failed on the server, it has been logged" });
  }

  async function mediaChoices() {
    try {
      return (await media.list({ publishedOnly: false })).map((item) => ({ code: item.shortcode, title: item.title, kind: item.kind, published: item.published }));
    } catch {
      return [];
    }
  }

  return {
    async hub(req, res, next) {
      try {
        const result = await status.run({ detailed: true });
        const groups = ENDPOINT_GROUPS.map((group) => ({
          ...group,
          items: group.items.map((item) => ({ ...item, off: item.feature ? !config.features[item.feature] : false, link: item.method === "GET" && !item.path.includes(":") }))
        }));
        res.render("pages/admin/hub", {
          meta: meta("Admin"),
          bodyClass: "page-admin",
          status: result,
          groups,
          external: EXTERNAL_LINKS,
          editing: editing(),
          devPassword: config.admin.devPassword,
          dataFiles: Object.entries(DATA_SCHEMAS).map(([name, s]) => ({ name, title: s.title, help: s.help })),
          collections: Object.entries(DOCUMENT_SCHEMAS).map(([name, s]) => ({ name, title: s.title, count: name === "projects" ? content.listProjects().length : content.listArticles().length })),
          counts: { media: (await media.list({ publishedOnly: false }).catch(() => [])).length }
        });
      } catch (error) { next(error); }
    },

    collection(req, res, next) {
      const schema = DOCUMENT_SCHEMAS[req.params.collection];
      if (!schema) return next(notFound());
      const fresh = new (content.constructor)({ contentDir: config.paths.content, includeDrafts: true });
      fresh.load();
      const items = req.params.collection === "projects" ? fresh.listProjects() : fresh.listArticles();
      res.render("pages/admin/collection", {
        meta: meta(schema.title),
        bodyClass: "page-admin",
        collection: req.params.collection,
        schema,
        items,
        editing: editing(),
        saved: req.query.saved,
        deleted: req.query.deleted
      });
    },

    async editDoc(req, res, next) {
      const { collection, slug } = req.params;
      const schema = DOCUMENT_SCHEMAS[collection];
      if (!schema) return next(notFound());
      try {
        const doc = slug ? await editor.readDoc(collection, slug) : { slug: "", fields: {}, body: "" };
        res.render("pages/admin/editor", {
          meta: meta(slug ? `Edit ${doc.fields.title || slug}` : `New ${schema.singular}`),
          bodyClass: "page-admin",
          heading: slug ? `Edit ${doc.fields.title || slug}` : `New ${schema.singular}`,
          backHref: `/admin/content/${collection}`,
          backLabel: schema.title,
          help: schema.help,
          editing: editing(),
          publicHref: slug ? `/${collection}/${slug}` : null,
          editorJson: safeJson({
            mode: "document",
            saveUrl: `/admin/content/${collection}`,
            deleteUrl: slug ? `/admin/content/${collection}/${slug}/delete` : null,
            afterSave: `/admin/content/${collection}/`,
            fields: schema.fields,
            value: doc.fields,
            body: doc.body,
            slug: doc.slug,
            media: await mediaChoices()
          }),
          scripts: ["js/admin-editor.js"]
        });
      } catch (error) {
        if (error instanceof EditorError && error.status === 404) return next(notFound());
        next(error);
      }
    },

    async saveDoc(req, res) {
      if (!editing()) return res.status(403).json({ ok: false, error: "Editing is switched off on this server. Edit on your computer and deploy, or set CONTENT_EDITING=true." });
      try {
        const body = req.body || {};
        const slug = await editor.saveDoc(req.params.collection, { slug: body.slug, originalSlug: body.originalSlug, fields: body.fields, body: body.body });
        res.json({ ok: true, slug });
      } catch (error) { sendError(res, error); }
    },

    async deleteDoc(req, res, next) {
      if (!editing()) return res.status(403).type("text/plain").send("Editing is switched off on this server.");
      try {
        await editor.deleteDoc(req.params.collection, req.params.slug);
        res.redirect(303, `/admin/content/${req.params.collection}?deleted=1`);
      } catch (error) {
        if (error instanceof EditorError) return res.status(error.status).type("text/plain").send(error.message);
        next(error);
      }
    },

    async editData(req, res, next) {
      const schema = DATA_SCHEMAS[req.params.name];
      if (!schema) return next(notFound());
      try {
        res.render("pages/admin/editor", {
          meta: meta(schema.title),
          bodyClass: "page-admin",
          heading: schema.title,
          backHref: "/admin",
          backLabel: "Admin",
          help: schema.help,
          editing: editing(),
          publicHref: { timeline: "/about#experience", now: "/#now-title", references: "/references", cv: "/cv", skills: "/about#skills", branches: "/" }[req.params.name],
          editorJson: safeJson({
            mode: "data",
            saveUrl: `/admin/data/${req.params.name}`,
            root: schema.root,
            fixedLength: Boolean(schema.fixedLength),
            value: await editor.readData(req.params.name),
            cvPdf: req.params.name === "cv" && config.isDevelopment
          }),
          scripts: ["js/admin-editor.js"]
        });
      } catch (error) { next(error); }
    },

    async saveData(req, res) {
      if (!editing()) return res.status(403).json({ ok: false, error: "Editing is switched off on this server. Edit on your computer and deploy, or set CONTENT_EDITING=true." });
      try {
        await editor.saveData(req.params.name, req.body?.value);
        res.json({ ok: true });
      } catch (error) { sendError(res, error); }
    },

    /** Markdown to HTML for the editor's preview, the same renderer settings as the site plus media codes */
    async preview(req, res) {
      const markdown = String(req.body?.markdown || "").slice(0, 200000);
      let { html } = renderMarkdown(markdown);
      // Unpublished media shows in the preview, so you can place something before switching it on
      if (media.available) html = await renderMediaShortcodes(html, media, mediaFigure, { publishedOnly: false });
      res.json({ ok: true, html });
    },

    /** Makes the CV PDF with Playwright. Only where Playwright is installed, which is your computer, not the server */
    async cvPdf(req, res) {
      if (!config.isDevelopment) return res.status(403).json({ ok: false, error: "Make the PDF on your computer with npm run cv:pdf and deploy it." });
      try {
        await run(process.execPath, ["--disable-warning=ExperimentalWarning", "scripts/make-cv-pdf.js"], { cwd: config.rootDir, timeout: 120000 });
        res.json({ ok: true });
      } catch (error) {
        res.status(500).json({ ok: false, error: `The PDF could not be made: ${String(error.stderr || error.message).split("\n")[0]}` });
      }
    }
  };
}
