// npm run content:check: reads every content file the way the site does and checks the house rules.
//
//   errors (exit code 1): front matter the site cant read, em dashes, a skill pointing at a project that doesnt exist,
//                         internal links to pages that dont exist
//   warnings:             summaries that are too long for search results, things still marked todo
//
// Also checks the templates and config for em dashes, they are just as public.
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { ROOT_DIR, loadConfig } from "../src/config/index.js";
import { ContentService } from "../src/services/content-service.js";
import { hasEmDash } from "../src/utils/text.js";

const errors = [];
const warnings = [];
const rel = (file) => path.relative(ROOT_DIR, file);

function walk(dir, test) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) out.push(...walk(full, test));
    else if (test(full)) out.push(full);
  }
  return out;
}

// 1. Em dashes anywhere a visitor (or a reader of the code) could see them
const publicFiles = [
  ...walk(path.join(ROOT_DIR, "content"), (f) => /\.(md|yml)$/.test(f)),
  ...walk(path.join(ROOT_DIR, "views"), (f) => f.endsWith(".hbs")),
  ...walk(path.join(ROOT_DIR, "src"), (f) => f.endsWith(".js")),
  ...walk(path.join(ROOT_DIR, "assets/js"), (f) => f.endsWith(".js")),
  ...walk(path.join(ROOT_DIR, "styles"), (f) => f.endsWith(".scss")),
  ...walk(path.join(ROOT_DIR, "docs"), (f) => f.endsWith(".md")),
  path.join(ROOT_DIR, "config/application.yml")
];
for (const file of publicFiles) {
  readFileSync(file, "utf8").split("\n").forEach((line, index) => {
    if (hasEmDash(line)) errors.push(`${rel(file)}:${index + 1} has an em dash: ${line.trim().slice(0, 80)}`);
  });
}

// 2. The content itself, loaded exactly like the site does
let content;
try {
  content = new ContentService({ contentDir: path.join(ROOT_DIR, "content"), includeDrafts: true });
  content.load();
} catch (error) {
  errors.push(error.message);
}

if (content) {
  const config = loadConfig({ loadDotEnv: false, env: { NODE_ENV: "development" } });
  const projects = content.listProjects();
  const articles = content.listArticles();

  // Every internal link has to go somewhere that exists
  const known = new Set(["/", "/about", "/projects", "/writing", "/contact", "/tools",
    ...config.navigation.legal.map((l) => l.href),
    ...projects.filter((p) => p.hasPage).map((p) => p.url),
    ...articles.map((a) => a.url)]);
  const docs = [...projects, ...articles, ...Object.values(content.state.pages)];
  for (const doc of docs) {
    for (const match of doc.html.matchAll(/href="(\/[^"#?]*)/g)) {
      const target = match[1].replace(/\/$/, "") || "/";
      if (!known.has(target) && !target.startsWith("/assets/")) errors.push(`${doc.url || doc.slug} links to ${target}, which does not exist`);
    }
  }
  for (const project of projects) {
    for (const link of project.links) {
      const href = link.url || link.href;
      if (href?.startsWith("/") && !known.has(href)) errors.push(`${project.url} has a link to ${href}, which does not exist`);
    }
  }

  for (const group of content.data("skills") || []) {
    for (const item of group.items) {
      for (const slug of item.evidence || []) {
        if (!content.getProject(slug)) errors.push(`skills.yml: "${item.name}" points at project "${slug}", which has no page`);
      }
    }
  }

  for (const doc of [...projects, ...articles]) {
    if (doc.summary.length > 200) warnings.push(`${doc.url}: summary is ${doc.summary.length} characters, search results cut at about 160`);
    if (doc.draft) warnings.push(`${doc.url}: is a draft and hidden on the site`);
    for (const item of doc.todo) warnings.push(`${doc.url}: todo: ${item}`);
  }
  console.log(`Checked ${projects.length} projects, ${articles.length} articles, ${Object.keys(content.state.pages).length} pages and ${publicFiles.length} files.`);
}

for (const warning of warnings) console.log(`  warning  ${warning}`);
for (const error of errors) console.log(`  ERROR    ${error}`);
console.log(errors.length ? `\n${errors.length} error(s), ${warnings.length} warning(s)` : `\nNo errors, ${warnings.length} warning(s)`);
process.exitCode = errors.length ? 1 : 0;
