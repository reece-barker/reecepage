// The only place that reads and writes the content tables. Every change to an entry or a document also writes a
// revision in the same transaction, so theres always a way back. Old revisions are trimmed so the tables dont
// grow forever: the newest 50 per entry are kept, plus every one marked as published.
import { Op } from "sequelize";

const KEEP_REVISIONS = 50;

const parse = (text, fallback) => {
  try { return JSON.parse(text); } catch { return fallback; }
};

/** A row as the plain record the content service builds from */
export function entryRecord(row) {
  return {
    id: row.id,
    type: row.type,
    slug: row.slug,
    title: row.title,
    status: row.status,
    publishAt: row.publishAt ? new Date(row.publishAt) : null,
    meta: parse(row.meta, {}),
    body: row.body,
    createdAt: row.createdAt ? new Date(row.createdAt) : null,
    updatedAt: row.updatedAt ? new Date(row.updatedAt) : null
  };
}

export class ContentRepository {
  /** @param {{ models: object, sequelize: import("sequelize").Sequelize }} database */
  constructor(database) {
    this.models = database.models;
    this.sequelize = database.sequelize;
  }

  async readAll() {
    const [rows, docs] = await Promise.all([
      this.models.Entry.findAll({ where: { status: { [Op.ne]: "trash" } } }),
      this.models.Document.findAll()
    ]);
    const documents = {};
    for (const doc of docs) documents[doc.name] = parse(doc.data, null);
    return { entries: rows.map(entryRecord), documents };
  }

  async isEmpty() {
    return (await this.models.Entry.count()) === 0 && (await this.models.Document.count()) === 0;
  }

  /** Lists for the admin, newest change first. status "all" means everything except the trash */
  async listEntries(type, { status = "all", search = "" } = {}) {
    const where = { type };
    if (status === "all") where.status = { [Op.ne]: "trash" };
    else where.status = status;
    const rows = await this.models.Entry.findAll({ where, order: [["updatedAt", "DESC"]] });
    const needle = search.trim().toLowerCase();
    const list = rows.map(entryRecord);
    return needle ? list.filter((entry) => `${entry.title} ${entry.slug}`.toLowerCase().includes(needle)) : list;
  }

  async counts() {
    const rows = await this.models.Entry.findAll({ attributes: ["type", "status"] });
    const out = {};
    for (const row of rows) {
      out[row.type] ||= { all: 0, published: 0, draft: 0, trash: 0, scheduled: 0 };
      out[row.type][row.status] += 1;
      if (row.status !== "trash") out[row.type].all += 1;
    }
    return out;
  }

  async getEntry(id) {
    const row = await this.models.Entry.findByPk(id);
    return row ? entryRecord(row) : null;
  }

  async findEntry(type, slug) {
    const row = await this.models.Entry.findOne({ where: { type, slug } });
    return row ? entryRecord(row) : null;
  }

  /**
   * Creates or updates an entry and writes its revision. Returns the saved record and the one before (null for a
   * new entry), the caller uses both to decide what to tell GitHub
   */
  async saveEntry({ id, type, slug, title, status, publishAt, meta, body }, { reason = "save" } = {}) {
    return this.sequelize.transaction(async (transaction) => {
      const values = { type, slug, title, status, publishAt: publishAt || null, meta: JSON.stringify(meta || {}), body: body || "" };
      let row;
      let before = null;
      if (id) {
        row = await this.models.Entry.findByPk(id, { transaction });
        if (!row) return { entry: null, before: null };
        before = entryRecord(row);
        await row.update(values, { transaction });
      } else {
        row = await this.models.Entry.create(values, { transaction });
      }
      await this.models.EntryRevision.create({ entryId: row.id, slug, title, status, publishAt: values.publishAt, meta: values.meta, body: values.body, reason }, { transaction });
      await this.trimRevisions(row.id, transaction);
      return { entry: entryRecord(row), before };
    });
  }

  async trimRevisions(entryId, transaction) {
    const old = await this.models.EntryRevision.findAll({
      where: { entryId, reason: { [Op.ne]: "publish" } },
      order: [["createdAt", "DESC"], ["id", "DESC"]],
      offset: KEEP_REVISIONS,
      attributes: ["id"],
      transaction
    });
    if (old.length) await this.models.EntryRevision.destroy({ where: { id: old.map((row) => row.id) }, transaction });
  }

  /** Moves to the trash or back out of it, the status before the trash is kept in the newest revision */
  async setStatus(id, status, { reason = status } = {}) {
    const entry = await this.getEntry(id);
    if (!entry) return { entry: null, before: null };
    return this.saveEntry({ ...entry, status }, { reason });
  }

  /** Gone for good, with its revisions. Only from the trash */
  async deleteEntry(id) {
    return this.sequelize.transaction(async (transaction) => {
      const row = await this.models.Entry.findByPk(id, { transaction });
      if (!row) return null;
      const before = entryRecord(row);
      await this.models.EntryRevision.destroy({ where: { entryId: id }, transaction });
      await row.destroy({ transaction });
      return before;
    });
  }

  async revisions(entryId) {
    const rows = await this.models.EntryRevision.findAll({ where: { entryId }, order: [["createdAt", "DESC"], ["id", "DESC"]] });
    return rows.map((row) => ({ id: row.id, title: row.title, slug: row.slug, status: row.status, publishAt: row.publishAt, reason: row.reason, createdAt: row.createdAt, meta: parse(row.meta, {}), body: row.body }));
  }

  async revision(id) {
    const row = await this.models.EntryRevision.findByPk(id);
    return row ? { id: row.id, entryId: row.entryId, title: row.title, slug: row.slug, status: row.status, publishAt: row.publishAt, meta: parse(row.meta, {}), body: row.body, createdAt: row.createdAt, reason: row.reason } : null;
  }

  async getDocument(name) {
    const row = await this.models.Document.findByPk(name);
    return row ? parse(row.data, null) : null;
  }

  async saveDocument(name, data, { reason = "save" } = {}) {
    return this.sequelize.transaction(async (transaction) => {
      const text = JSON.stringify(data);
      const row = await this.models.Document.findByPk(name, { transaction });
      const before = row ? parse(row.data, null) : null;
      if (row) await row.update({ data: text }, { transaction });
      else await this.models.Document.create({ name, data: text }, { transaction });
      await this.models.DocumentRevision.create({ name, data: text, reason }, { transaction });
      const old = await this.models.DocumentRevision.findAll({ where: { name }, order: [["createdAt", "DESC"], ["id", "DESC"]], offset: KEEP_REVISIONS, attributes: ["id"], transaction });
      if (old.length) await this.models.DocumentRevision.destroy({ where: { id: old.map((r) => r.id) }, transaction });
      return { data, before };
    });
  }

  async documentRevisions(name) {
    const rows = await this.models.DocumentRevision.findAll({ where: { name }, order: [["createdAt", "DESC"], ["id", "DESC"]] });
    return rows.map((row) => ({ id: row.id, reason: row.reason, createdAt: row.createdAt, data: parse(row.data, null) }));
  }

  async documentRevision(id) {
    const row = await this.models.DocumentRevision.findByPk(id);
    return row ? { id: row.id, name: row.name, reason: row.reason, createdAt: row.createdAt, data: parse(row.data, null) } : null;
  }

  /** Newest changes across everything, for the dashboard */
  async recent(limit = 8) {
    const rows = await this.models.Entry.findAll({ where: { status: { [Op.ne]: "trash" } }, order: [["updatedAt", "DESC"]], limit });
    return rows.map(entryRecord);
  }
}
