// Everything the admin does to content goes through here: save a draft, publish, schedule, autosave, move to the
// trash and back, restore an old revision, save a list like the timeline. Each one is checked first with the same
// rules the site uses to show it, so nothing that would break a page can be published. Drafts are let through
// with missing fields (you're still writing them), they just cant be published untill they're complete.
import { DATA_SCHEMAS, ENTRY_SCHEMAS, RESERVED_SLUGS, cleanObject, cleanValue } from "../admin/schemas.js";
import { buildEntry, ContentError, isLive } from "./content-service.js";
import { slugify } from "../utils/text.js";

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const MAX_BODY = 500000;

export class AdminError extends Error {
  constructor(message, { status = 400, errors = [] } = {}) {
    super(message);
    this.name = "AdminError";
    this.status = status;
    this.errors = errors;
  }
}

/** "2026-10-23T14:30" from a datetime-local input, read as Berlin time is wrong half the year, so its sent as UTC */
function parsePublishAt(value) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new AdminError("The publish time isnt a valid date");
  return date;
}

export class ContentAdmin {
  /**
   * @param {object} deps
   * @param {import("../repositories/content-repository.js").ContentRepository} deps.repository
   * @param {import("./content-service.js").ContentService} deps.content
   * @param {import("./legal-templates.js").LegalTemplates} deps.templates
   * @param {object} deps.config
   * @param {object} [deps.logger]
   * @param {(name: string, req?: object) => object} [deps.legalData] sample data the legal templates are checked with
   */
  constructor({ repository, content, templates, config, logger, legalData }) {
    this.repository = repository;
    this.content = content;
    this.templates = templates;
    this.config = config;
    this.logger = logger;
    this.legalData = legalData || (() => ({}));
    this.reserved = new Set([...RESERVED_SLUGS, ...Object.keys(config.redirects || {}).map((path) => path.split("/")[1]).filter(Boolean)]);
  }

  schema(type) {
    const schema = ENTRY_SCHEMAS[type];
    if (!schema || (schema.feature && !this.config.features[schema.feature])) throw new AdminError("Not found", { status: 404 });
    return schema;
  }

  /**
   * Checks an editor submission and turns it into a record. strict means it is going live, so everything the page
   * needs has to be there
   */
  async prepare(type, input, { existing, strict, liveAt = null }) {
    const schema = this.schema(type);
    const errors = [];
    const title = String(input.title ?? existing?.title ?? "").trim();
    if (!title && strict) errors.push("Title: is required");
    if (title.length > schema.titleMax) errors.push(`Title: is longer than ${schema.titleMax} characters`);

    const { value: meta, errors: fieldErrors } = cleanObject(schema.fields, input.meta, "", { lenient: !strict });
    errors.push(...fieldErrors);
    // A post going live without a published date gets the day it goes live, so the date never changes later on
    if (type === "writing" && strict && !meta.date) meta.date = (liveAt || new Date()).toISOString().slice(0, 10);

    let slug = schema.fixed ? existing?.slug : String(input.slug || "").trim().toLowerCase();
    if (!slug && !schema.fixed) slug = slugify(title) || (existing?.slug ?? "");
    if (!slug) slug = `untitled-${Date.now().toString(36)}`;
    if (!SLUG.test(slug)) errors.push("Address: use lowercase letters, numbers and hyphens, like my-new-post");
    if (type === "pages" && this.reserved.has(slug) && slug !== "about") errors.push(`Address: /${slug} is already used by another part of the site, pick a different one`);
    if (slug.length > 120) errors.push("Address: is longer than 120 characters");
    const clash = SLUG.test(slug) ? await this.repository.findEntry(type, slug) : null;
    if (clash && clash.id !== existing?.id) errors.push(`Address: there already is a ${schema.singular} at ${slug}${clash.status === "trash" ? " (in the trash)" : ""}`);

    const body = String(input.body ?? existing?.body ?? "").replace(/\r\n/g, "\n");
    if (body.length > MAX_BODY) errors.push("The text is too long to save in one go");
    if (errors.length) throw new AdminError("Some things need fixing before this can be saved", { errors });

    const record = { type, slug, title: title || "Untitled", meta, body };
    if (strict) {
      try {
        buildEntry({ ...record, status: "published", publishAt: null });
      } catch (error) {
        if (error instanceof ContentError) throw new AdminError("Some things need fixing before this can be published", { errors: [error.problem] });
        throw error;
      }
      if (type === "legal") await this.checkTemplate(slug, body);
    }
    return record;
  }

  async checkTemplate(slug, body) {
    try {
      await this.templates.check(body, { ...this.legalData(slug, { query: {} }), meta: { breadcrumbs: [] }, site: this.config.site });
    } catch (error) {
      throw new AdminError("The template has a mistake in it", { errors: [String(error.message).split("\n").slice(0, 4).join(" ")] });
    }
  }

  /**
   * The one save for every button in the editor:
   *   draft     save, and take it off the site if it was on
   *   publish   put it on the site now (or at publishAt if thats in the future)
   *   update    save changes to something allready published, it stays as it is
   *   autosave  every so often while typing. Never changes what the site shows: on something published it only
   *             writes a revision, the editor offers it back if the tab was closed before saving
   * Returns the saved entry
   */
  async save(type, input, action) {
    if (!["draft", "publish", "update", "autosave"].includes(action)) throw new AdminError("Unknown action");
    const existing = input.id ? await this.repository.getEntry(Number(input.id)) : null;
    if (input.id && (!existing || existing.type !== type)) throw new AdminError("Not found", { status: 404 });
    if (!existing && this.schema(type).fixed) throw new AdminError("These pages cant be added or removed, only edited", { status: 400 });
    if (existing?.status === "trash") throw new AdminError("This is in the trash, restore it first");
    // An edit made in another tab since this one was opened would be overwritten, so the editor sends the version it
    // started from and gets told instead
    if (existing && input.baseUpdatedAt && action !== "autosave" && new Date(input.baseUpdatedAt).getTime() < new Date(existing.updatedAt).getTime() - 1000) {
      throw new AdminError("This was changed somewhere else (another tab or device) since you opened it. Copy anything you need, then reload to get the newest version.", { status: 409 });
    }

    const live = existing && existing.status === "published";
    if (action === "autosave") {
      const record = await this.prepare(type, input, { existing, strict: false });
      if (live) {
        await this.repository.models.EntryRevision.create({ entryId: existing.id, slug: record.slug, title: record.title, status: existing.status, publishAt: existing.publishAt, meta: JSON.stringify(record.meta), body: record.body, reason: "autosave" });
        return { entry: existing, autosavedOnly: true };
      }
      const { entry } = await this.repository.saveEntry({ ...record, id: existing?.id, status: "draft", publishAt: existing?.publishAt || null }, { reason: "autosave" });
      return { entry };
    }

    const goingLive = action === "publish" || (action === "update" && live);
    let status = "draft";
    let publishAt = null;
    if (goingLive) {
      status = "published";
      const wanted = action === "publish" ? parsePublishAt(input.publishAt) : existing?.publishAt ? new Date(existing.publishAt) : null;
      // A time in the past just means now, only a future time schedules it
      publishAt = wanted && wanted.getTime() > Date.now() ? wanted : null;
    }
    const record = await this.prepare(type, input, { existing, strict: goingLive, liveAt: publishAt });
    const { entry, before } = await this.repository.saveEntry({ ...record, id: existing?.id, status, publishAt }, { reason: goingLive ? "publish" : "save" });
    await this.content.refresh();
    this.logger?.info({ type, slug: entry.slug, status, scheduled: Boolean(publishAt) }, "content saved in the admin");
    return { entry, before };
  }

  async trash(id) {
    const existing = await this.repository.getEntry(Number(id));
    if (!existing) throw new AdminError("Not found", { status: 404 });
    if (this.schema(existing.type).fixed) throw new AdminError("These pages cant be removed, only edited");
    const result = await this.repository.setStatus(existing.id, "trash");
    await this.content.refresh();
    return result;
  }

  /** Out of the trash as a draft, so nothing goes back on the site without you looking at it first */
  async restore(id) {
    const existing = await this.repository.getEntry(Number(id));
    if (!existing || existing.status !== "trash") throw new AdminError("Not found", { status: 404 });
    const clash = await this.repository.findEntry(existing.type, existing.slug);
    if (clash && clash.id !== existing.id) throw new AdminError(`Something else uses ${existing.slug} now, rename that first`);
    const result = await this.repository.setStatus(existing.id, "draft", { reason: "restore" });
    await this.content.refresh();
    return result;
  }

  async deleteForever(id) {
    const existing = await this.repository.getEntry(Number(id));
    if (!existing || existing.status !== "trash") throw new AdminError("Only things in the trash can be deleted for good", { status: 400 });
    await this.repository.deleteEntry(existing.id);
    return existing;
  }

  /** Copies an old revision's text back. The status stays what it is now, and a published entry is checked first */
  async restoreRevision(entryId, revisionId) {
    const existing = await this.repository.getEntry(Number(entryId));
    const revision = await this.repository.revision(Number(revisionId));
    if (!existing || !revision || revision.entryId !== existing.id) throw new AdminError("Not found", { status: 404 });
    const live = existing.status === "published";
    const record = await this.prepare(existing.type, { title: revision.title, slug: revision.slug, meta: revision.meta, body: revision.body }, { existing, strict: live });
    const result = await this.repository.saveEntry({ ...record, id: existing.id, status: existing.status, publishAt: existing.publishAt }, { reason: live ? "publish" : "restore" });
    await this.content.refresh();
    return result;
  }

  /**
   * Changes autosaved on something published but never saved, offered back when the editor opens. A draft's
   * autosave goes into the draft itself, so theres only ever something to offer for published entries: when the
   * newest revision is an autosave, nothing was saved after it
   */
  async pendingAutosave(entry) {
    if (!entry || entry.status !== "published") return null;
    const [newest] = await this.repository.revisions(entry.id);
    return newest && newest.reason === "autosave" ? newest : null;
  }

  // Lists and settings

  documentSchema(name) {
    const schema = DATA_SCHEMAS[name];
    if (!schema) throw new AdminError("Not found", { status: 404 });
    return schema;
  }

  async readDocument(name) {
    const schema = this.documentSchema(name);
    const value = await this.repository.getDocument(name);
    return value ?? (schema.root.type === "objects" ? [] : {});
  }

  async saveDocument(name, raw) {
    const schema = this.documentSchema(name);
    const { value, errors } = schema.root.type === "object" ? cleanObject(schema.root.fields, raw) : cleanValue(schema.root, raw, schema.title);
    if (errors.length) throw new AdminError("Some fields need fixing", { errors });
    if (schema.fixedLength && Array.isArray(value) && value.length !== 3) throw new AdminError("There have to be exactly three branches");
    const result = await this.repository.saveDocument(name, value);
    await this.content.refresh();
    this.logger?.info({ name }, "list saved in the admin");
    return result;
  }

  async restoreDocumentRevision(name, revisionId) {
    const revision = await this.repository.documentRevision(Number(revisionId));
    if (!revision || revision.name !== name) throw new AdminError("Not found", { status: 404 });
    return this.saveDocument(name, revision.data);
  }

  /** What the dashboard and lists show for an entry: is it live, scheduled, a draft */
  static state(entry, now = new Date()) {
    if (entry.status === "trash") return "trash";
    if (entry.status === "draft") return "draft";
    return isLive(entry, now) ? "published" : "scheduled";
  }
}
