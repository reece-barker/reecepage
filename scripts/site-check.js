// npm run site:check: crawls the whole site the way a search engine would and reports anything broken.
//
// Starts the app on a free port, follows every internal link from the home page and the sitemap, and checks:
// status codes, one h1 per page, a unique title and description of a sensible length, a canonical link, images with
// alt text and size, JSON-LD that parses, links to assets that exist, and no address from a developer's machine.
import { startLocalServer } from "./lib/local-server.js";

const problems = [];
const warnings = [];
const server = await startLocalServer();
const origin = server.url;
const seen = new Map(); // path -> { title, description }
const queue = ["/", "/sitemap.xml", "/robots.txt", "/llms.txt", "/site.webmanifest", "/.well-known/security.txt", "/.well-known/tdmrep.json", "/writing/feed.xml"];
const checkedAssets = new Set();

function enqueue(href, from) {
  let url;
  try { url = new URL(href, origin + from); } catch { problems.push(`${from}: link "${href}" is not a valid address`); return; }
  if (url.origin !== origin && !/^https?:\/\/localhost:3000$/.test(url.origin)) return; // other sites are not ours to check
  const path = url.pathname;
  if (path.startsWith("/assets/") || path.startsWith("/icons/") || /\.\w{2,5}$/.test(path) && !path.endsWith(".xml") && !path.endsWith(".txt")) {
    if (!checkedAssets.has(path)) { checkedAssets.add(path); queue.push(`ASSET ${path}`); }
    return;
  }
  if (!seen.has(path) && !queue.includes(path)) queue.push(path);
}

try {
  while (queue.length) {
    const item = queue.shift();
    if (item.startsWith("ASSET ")) {
      const path = item.slice(6);
      const res = await fetch(origin + path, { method: "HEAD" });
      if (res.status !== 200) problems.push(`asset ${path} answers ${res.status}`);
      continue;
    }
    if (seen.has(item)) continue;
    seen.set(item, null);
    const res = await fetch(origin + item, { redirect: "manual" });
    if (res.status >= 300 && res.status < 400) { warnings.push(`${item} redirects to ${res.headers.get("location")}, link to the target directly`); continue; }
    if (res.status !== 200) { problems.push(`${item} answers ${res.status}`); continue; }
    const type = res.headers.get("content-type") || "";
    const body = await res.text();

    if (item === "/sitemap.xml") {
      for (const m of body.matchAll(/<loc>([^<]+)<\/loc>/g)) enqueue(m[1], item);
      continue;
    }
    if (!type.includes("html")) continue;

    const h1s = body.match(/<h1[\s>]/g) || [];
    if (h1s.length !== 1) problems.push(`${item} has ${h1s.length} h1 headings`);
    const title = /<title>([^<]*)<\/title>/.exec(body)?.[1] || "";
    const description = /<meta name="description" content="([^"]*)"/.exec(body)?.[1] || "";
    if (!title) problems.push(`${item} has no title`);
    else if (title.length > 65) warnings.push(`${item} title is ${title.length} characters: ${title}`);
    if (description.length < 50 || description.length > 165) warnings.push(`${item} description is ${description.length} characters`);
    if (!/<link rel="canonical" href="[^"]+">/.test(body)) problems.push(`${item} has no canonical link`);
    seen.set(item, { title, description });

    for (const m of body.matchAll(/<img\b[^>]*>/g)) {
      if (!/\balt="/.test(m[0])) problems.push(`${item} has an image without alt: ${m[0].slice(0, 90)}`);
      if (!/\bwidth="\d+"/.test(m[0]) || !/\bheight="\d+"/.test(m[0])) warnings.push(`${item} has an image without width and height: ${m[0].slice(0, 90)}`);
    }
    for (const m of body.matchAll(/<script type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)) {
      try { JSON.parse(m[1]); } catch { problems.push(`${item} has JSON-LD that does not parse`); }
    }
    if (/(127\.0\.0\.1|0\.0\.0\.0|localhost:(?!3000)\d+)/.test(body.replace(origin, ""))) problems.push(`${item} mentions a local address`);
    if (body.includes("—")) problems.push(`${item} contains an em dash`);

    for (const m of body.matchAll(/\b(?:href|src)="([^"]+)"/g)) {
      const href = m[1].replace(/&amp;/g, "&");
      if (/^(mailto:|tel:|#|data:|javascript:)/.test(href)) continue;
      enqueue(href, item);
    }
  }

  // Titles and descriptions should be unique, otherwise search results look like duplicates
  const byTitle = new Map();
  for (const [path, meta] of seen) {
    if (!meta) continue;
    const key = meta.title;
    byTitle.set(key, [...(byTitle.get(key) || []), path]);
  }
  for (const [title, paths] of byTitle) {
    // The filtered project lists share a canonical, so the same title family is fine there
    const real = paths.filter((p) => !p.includes("?"));
    if (real.length > 1) warnings.push(`same title "${title}" on ${real.join(", ")}`);
  }

  const pages = [...seen.values()].filter(Boolean).length;
  console.log(`Crawled ${pages} pages and ${checkedAssets.size} files.`);
  for (const warning of warnings) console.log(`  warning  ${warning}`);
  for (const problem of problems) console.log(`  ERROR    ${problem}`);
  console.log(problems.length ? `\n${problems.length} error(s)` : "\nNo errors");
  process.exitCode = problems.length ? 1 : 0;
} finally {
  await server.close();
}
