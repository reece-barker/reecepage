// Writes content from the admin back into the files in content/, the same files you would edit by hand.
// Every save is checked by loading the whole content folder again, and rolled back if anything would break, so the
// admin can never leave the site in a state where it doesn't start.
import { existsSync } from "node:fs";
import { readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import matter from "gray-matter";
import { dump as dumpYaml, load as parseYaml } from "js-yaml";
import { DATA_SCHEMAS, DOCUMENT_SCHEMAS, cleanObject, cleanValue } from "../admin/schemas.js";
import { slugify } from "../utils/text.js";

export class EditorError extends Error {
  constructor(message, { status = 400, errors = [] } = {}) {
    super(message);
    this.name = "EditorError";
    this.status = status;
    this.errors = errors;
  }
}

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function yaml(value) {
  return dumpYaml(value, { lineWidth: 120, noRefs: true, quotingType: "\"" });
}

export class ContentEditor {
  /** @param {{ contentDir: string, content: import("./content-service.js").ContentService, logger: object }} deps */
  constructor({ contentDir, content, logger }) {
    this.dir = contentDir;
    this.content = content;
    this.logger = logger;
  }

  dataPath(name) { return path.join(this.dir, "data", DATA_SCHEMAS[name].file); }

  async readData(name) {
    const schema = DATA_SCHEMAS[name];
    if (!schema) throw new EditorError("Unknown data file", { status: 404 });
    const file = this.dataPath(name);
    if (!existsSync(file)) return schema.root.type === "objects" ? [] : {};
    return parseYaml(await readFile(file, "utf8")) ?? (schema.root.type === "objects" ? [] : {});
  }

  /** Writes a file, checks the whole site still loads, puts the old one back if not */
  async safeWrite(file, text) {
    const backup = existsSync(file) ? await readFile(file, "utf8") : null;
    const temp = `${file}.${process.pid}.tmp`;
    await writeFile(temp, text);
    await rename(temp, file);
    try {
      this.content.load();
    } catch (error) {
      if (backup === null) await rm(file, { force: true });
      else await writeFile(file, backup);
      this.content.load();
      throw new EditorError(`Not saved, the site would not load with it: ${error.message}`);
    }
  }

  async saveData(name, raw) {
    const schema = DATA_SCHEMAS[name];
    if (!schema) throw new EditorError("Unknown data file", { status: 404 });
    const { value, errors } = schema.root.type === "object" ? cleanObject(schema.root.fields, raw) : cleanValue(schema.root, raw, schema.title);
    if (errors.length) throw new EditorError("Some fields need fixing", { errors });
    if (schema.fixedLength && Array.isArray(value) && value.length !== 3) throw new EditorError("There have to be exactly three branches");
    await this.safeWrite(this.dataPath(name), `# ${schema.comment}\n${yaml(value)}`);
    this.logger?.info({ file: schema.file }, "content saved from admin");
    return value;
  }

  docPath(collection, slug) {
    if (!DOCUMENT_SCHEMAS[collection] || !SLUG.test(String(slug))) throw new EditorError("Not found", { status: 404 });
    return path.join(this.dir, collection, `${slug}.md`);
  }

  async readDoc(collection, slug) {
    const file = this.docPath(collection, slug);
    if (!existsSync(file)) throw new EditorError("Not found", { status: 404 });
    const { data, content } = matter(await readFile(file, "utf8"));
    // Dates come back from YAML as Date objects, the form wants 2026-10-12
    for (const [key, value] of Object.entries(data)) if (value instanceof Date) data[key] = value.toISOString().slice(0, 10);
    if (typeof data.sort_date === "number") data.sort_date = String(data.sort_date);
    return { slug, fields: data, body: content.replace(/^\n+/, "") };
  }

  /**
   * Creates or updates a Markdown file. A new one gets its slug from the title unless one is given.
   * Renaming (a different slug for an existing file) moves the file
   */
  async saveDoc(collection, { slug, originalSlug, fields, body }) {
    const schema = DOCUMENT_SCHEMAS[collection];
    if (!schema) throw new EditorError("Not found", { status: 404 });
    const { value, errors } = cleanObject(schema.fields, fields);
    const newSlug = String(slug || "").trim() || slugify(value.title || "");
    if (!SLUG.test(newSlug)) errors.push("Address: use lowercase letters, numbers and hyphens, like my-new-project");
    if (errors.length) throw new EditorError("Some fields need fixing", { errors });

    const target = this.docPath(collection, newSlug);
    const original = originalSlug ? this.docPath(collection, originalSlug) : null;
    if ((!original || original !== target) && existsSync(target)) throw new EditorError(`There already is a ${schema.singular} at ${newSlug}`);

    const text = `---\n${yaml(value)}---\n\n${String(body || "").replace(/\r\n/g, "\n").trim()}\n`;
    await this.safeWrite(target, text);
    if (original && original !== target && existsSync(original)) {
      await rm(original);
      this.content.load();
    }
    this.logger?.info({ collection, slug: newSlug }, "content saved from admin");
    return newSlug;
  }

  async deleteDoc(collection, slug) {
    const file = this.docPath(collection, slug);
    if (!existsSync(file)) throw new EditorError("Not found", { status: 404 });
    const backup = await readFile(file, "utf8");
    await rm(file);
    try {
      this.content.load();
    } catch (error) {
      await writeFile(file, backup);
      this.content.load();
      throw new EditorError(`Not deleted, something still points at it: ${error.message}`);
    }
  }
}
