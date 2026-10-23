// The admin: dashboard, the lists of posts, pages, projects and the rest, the editor, revisions, previews, the
// lists like the timeline, settings, the GitHub sync and the system page with every endpoint. Signing in lives in
// auth-controller.js and the media library in media-controller.js.
import { randomBytes } from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { BRANCH_LABELS, DATA_SCHEMAS, ENTRY_SCHEMAS, PRIVATE_DOCUMENTS } from "../admin/schemas.js";
import { ENDPOINT_GROUPS, EXTERNAL_LINKS } from "../admin/endpoints.js";
import { AdminError, ContentAdmin } from "../services/content-admin.js";
import { buildEntry, ContentError } from "../services/content-service.js";
import { notFound } from "../middleware/errors.js";
import { HOME_DEFAULTS } from "../services/settings-service.js";

const run = promisify(execFile);
const PREVIEW_MINUTES = 30;

/** JSON that is safe inside a <script> element: no "</script>" can close it early */
const safeJson = (value) => JSON.stringify(value).replace(/</g, "\\u003c");

// The admin sidebar, in the order it shows. type entries link to /admin/<type>, list entries to /admin/lists/<name>
export const ADMIN_NAV = [
  { group: "Content", items: [
    { id: "writing", label: "Posts", href: "/admin/writing", icon: "pen", feature: "writing" },
    { id: "pages", label: "Pages", href: "/admin/pages", icon: "page" },
    { id: "projects", label: "Projects", href: "/admin/projects", icon: "grid" },
    { id: "tools", label: "Tools", href: "/admin/tools", icon: "tool", feature: "tools" },
    { id: "media", label: "Media", href: "/admin/library", icon: "image" }
  ] },
  { group: "About you", items: [
    { id: "timeline", label: "Experience", href: "/admin/lists/timeline", icon: "list" },
    { id: "skills", label: "Skills", href: "/admin/lists/skills", icon: "spark" },
    { id: "cv", label: "CV", href: "/admin/lists/cv", icon: "page" },
    { id: "references", label: "References", href: "/admin/lists/references", icon: "quote" },
    { id: "now", label: "Right now", href: "/admin/lists/now", icon: "clock" }
  ] },
  { group: "Site", items: [
    { id: "home", label: "Home page", href: "/admin/lists/home", icon: "home" },
    { id: "branches", label: "Tree branches", href: "/admin/lists/branches", icon: "tree" },
    { id: "menus", label: "Menus", href: "/admin/lists/menus", icon: "menu" },
    { id: "settings", label: "Settings", href: "/admin/lists/settings", icon: "settings" },
    { id: "legal", label: "Legal pages", href: "/admin/legal", icon: "scale" }
  ] },
  { group: "System", items: [
    { id: "sync", label: "GitHub sync", href: "/admin/sync", icon: "sync" },
    { id: "system", label: "Status and links", href: "/admin/system", icon: "pulse" }
  ] }
];

// Where each list shows on the site, for the "See it on the site" link
const LIST_PUBLIC = { timeline: "/about#experience", now: "/#now-title", references: "/references", cv: "/cv", skills: "/about#skills", branches: "/", home: "/", menus: "/", settings: "/" };

const TYPE_ICONS = { writing: "pen", pages: "page", projects: "grid", tools: "tool", legal: "scale" };

// One line under each list's title saying what it is
const LIST_LEDES = {
  writing: "The articles on /writing and in the feed. Drafts and scheduled posts stay off the site until they go live.",
  pages: "Pages at their own address, like /about. New ones you make show up at /your-address.",
  projects: "Everything on /projects. The ones ticked for the home page show there too.",
  tools: "The small tools on /tools.",
  legal: "The impressum, privacy policy and the rest. Your name, address and the other facts are filled in from the settings."
};

const STATE_LABELS = { published: "Published", scheduled: "Scheduled", draft: "Draft", trash: "In the trash" };

/**
 * @param {object} deps
 * @param {object} deps.config
 * @param {import("../services/seo-service.js").SeoService} deps.seo
 * @param {import("../services/content-service.js").ContentService} deps.content
 * @param {ContentAdmin} deps.contentAdmin
 * @param {import("../repositories/content-repository.js").ContentRepository} deps.repository
 * @param {import("../services/media-service.js").MediaService} deps.media
 * @param {ReturnType<import("../services/status-service.js").createStatusService>} deps.status
 * @param {import("../services/github-sync.js").GitHubSync} deps.sync
 * @param {object} deps.pages the pages controller, its renderers draw the previews
 * @param {object} deps.legal the legal controller, its renderer draws the legal previews
 */
/** The sidebar with the current page marked, the media page uses this too */
export function buildAdminNav(config, current) {
  return ADMIN_NAV.map((group) => ({
    group: group.group,
    items: group.items.filter((item) => !item.feature || config.features[item.feature]).map((item) => ({ ...item, current: item.id === current }))
  }));
}

export function createAdminController({ config, seo, content, contentAdmin, repository, media, status, sync, pages, legal }) {
  const meta = (title) => seo.build({ title: `${title} | Admin`, description: "reece.page admin", path: "/admin", noindex: true });
  const previews = new Map();

  const nav = (current) => buildAdminNav(config, current);

  /** Renders an admin page in the admin layout with the sidebar */
  function page(res, view, section, title, data = {}) {
    res.render(`pages/admin/${view}`, { layout: "admin", meta: meta(title), nav: nav(section), section, pageTitle: title, ...data });
  }

  function sendError(res, error) {
    if (error instanceof AdminError) return res.status(error.status).json({ ok: false, error: error.message, errors: error.errors });
    res.status(500).json({ ok: false, error: "Saving failed on the server, it has been logged. Your text is still in the editor." });
  }

  /** The shape the editor and the lists get for an entry */
  function present(entry) {
    const schema = ENTRY_SCHEMAS[entry.type];
    const state = ContentAdmin.state(entry);
    return {
      id: entry.id,
      type: entry.type,
      slug: entry.slug,
      title: entry.title,
      status: entry.status,
      state,
      stateLabel: STATE_LABELS[state],
      publishAt: entry.publishAt ? new Date(entry.publishAt).toISOString() : null,
      updatedAt: entry.updatedAt ? new Date(entry.updatedAt).toISOString() : null,
      createdAt: entry.createdAt ? new Date(entry.createdAt).toISOString() : null,
      url: schema.publicPath(entry.slug),
      typeLabel: schema.singular.charAt(0).toUpperCase() + schema.singular.slice(1),
      icon: TYPE_ICONS[entry.type],
      summary: entry.meta?.summary || entry.meta?.lead || entry.meta?.description || "",
      branch: entry.meta?.branch ? BRANCH_LABELS[entry.meta.branch] || entry.meta.branch : null
    };
  }

  function typeSchema(req) {
    const schema = ENTRY_SCHEMAS[req.params.type];
    if (!schema || (schema.feature && !config.features[schema.feature])) return null;
    return schema;
  }

  async function mediaLibrary() {
    try {
      return (await media.list({ publishedOnly: false })).map((item) => ({
        slug: item.slug, title: item.title, kind: item.kind, alt: item.alt, caption: item.caption || "", src: item.src,
        poster: item.posterSrc, width: item.width, height: item.height, published: item.published
      }));
    } catch {
      return [];
    }
  }

  async function cleanPreviews() {
    const now = Date.now();
    for (const [key, value] of previews) if (value.expires < now) previews.delete(key);
  }

  return {
    nav,

    async dashboard(req, res, next) {
      try {
        const [counts, recent] = await Promise.all([repository.counts(), repository.recent(8)]);
        const now = new Date();
        const scheduled = [];
        const drafts = [];
        for (const type of Object.keys(ENTRY_SCHEMAS)) {
          if (ENTRY_SCHEMAS[type].fixed) continue;
          const list = await repository.listEntries(type, { status: "all" });
          for (const entry of list) {
            const state = ContentAdmin.state(entry, now);
            if (state === "scheduled") scheduled.push(present(entry));
            if (state === "draft") drafts.push(present(entry));
          }
        }
        const cards = Object.entries(ENTRY_SCHEMAS)
          .filter(([, schema]) => !schema.fixed && (!schema.feature || config.features[schema.feature]))
          .map(([type, schema]) => ({ type, title: schema.title, singular: schema.singular, href: `/admin/${type}`, icon: TYPE_ICONS[type], count: counts[type]?.published || 0, drafts: counts[type]?.draft || 0 }));
        // The media count is a nice to have, without the database the media library isnt there at all
        const mediaItems = media.available ? await media.list({ publishedOnly: false }).catch(() => null) : null;
        page(res, "dashboard", "dashboard", "Dashboard", {
          cards,
          hasMedia: Boolean(mediaItems),
          mediaCount: mediaItems ? mediaItems.length : 0,
          mediaPublished: mediaItems ? mediaItems.filter((item) => item.published).length : 0,
          statCount: cards.length + (mediaItems ? 1 : 0),
          recent: recent.map(present),
          scheduled: scheduled.sort((a, b) => new Date(a.publishAt) - new Date(b.publishAt)),
          drafts: drafts.slice(0, 6),
          source: content.source,
          sync: sync.status,
          syncEnabled: sync.enabled,
          signedInWith: req.admin.method
        });
      } catch (error) { next(error); }
    },

    async list(req, res, next) {
      const schema = typeSchema(req);
      if (!schema) return next(notFound());
      const type = req.params.type;
      const filter = ["all", "published", "scheduled", "draft", "trash"].includes(req.query.status) ? req.query.status : "all";
      const search = typeof req.query.q === "string" ? req.query.q.slice(0, 100) : "";
      try {
        const all = await repository.listEntries(type, { status: filter === "trash" ? "trash" : "all", search });
        const now = new Date();
        const items = all.map(present).filter((item) => filter === "all" || filter === "trash" || item.state === filter);
        const counts = { all: 0, published: 0, scheduled: 0, draft: 0, trash: 0 };
        for (const entry of await repository.listEntries(type, { status: "all" })) { counts.all += 1; counts[ContentAdmin.state(entry, now)] += 1; }
        counts.trash = (await repository.listEntries(type, { status: "trash" })).length;
        page(res, "list", type, schema.title, {
          type,
          schema: { title: schema.title, singular: schema.singular, fixed: Boolean(schema.fixed) },
          lede: LIST_LEDES[type],
          items,
          filter,
          search,
          tabs: [["all", "All"], ["published", "Published"], ["scheduled", "Scheduled"], ["draft", "Drafts"], ["trash", "Trash"]]
            .filter(([id]) => !schema.fixed || id === "all")
            .map(([id, label]) => ({ id, label, count: counts[id], current: id === filter, href: `/admin/${type}${id === "all" ? "" : `?status=${id}`}` })),
          notice: req.query.notice
        });
      } catch (error) { next(error); }
    },

    async editor(req, res, next) {
      const schema = typeSchema(req);
      if (!schema) return next(notFound());
      const type = req.params.type;
      try {
        let entry = null;
        if (req.params.id) {
          entry = await repository.getEntry(Number(req.params.id));
          if (!entry || entry.type !== type) return next(notFound());
        } else if (schema.fixed) {
          return next(notFound());
        }
        const autosave = entry ? await contentAdmin.pendingAutosave(entry) : null;
        const presented = entry ? present(entry) : null;
        page(res, "editor", type, entry ? `Edit ${entry.title}` : `New ${schema.singular}`, {
          bodyClass: "admin-editor-page",
          type,
          entry: presented,
          schema: { title: schema.title, singular: schema.singular },
          editorJson: safeJson({
            type,
            editor: schema.editor,
            singular: schema.singular,
            fixed: Boolean(schema.fixed),
            titleMax: schema.titleMax,
            fields: schema.fields,
            publicBase: schema.publicPath("SLUG"),
            entry: entry ? { ...presented, meta: entry.meta, body: entry.body } : null,
            autosave: autosave ? { createdAt: autosave.createdAt, title: autosave.title, slug: autosave.slug, meta: autosave.meta, body: autosave.body } : null,
            urls: {
              save: `/admin/${type}/save`,
              preview: "/admin/preview",
              media: "/admin/media/library.json",
              upload: "/admin/media/upload",
              list: `/admin/${type}`,
              revisions: entry ? `/admin/${type}/${entry.id}/revisions` : null
            }
          }),
          vendorScripts: schema.editor === "blocks" ? [
            "vendor/editorjs-2.31.7/editorjs.umd.js",
            "vendor/editorjs-2.31.7/tools.umd.js",
            "vendor/marked-18/marked.umd.js"
          ] : [],
          scripts: ["js/admin-fields.js", "js/admin-markdown.js", "js/admin-blocks.js", "js/admin-entry.js"]
        });
      } catch (error) { next(error); }
    },

    async save(req, res) {
      if (!typeSchema(req)) return res.status(404).json({ ok: false, error: "Not found" });
      try {
        const body = req.body || {};
        const { entry, autosavedOnly } = await contentAdmin.save(req.params.type, body, String(body.action || ""));
        res.json({ ok: true, autosavedOnly: Boolean(autosavedOnly), entry: present(entry) });
      } catch (error) {
        if (!(error instanceof AdminError)) req.log?.error({ err: error }, "admin save failed");
        sendError(res, error);
      }
    },

    async trash(req, res, next) {
      try {
        await contentAdmin.trash(req.params.id);
        res.redirect(303, `/admin/${req.params.type}?notice=trashed`);
      } catch (error) {
        if (error instanceof AdminError) return res.redirect(303, `/admin/${req.params.type}?notice=failed`);
        next(error);
      }
    },

    async restore(req, res, next) {
      try {
        await contentAdmin.restore(req.params.id);
        res.redirect(303, `/admin/${req.params.type}?notice=restored`);
      } catch (error) {
        if (error instanceof AdminError) return res.redirect(303, `/admin/${req.params.type}?status=trash&notice=restore-failed`);
        next(error);
      }
    },

    async destroy(req, res, next) {
      try {
        await contentAdmin.deleteForever(req.params.id);
        res.redirect(303, `/admin/${req.params.type}?status=trash&notice=deleted`);
      } catch (error) {
        if (error instanceof AdminError) return res.redirect(303, `/admin/${req.params.type}?status=trash&notice=failed`);
        next(error);
      }
    },

    async revisions(req, res, next) {
      const schema = typeSchema(req);
      if (!schema) return next(notFound());
      try {
        const entry = await repository.getEntry(Number(req.params.id));
        if (!entry || entry.type !== req.params.type) return next(notFound());
        const list = await repository.revisions(entry.id);
        const selected = list.find((r) => String(r.id) === String(req.query.rev)) || list[0] || null;
        page(res, "revisions", req.params.type, `Revisions of ${entry.title}`, {
          type: req.params.type,
          entry: present(entry),
          revisions: list.map((r) => ({ id: r.id, title: r.title, reason: r.reason, status: r.status, createdAt: r.createdAt, current: selected && r.id === selected.id })),
          selected: selected ? { ...selected, metaJson: JSON.stringify(selected.meta, null, 2) } : null,
          currentBody: entry.body,
          notice: req.query.notice
        });
      } catch (error) { next(error); }
    },

    async restoreRevision(req, res, next) {
      try {
        await contentAdmin.restoreRevision(req.params.id, req.params.rev);
        res.redirect(303, `/admin/${req.params.type}/${req.params.id}?notice=restored`);
      } catch (error) {
        if (error instanceof AdminError) return res.redirect(303, `/admin/${req.params.type}/${req.params.id}/revisions?rev=${encodeURIComponent(req.params.rev)}&notice=${encodeURIComponent(error.errors[0] || error.message)}`);
        next(error);
      }
    },

    /**
     * Keeps what the editor has right now for half an hour under a random key, the preview frame then loads it like
     * any page. Nothing is saved, and nothing goes on the site
     */
    async createPreview(req, res) {
      try {
        const body = req.body || {};
        const type = String(body.type || "");
        const schema = ENTRY_SCHEMAS[type];
        if (!schema) return res.status(404).json({ ok: false, error: "Not found" });
        await cleanPreviews();
        if (previews.size > 200) previews.clear();
        const key = String(body.key || "");
        const id = /^[A-Za-z0-9_-]{20,40}$/.test(key) && previews.has(key) ? key : randomBytes(18).toString("base64url");
        previews.set(id, { type, body, expires: Date.now() + PREVIEW_MINUTES * 60000 });
        res.json({ ok: true, key: id, url: `/admin/preview/${id}` });
      } catch (error) { sendError(res, error); }
    },

    async showPreview(req, res, next) {
      const stored = previews.get(req.params.key);
      if (!stored || stored.expires < Date.now()) {
        return res.status(404).type("html").send("<!doctype html><title>Preview</title><p style=\"font-family:system-ui;padding:2rem\">This preview has expired, make a change in the editor to show it again.</p>");
      }
      const { type, body } = stored;
      // A preview is built leniently: missing required bits get a stand in, so you can see the page while writing
      const meta = { ...(body.meta || {}) };
      if (type !== "pages" && type !== "legal" && !meta.summary) meta.summary = "(No summary yet)";
      if (type === "writing" && !meta.date) meta.date = new Date().toISOString().slice(0, 10);
      if (type === "projects") {
        meta.branch ||= "code"; meta.kind ||= "Project"; meta.period ||= "(Period)"; meta.sort_date ||= "2026";
      }
      const record = { type, slug: /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(body.slug || "") ? body.slug : "preview", title: String(body.title || "").trim() || "(Untitled)", status: "published", publishAt: null, meta, body: String(body.body || ""), updatedAt: new Date() };
      try {
        const built = buildEntry(record);
        res.locals.previewing = true;
        if (type === "projects") return await pages.render.project(req, res, built, { preview: true });
        if (type === "writing") return await pages.render.article(req, res, built, { preview: true });
        if (type === "tools") return await pages.render.tool(req, res, built);
        if (type === "pages") return record.slug === "about" ? await pages.render.about(req, res, built) : await pages.render.page(req, res, built, { preview: true });
        if (type === "legal") return await legal.renderPreview(req, res, built);
        next(notFound());
      } catch (error) {
        const message = error instanceof ContentError ? error.problem : String(error.message).split("\n")[0];
        res.status(200).type("html").send(`<!doctype html><title>Preview</title><p style="font-family:system-ui;padding:2rem;color:#9a3a2b">The preview cant be shown yet: ${message.replace(/[<>&]/g, "")}</p>`);
      }
    },

    async mediaLibrary(req, res) {
      res.json({ ok: true, items: await mediaLibrary() });
    },

    // Lists, settings, menus and the home page

    async editList(req, res, next) {
      const schema = DATA_SCHEMAS[req.params.name];
      if (!schema) return next(notFound());
      try {
        let value = await contentAdmin.readDocument(req.params.name);
        // What the site uses while a field is empty, shown greyed out in the field so an empty form doesnt look
        // like an empty site. The menus are filled in for real, a list of links is easier to change than to type
        let defaults = null;
        if (req.params.name === "settings") {
          const site = config.site;
          defaults = { name: site.name, short_name: site.short_name, description: site.description, email: site.email, profiles: { ...site.profiles } };
        }
        if (req.params.name === "home") defaults = HOME_DEFAULTS;
        if (req.params.name === "menus") {
          value = { ...(value || {}) };
          for (const key of ["primary", "more", "legal"]) {
            if (!Array.isArray(value[key]) || !value[key].length) value[key] = (config.navigation[key] || []).map((link) => ({ label: link.label, href: link.href }));
          }
        }
        page(res, "list-editor", req.params.name, schema.title, {
          help: schema.help,
          name: req.params.name,
          publicHref: LIST_PUBLIC[req.params.name],
          privateList: PRIVATE_DOCUMENTS.includes(req.params.name),
          editorJson: safeJson({
            name: req.params.name,
            saveUrl: `/admin/lists/${req.params.name}`,
            root: schema.root,
            fixedLength: Boolean(schema.fixedLength),
            value,
            defaults,
            cvPdf: req.params.name === "cv" && config.isDevelopment
          }),
          scripts: ["js/admin-fields.js", "js/admin-list.js"]
        });
      } catch (error) { next(error); }
    },

    async saveList(req, res) {
      try {
        await contentAdmin.saveDocument(req.params.name, req.body?.value);
        res.json({ ok: true });
      } catch (error) { sendError(res, error); }
    },

    async listRevisions(req, res, next) {
      const schema = DATA_SCHEMAS[req.params.name];
      if (!schema) return next(notFound());
      try {
        const list = await repository.documentRevisions(req.params.name);
        const selected = list.find((r) => String(r.id) === String(req.query.rev)) || list[0] || null;
        page(res, "list-revisions", req.params.name, `Revisions of ${schema.title}`, {
          name: req.params.name,
          title: schema.title,
          revisions: list.map((r) => ({ id: r.id, reason: r.reason, createdAt: r.createdAt, current: selected && r.id === selected.id })),
          selected: selected ? { ...selected, json: JSON.stringify(selected.data, null, 2) } : null
        });
      } catch (error) { next(error); }
    },

    async restoreListRevision(req, res, next) {
      try {
        await contentAdmin.restoreDocumentRevision(req.params.name, req.params.rev);
        res.redirect(303, `/admin/lists/${req.params.name}?restored=1`);
      } catch (error) {
        if (error instanceof AdminError) return res.redirect(303, `/admin/lists/${req.params.name}/revisions`);
        next(error);
      }
    },

    // GitHub sync and the system page

    syncPage(req, res) {
      page(res, "sync", "sync", "GitHub sync", { sync: sync.status, enabled: sync.enabled, repo: config.github.repo, branch: config.github.branch, notice: req.query.notice });
    },

    async syncNow(req, res, next) {
      try {
        await sync.run({ allowManyDeletes: req.body?.confirm_deletes === "yes" });
        res.redirect(303, "/admin/sync?notice=ran");
      } catch (error) { next(error); }
    },

    async system(req, res, next) {
      try {
        const result = await status.run({ detailed: true });
        const groups = ENDPOINT_GROUPS.map((group) => ({
          ...group,
          items: group.items.map((item) => ({ ...item, off: item.feature ? !config.features[item.feature] : false, link: item.method === "GET" && !item.path.includes(":") }))
        }));
        page(res, "system", "system", "Status and links", { status: result, groups, external: EXTERNAL_LINKS, contentSource: content.source });
      } catch (error) { next(error); }
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
