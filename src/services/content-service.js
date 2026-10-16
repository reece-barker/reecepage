// Reads the Markdown content (projects, writing, tools) and the YAML data files from /content.
// Everything is read once and kept in memory, the files only change when the site is deployed again.
// In development the cache is skipped so edits show up on refresh without restarting.
import { readdirSync, readFileSync, existsSync, statSync } from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import { load as parseYaml } from "js-yaml";
import { Marked, Renderer } from "marked";
import { slugify, truncate, readingMinutes, stripTags } from "../utils/text.js";
import { toDate } from "../utils/dates.js";

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const BRANCHES = ["code", "earth", "faith"];
const COLLECTIONS = ["projects", "writing", "tools"];

export class ContentError extends Error {
  constructor(file, problem) {
    super(`${file}: ${problem}`);
    this.name = "ContentError";
  }
}

function escapeAttribute(value) {
  return String(value).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}

/**
 * One Marked instance per document, so the heading list (for "On this page") belongs to that document only.
 * Headings get ids, links to other sites get rel=noopener but still open in the same tab like people expect.
 */
export function renderMarkdown(markdown) {
  const headings = [];
  const seen = new Map();
  const marked = new Marked({ gfm: true });
  marked.use({
    renderer: {
      heading({ tokens, depth }) {
        const html = this.parser.parseInline(tokens);
        let id = slugify(stripTags(html)) || "section";
        const count = seen.get(id) || 0;
        seen.set(id, count + 1);
        if (count) id = `${id}-${count + 1}`;
        if (depth === 2) headings.push({ id, text: stripTags(html) });
        return `<h${depth} id="${id}">${html}</h${depth}>\n`;
      },
      link({ href, title, tokens }) {
        const text = this.parser.parseInline(tokens);
        const external = /^https?:\/\//i.test(href) && !/^https?:\/\/(www\.)?reece\.page/i.test(href);
        const titleAttr = title ? ` title="${escapeAttribute(title)}"` : "";
        return `<a href="${escapeAttribute(href)}"${titleAttr}${external ? ' rel="noopener"' : ""}>${text}</a>`;
      },
      image({ href, title, text }) {
        // Content images are always below the fold, so lazy loading them is fine. Real width and height go in the
        // markdown title as "800x600" so the browser can reserve the space and nothing jumps
        const size = /^(\d+)x(\d+)$/.exec(title || "");
        const dims = size ? ` width="${size[1]}" height="${size[2]}"` : "";
        return `<img src="${escapeAttribute(href)}" alt="${escapeAttribute(text)}"${dims} loading="lazy" decoding="async">`;
      },
      table(token) {
        // Tables scroll sideways on small screens instead of pushing the whole page wider
        const html = Renderer.prototype.table.call(this, token);
        return `<div class="table-scroll" tabindex="0" role="region" aria-label="Table">${html}</div>`;
      }
    }
  });
  const html = marked.parse(markdown);
  return { html, headings };
}

function readDirectory(directory) {
  if (!existsSync(directory)) return [];
  return readdirSync(directory)
    .filter((file) => file.endsWith(".md") && !file.startsWith("_") && file !== "README.md")
    .map((file) => path.join(directory, file));
}

function requireString(data, key, file, { max } = {}) {
  // YAML turns `period: 2026` into a number, thats still a fine value for a text field
  const value = typeof data[key] === "number" ? String(data[key]) : data[key];
  if (typeof value !== "string" || !value.trim()) throw new ContentError(file, `front matter needs "${key}"`);
  if (max && value.length > max) throw new ContentError(file, `"${key}" is longer than ${max} characters`);
  return value.trim();
}

function asList(value) {
  if (value == null) return [];
  return Array.isArray(value) ? value.filter((item) => item != null && item !== "") : [value];
}

function parseFile(file) {
  const source = readFileSync(file, "utf8");
  const { data, content } = matter(source);
  const slug = path.basename(file, ".md");
  if (!SLUG_PATTERN.test(slug)) throw new ContentError(file, "file names must be lowercase words joined by hyphens");
  const { html, headings } = renderMarkdown(content);
  return { data, html, headings, slug, file, raw: content };
}

function buildProject({ data, html, headings, slug, file }) {
  const branch = String(data.branch || "").toLowerCase();
  if (!BRANCHES.includes(branch)) throw new ContentError(file, `branch must be one of ${BRANCHES.join(", ")}`);
  const sortDate = toDate(data.sort_date);
  if (!sortDate) throw new ContentError(file, "sort_date must be a date like 2026-09");
  return {
    type: "project",
    slug,
    url: `/projects/${slug}`,
    title: requireString(data, "title", file, { max: 80 }),
    summary: requireString(data, "summary", file, { max: 220 }),
    description: truncate(data.description || data.summary, 160),
    branch,
    kind: requireString(data, "kind", file),
    context: data.context || "",
    period: requireString(data, "period", file),
    sortDate,
    role: data.role || "",
    team: data.team || "",
    status: data.status || "",
    stack: asList(data.stack),
    facts: asList(data.facts),
    links: asList(data.links),
    cover: data.cover || null,
    featured: Boolean(data.featured),
    order: Number.isFinite(data.order) ? data.order : 100,
    draft: Boolean(data.draft),
    // page: false means the project is listed but has no page of its own, for small things with one line to say
    hasPage: data.page !== false,
    todo: asList(data.todo),
    html,
    headings
  };
}

function buildArticle({ data, html, headings, slug, file, raw }) {
  const date = toDate(data.date);
  if (!date) throw new ContentError(file, "date must be a date like 2026-10-12");
  return {
    type: "article",
    slug,
    url: `/writing/${slug}`,
    title: requireString(data, "title", file, { max: 100 }),
    summary: requireString(data, "summary", file, { max: 220 }),
    description: truncate(data.description || data.summary, 160),
    date,
    updated: toDate(data.updated),
    tags: asList(data.tags),
    draft: Boolean(data.draft),
    todo: asList(data.todo),
    readingMinutes: readingMinutes(raw),
    html,
    headings
  };
}

function buildTool({ data, html, headings, slug, file }) {
  return {
    type: "tool",
    slug,
    url: `/tools/${slug}`,
    title: requireString(data, "title", file, { max: 80 }),
    summary: requireString(data, "summary", file, { max: 220 }),
    description: truncate(data.description || data.summary, 160),
    status: data.status || "",
    launchUrl: data.launch_url || "",
    draft: Boolean(data.draft),
    order: Number.isFinite(data.order) ? data.order : 100,
    todo: asList(data.todo),
    html,
    headings
  };
}

const BUILDERS = { projects: buildProject, writing: buildArticle, tools: buildTool };

export class ContentService {
  /**
   * @param {{ contentDir: string, cache?: boolean, includeDrafts?: boolean }} options
   */
  constructor({ contentDir, cache = true, includeDrafts = false }) {
    this.contentDir = contentDir;
    this.cache = cache;
    this.includeDrafts = includeDrafts;
    this.store = null;
  }

  /** Reads everything, throws a ContentError pointing at the file when something is wrong */
  load() {
    const collections = {};
    for (const name of COLLECTIONS) {
      const items = readDirectory(path.join(this.contentDir, name)).map((file) => BUILDERS[name](parseFile(file)));
      collections[name] = items.filter((item) => this.includeDrafts || !item.draft);
    }
    collections.projects.sort((a, b) => b.sortDate - a.sortDate || a.order - b.order);
    collections.writing.sort((a, b) => b.date - a.date);
    collections.tools.sort((a, b) => a.order - b.order);

    // Free form pages (about) only need a title, the rest of the front matter is passed through as is
    const pages = {};
    for (const file of readDirectory(path.join(this.contentDir, "pages"))) {
      const { data: front, html, headings, slug } = parseFile(file);
      pages[slug] = { ...front, title: requireString(front, "title", file), slug, html, headings };
    }

    const data = {};
    const dataDir = path.join(this.contentDir, "data");
    if (existsSync(dataDir)) {
      for (const file of readdirSync(dataDir).filter((name) => name.endsWith(".yml"))) {
        data[path.basename(file, ".yml")] = parseYaml(readFileSync(path.join(dataDir, file), "utf8"));
      }
    }
    this.store = { ...collections, pages, data, loadedAt: new Date() };
    return this.store;
  }

  get state() {
    if (!this.store || !this.cache) this.load();
    return this.store;
  }

  listProjects({ branch } = {}) {
    const projects = this.state.projects;
    return branch ? projects.filter((project) => project.branch === branch) : projects;
  }

  featuredProjects(limit = 4) {
    return this.state.projects.filter((project) => project.featured).sort((a, b) => a.order - b.order).slice(0, limit);
  }

  getProject(slug) {
    if (!SLUG_PATTERN.test(String(slug))) return null;
    return this.state.projects.find((project) => project.slug === slug && project.hasPage) || null;
  }

  /** The project before and after this one in the list, for the next and previous links at the bottom */
  neighbours(slug) {
    const list = this.state.projects.filter((project) => project.hasPage);
    const index = list.findIndex((project) => project.slug === slug);
    if (index < 0) return { previous: null, next: null };
    return { previous: list[index - 1] || null, next: list[index + 1] || null };
  }

  listArticles() { return this.state.writing; }

  getArticle(slug) {
    if (!SLUG_PATTERN.test(String(slug))) return null;
    return this.state.writing.find((article) => article.slug === slug) || null;
  }

  listTools() { return this.state.tools; }

  getTool(slug) {
    if (!SLUG_PATTERN.test(String(slug))) return null;
    return this.state.tools.find((tool) => tool.slug === slug) || null;
  }

  data(name) { return this.state.data[name]; }

  page(slug) { return this.state.pages[slug] || null; }

  /** Newest change of any content file, used for the sitemap lastmod of list pages */
  lastModified() {
    let newest = 0;
    for (const name of COLLECTIONS) {
      for (const file of readDirectory(path.join(this.contentDir, name))) newest = Math.max(newest, statSync(file).mtimeMs);
    }
    return newest ? new Date(newest) : new Date();
  }
}
