// The paperwork tables: letters, invoices and contracts with their numbers and revisions. Numbers are handed out
// here and only here, one after the other per kind and year (RP-I-2026-0001, RP-I-2026-0002), inside the same
// transaction as the insert so two saves at once can never get the same invoice number.
import { Op } from "sequelize";

const KEEP_REVISIONS = 30;
const parse = (text) => { try { return JSON.parse(text); } catch { return {}; } };

export function paperworkRecord(row) {
  return {
    id: row.id,
    kind: row.kind,
    number: row.number,
    title: row.title,
    lang: row.lang,
    status: row.status,
    data: parse(row.data),
    createdAt: row.createdAt ? new Date(row.createdAt) : null,
    updatedAt: row.updatedAt ? new Date(row.updatedAt) : null
  };
}

export class PaperworkRepository {
  /** @param {{ models: object, sequelize: import("sequelize").Sequelize }} database */
  constructor(database) {
    this.models = database.models;
    this.sequelize = database.sequelize;
  }

  async list({ kind = "", status = "all", search = "" } = {}) {
    const where = {};
    if (kind) where.kind = kind;
    if (status === "all") where.status = { [Op.ne]: "trash" };
    else where.status = status;
    const rows = await this.models.Paperwork.findAll({ where, order: [["updatedAt", "DESC"]], limit: 500 });
    const needle = search.trim().toLowerCase();
    const list = rows.map(paperworkRecord);
    return needle ? list.filter((p) => `${p.title} ${p.number}`.toLowerCase().includes(needle)) : list;
  }

  async get(id) {
    const row = await this.models.Paperwork.findByPk(Number(id));
    return row ? paperworkRecord(row) : null;
  }

  /** The next number for a kind in a year: prefix-code-year-0001 */
  async nextNumber({ prefix, code, year }, transaction) {
    const start = `${prefix}-${code}-${year}-`;
    const rows = await this.models.Paperwork.findAll({ where: { number: { [Op.like]: `${start}%` } }, attributes: ["number"], transaction });
    const highest = rows.reduce((max, row) => Math.max(max, Number(String(row.number).slice(start.length)) || 0), 0);
    return `${start}${String(highest + 1).padStart(4, "0")}`;
  }

  /** A new document with the next number */
  async create({ kind, title, lang, data, prefix, code, year }) {
    return this.sequelize.transaction(async (transaction) => {
      const number = await this.nextNumber({ prefix, code, year }, transaction);
      const row = await this.models.Paperwork.create({ kind, number, title, lang, status: "draft", data: JSON.stringify(data) }, { transaction });
      await this.models.PaperworkRevision.create({ paperworkId: row.id, status: "draft", data: row.data, reason: "create" }, { transaction });
      return paperworkRecord(row);
    });
  }

  async save(id, { title, lang, data, status }, { reason = "save" } = {}) {
    return this.sequelize.transaction(async (transaction) => {
      const row = await this.models.Paperwork.findByPk(Number(id), { transaction });
      if (!row) return null;
      const values = { title, lang, data: JSON.stringify(data) };
      if (status) values.status = status;
      await row.update(values, { transaction });
      await this.models.PaperworkRevision.create({ paperworkId: row.id, status: row.status, data: values.data, reason }, { transaction });
      const old = await this.models.PaperworkRevision.findAll({ where: { paperworkId: row.id }, order: [["createdAt", "DESC"], ["id", "DESC"]], offset: KEEP_REVISIONS, attributes: ["id"], transaction });
      if (old.length) await this.models.PaperworkRevision.destroy({ where: { id: old.map((r) => r.id) }, transaction });
      return paperworkRecord(row);
    });
  }

  async setStatus(id, status) {
    const current = await this.get(id);
    if (!current) return null;
    return this.save(id, { ...current, status }, { reason: status });
  }

  async revisions(id) {
    const rows = await this.models.PaperworkRevision.findAll({ where: { paperworkId: Number(id) }, order: [["createdAt", "DESC"], ["id", "DESC"]] });
    return rows.map((row) => ({ id: row.id, status: row.status, reason: row.reason, createdAt: row.createdAt, data: parse(row.data) }));
  }
}
