// Content as plain records, the shape both the files in content/ and the database rows turn into before the site
// builds pages from them. Also turns a record back into the exact file text, which is what gets committed to
// GitHub when something is published, so the files and the database can never disagree on the format.
//
//   entry    { type, slug, title, status, publishAt, meta, body, updatedAt }
//   document { name: data }
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import { dump as dumpYaml, load as parseYaml } from "js-yaml";

// Entry types, the folder in content/ has the same name. legal holds the Handlebars source of the legal pages
export const ENTRY_TYPES = ["projects", "writing", "tools", "pages", "legal"];
export const MARKDOWN_TYPES = ["projects", "writing", "tools", "pages"];
export const STATUSES = ["draft", "published", "trash"];

// Comments at the top of the data files, kept so the files read the same as when they were written by hand
export const DOCUMENT_COMMENTS = {
  timeline: "Education and work, newest first. when is free text on purpose: some things are known by year, some by age",
  now: "What Reece is working on right now. Change the date whenever this list changes, the page shows it",
  references: "References from people Reece worked with. Nothing here is public unless permission is ticked",
  cv: "The one page CV at /cv. Experience, skills and projects come from their own files",
  skills: "Skills with the work that shows them. No self ratings or percentage bars, the evidence links do the talking",
  branches: "The three branches of the tree on the home page. limb is the index the tree script uses to light the right branch",
  settings: "Site settings from the admin. Anything left out falls back to config/application.yml",
  menus: "The menus in the header and footer",
  home: "The texts on the home page"
};

function yaml(value) {
  return dumpYaml(value, { lineWidth: 120, noRefs: true, quotingType: "\"" });
}

/** YAML turns 2026-10-12 into a Date, the rest of the app works with the text form */
export function plainDates(value) {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (Array.isArray(value)) return value.map(plainDates);
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, plainDates(v)]));
  return value;
}

function markdownFiles(directory) {
  if (!existsSync(directory)) return [];
  return readdirSync(directory)
    .filter((file) => file.endsWith(".md") && !file.startsWith("_") && file !== "README.md")
    .map((file) => path.join(directory, file));
}

/** One Markdown file as an entry record. draft: true in the front matter means status draft */
export function entryFromFile(type, file) {
  const source = readFileSync(file, "utf8");
  const { data, content } = matter(source);
  const meta = plainDates({ ...data });
  if (typeof meta.sort_date === "number") meta.sort_date = String(meta.sort_date);
  const draft = Boolean(meta.draft);
  delete meta.draft;
  return {
    type,
    slug: path.basename(file, ".md"),
    title: String(meta.title ?? "").trim(),
    status: draft ? "draft" : "published",
    publishAt: null,
    meta,
    body: content.replace(/^\n+/, ""),
    updatedAt: statSync(file).mtime,
    file
  };
}

/**
 * Everything in content/ as records. The legal pages come from content/legal/*.hbs, their title and description
 * sit in a {{!-- --}} comment block at the top so the file stays valid Handlebars
 */
export function readContentFolder(contentDir) {
  const entries = [];
  for (const type of MARKDOWN_TYPES) {
    for (const file of markdownFiles(path.join(contentDir, type))) entries.push(entryFromFile(type, file));
  }
  const legalDir = path.join(contentDir, "legal");
  if (existsSync(legalDir)) {
    for (const name of readdirSync(legalDir).filter((file) => file.endsWith(".hbs"))) {
      const file = path.join(legalDir, name);
      entries.push({ ...legalFromText(readFileSync(file, "utf8")), type: "legal", slug: path.basename(name, ".hbs"), status: "published", publishAt: null, updatedAt: statSync(file).mtime, file });
    }
  }
  const documents = {};
  const dataDir = path.join(contentDir, "data");
  if (existsSync(dataDir)) {
    for (const name of readdirSync(dataDir).filter((file) => file.endsWith(".yml"))) {
      documents[path.basename(name, ".yml")] = plainDates(parseYaml(readFileSync(path.join(dataDir, name), "utf8")));
    }
  }
  return { entries, documents };
}

const LEGAL_HEAD = /^\{\{!--\n([\s\S]*?)\n--\}\}\n/;

function legalFromText(text) {
  const head = LEGAL_HEAD.exec(text);
  const meta = head ? plainDates(parseYaml(head[1]) || {}) : {};
  return { title: String(meta.title || ""), meta, body: head ? text.slice(head[0].length) : text };
}

/** The path in the repository an entry or document is mirrored to */
export function repoPath(kind, record) {
  if (kind === "document") return `content/data/${record.name}.yml`;
  if (record.type === "legal") return `content/legal/${record.slug}.hbs`;
  return `content/${record.type}/${record.slug}.md`;
}

/** An entry as the text of its file: front matter then the body, exactly like the hand written ones */
export function entryToFile(entry) {
  if (entry.type === "legal") {
    const meta = { ...entry.meta, title: entry.title };
    return `{{!--\n${yaml(meta).trimEnd()}\n--}}\n${String(entry.body).replace(/\r\n/g, "\n").replace(/\s+$/, "")}\n`;
  }
  const meta = { title: entry.title, ...withoutEmpty(entry.meta) };
  return `---\n${yaml(meta)}---\n\n${String(entry.body || "").replace(/\r\n/g, "\n").trim()}\n`;
}

export function documentToFile(name, data) {
  const comment = DOCUMENT_COMMENTS[name];
  return `${comment ? `# ${comment}\n` : ""}${yaml(data)}`;
}

function withoutEmpty(meta) {
  const out = {};
  for (const [key, value] of Object.entries(meta || {})) {
    if (key === "title" || key === "draft") continue;
    if (value === undefined || value === null || value === "" || (Array.isArray(value) && !value.length)) continue;
    out[key] = value;
  }
  return out;
}
