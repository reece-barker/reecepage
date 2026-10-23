// Everything the site shows that isnt a media file: projects, writing, tools, pages, the legal pages and the lists
// (timeline, skills, cv and so on). It all lives in the database now and is edited in the admin, the files in
// content/ are where it started and what GitHub gets a copy of whenever something is published.
//
// The whole lot is kept in memory, so pages never wait on a query. It's built from the files first thing on start
// up (so theres always something to serve, even if MySQL is down), then swapped for the database version as soon
// as that's read, and rebuilt after every save in the admin and whenever a scheduled post goes live.
import { Marked, Renderer } from "marked";
import { slugify, truncate, readingMinutes, stripTags } from "../utils/text.js";
import { toDate } from "../utils/dates.js";
import { readContentFolder } from "./content-records.js";
import { renderBlockSyntax } from "./content-blocks.js";

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
// faith is still the id of the third branch, it shows as People on the site
export const BRANCHES = ["code", "earth", "faith"];
// setTimeout cant wait longer than about 24 days, a post scheduled further out is checked again after that
const MAX_TIMER = 2 ** 31 - 1;

export class ContentError extends Error {
  constructor(file, problem) {
    super(`${file}: ${problem}`);
    this.name = "ContentError";
    this.file = file;
    this.problem = problem;
  }
}

function escapeAttribute(value) {
  return String(value).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}

/**
 * One Marked instance per document, so the heading list (for "On this page") belongs to that document only.
 * Headings get ids, links to other sites get rel=noopener but still open in the same tab like people expect.
 * The block syntax from the editor (callouts, quotes with a name, buttons) is turned into HTML here too, the
 * media and gallery codes need the database so they're done when the page is shown
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
  renderBlockSyntax(marked);
  const html = marked.parse(String(markdown || ""));
  return { html, headings };
}

function requireString(data, key, file, { max } = {}) {
  // YAML turns `period: 2026` into a number, thats still a fine value for a text field
  const value = typeof data[key] === "number" ? String(data[key]) : data[key];
  if (typeof value !== "string" || !value.trim()) throw new ContentError(file, `needs a ${key}`);
  if (max && value.length > max) throw new ContentError(file, `the ${key} is longer than ${max} characters`);
  return value.trim();
}

function asList(value) {
  if (value == null) return [];
  return Array.isArray(value) ? value.filter((item) => item != null && item !== "") : [value];
}

/** Order fields come from YAML as numbers or from the admin as text, empty means "no particular order" */
function orderOf(value) {
  if (value === null || value === undefined || value === "") return 100;
  const number = Number(value);
  return Number.isFinite(number) ? number : 100;
}

function buildProject({ data, html, headings, slug, file }) {
  const branch = String(data.branch || "").toLowerCase();
  if (!BRANCHES.includes(branch)) throw new ContentError(file, `branch must be one of ${BRANCHES.join(", ")}`);
  const sortDate = toDate(data.sort_date);
  if (!sortDate) throw new ContentError(file, "the sort date must be a date like 2026-09");
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
    order: orderOf(data.order),
    // page: false means the project is listed but has no page of its own, for small things with one line to say
    hasPage: data.page !== false,
    todo: asList(data.todo),
    html,
    headings
  };
}

function buildArticle({ data, html, headings, slug, file, raw, publishAt }) {
  // A scheduled post that has no date of its own gets the day it goes live
  const date = toDate(data.date) || (publishAt ? new Date(publishAt) : null);
  if (!date) throw new ContentError(file, "the published date must be a date like 2026-10-12");
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
    order: orderOf(data.order),
    todo: asList(data.todo),
    html,
    headings
  };
}

function buildPage({ data, html, headings, slug, file }) {
  return { ...data, title: requireString(data, "title", file, { max: 120 }), slug, url: `/${slug}`, html, headings };
}

const BUILDERS = { projects: buildProject, writing: buildArticle, tools: buildTool, pages: buildPage };

/** Is this entry on the site right now: published, and if it has a publish time, that time has passed */
export function isLive(entry, now = new Date()) {
  if (entry.status !== "published") return false;
  return !entry.publishAt || new Date(entry.publishAt) <= now;
}

/**
 * Builds one entry the way the site shows it. Throws a ContentError with a plain message when something required
 * is missing, the admin shows that message next to the save button
 */
export function buildEntry(entry) {
  const label = `${entry.type}/${entry.slug}`;
  if (!SLUG_PATTERN.test(String(entry.slug))) throw new ContentError(label, "the address must be lowercase words joined by hyphens");
  if (entry.type === "legal") {
    return { type: "legal", slug: entry.slug, url: `/${entry.slug}`, title: entry.title, description: entry.meta?.description || "", template: entry.body, updatedAt: entry.updatedAt };
  }
  const builder = BUILDERS[entry.type];
  if (!builder) throw new ContentError(label, "unknown kind of content");
  const data = { ...(entry.meta || {}), title: entry.title };
  const { html, headings } = renderMarkdown(entry.body);
  return { ...builder({ data, html, headings, slug: entry.slug, file: label, raw: entry.body, publishAt: entry.publishAt }), updatedAt: entry.updatedAt, publishAt: entry.publishAt || null };
}

export class ContentService {
  /**
   * @param {object} options
   * @param {string} options.contentDir the content/ folder, read at start up and as the fallback
   * @param {object} [options.repository] the ContentRepository, without one only the files are used
   * @param {object} [options.logger]
   */
  constructor({ contentDir, repository = null, logger = null }) {
    this.contentDir = contentDir;
    this.repository = repository;
    this.logger = logger;
    this.store = null;
    this.source = "files";
    this.timer = null;
    this.listeners = new Set();
  }

  /** Reads content/ and builds from it. Throws a ContentError naming the file if something in there is broken */
  loadFiles() {
    const { entries, documents } = readContentFolder(this.contentDir);
    this.store = this.build(entries, documents);
    this.source = "files";
    return this.store;
  }

  /** Same as loadFiles, kept for the scripts that read content without a database */
  load() { return this.loadFiles(); }

  /**
   * Reads everything from the database and swaps it in. When the database cant be read the site keeps what it has
   * (the files, or the last good database read), logs it, and tries again in a minute
   */
  async refresh() {
    if (!this.repository) {
      if (!this.store) this.loadFiles();
      return this.store;
    }
    try {
      const { entries, documents } = await this.repository.readAll();
      this.store = this.build(entries, documents);
      this.source = "database";
      this.scheduleNext(entries);
      for (const listener of this.listeners) listener(this.store);
    } catch (error) {
      if (!this.store) this.loadFiles();
      this.logger?.error({ err: { message: error.message } }, "content could not be read from the database, using what was loaded before");
      this.scheduleRetry();
    }
    return this.store;
  }

  /** Called with the new store after every rebuild, the sitemap cache and the GitHub sync listen for this */
  onChange(listener) { this.listeners.add(listener); return () => this.listeners.delete(listener); }

  build(entries, documents) {
    const now = new Date();
    const store = { projects: [], writing: [], tools: [], pages: {}, legal: {}, data: { ...documents }, loadedAt: now, newest: 0 };
    for (const entry of entries) {
      if (!isLive(entry, now)) continue;
      const built = buildEntry(entry);
      store.newest = Math.max(store.newest, new Date(entry.updatedAt || 0).getTime(), new Date(entry.publishAt || 0).getTime());
      if (entry.type === "legal") store.legal[entry.slug] = built;
      else if (entry.type === "pages") store.pages[entry.slug] = built;
      else store[entry.type].push(built);
    }
    store.projects.sort((a, b) => b.sortDate - a.sortDate || a.order - b.order);
    store.writing.sort((a, b) => b.date - a.date);
    store.tools.sort((a, b) => a.order - b.order);
    return store;
  }

  /** Wakes up when the next scheduled entry is due, so it goes live on time without anyone saving anything */
  scheduleNext(entries) {
    clearTimeout(this.timer);
    const now = Date.now();
    const next = entries
      .filter((entry) => entry.status === "published" && entry.publishAt && new Date(entry.publishAt).getTime() > now)
      .map((entry) => new Date(entry.publishAt).getTime())
      .sort((a, b) => a - b)[0];
    if (!next) return;
    this.timer = setTimeout(() => this.refresh(), Math.min(next - now + 1000, MAX_TIMER));
    this.timer.unref?.();
  }

  scheduleRetry() {
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.refresh(), 60000);
    this.timer.unref?.();
  }

  stop() { clearTimeout(this.timer); }

  get state() {
    if (!this.store) this.loadFiles();
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

  page(slug) { return SLUG_PATTERN.test(String(slug)) ? this.state.pages[slug] || null : null; }

  /** Pages made in the admin that dont have a template of their own, shown at /their-slug */
  listPages() { return Object.values(this.state.pages); }

  legal(slug) { return this.state.legal[slug] || null; }

  /** Newest change to any content, used for the sitemap lastmod of list pages */
  lastModified() {
    return this.state.newest ? new Date(this.state.newest) : this.state.loadedAt;
  }
}
