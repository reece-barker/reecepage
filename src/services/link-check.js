// Internal links between pages, so nothing on the site points at a page that isnt there. Used three ways:
//
//   npm run content:check   fails on a broken link before it ever gets deployed
//   the admin dashboard     lists broken links on the live site, from a page being trashed or unpublished
//   the admin trash button  says which pages still link to something before it goes
//
// Bronkhorst is why this exists: the project was deleted in the admin and About kept linking to it for weeks.

// Addresses the site always has, whatever is in the content
const FIXED = ["/", "/about", "/projects", "/writing", "/tools", "/media", "/cv", "/references", "/contact", "/status",
  "/writing/feed.xml", "/sitemap.xml", "/contact/thank-you"];
// Anything under these is a file or a media item, not content this check knows about
const PREFIXES = ["/assets/", "/media/", "/cv/", "/admin"];

/** Every address a link may point at right now */
export function knownPaths(content, { legalLinks = [] } = {}) {
  const state = content.state;
  return new Set([
    ...FIXED,
    ...legalLinks,
    ...Object.keys(state.legal || {}).map((slug) => `/${slug}`),
    ...state.projects.filter((p) => p.hasPage).map((p) => p.url),
    ...state.writing.map((a) => a.url),
    ...state.tools.map((t) => t.url),
    ...Object.values(state.pages).map((p) => p.url || `/${p.slug}`)
  ]);
}

function normalise(href) {
  const target = href.split(/[?#]/)[0].replace(/\/$/, "");
  return target || "/";
}

/** Every internal link in the live content, with the page it is on */
export function internalLinks(content) {
  const state = content.state;
  const docs = [...state.projects, ...state.writing, ...state.tools, ...Object.values(state.pages)];
  const links = [];
  for (const doc of docs) {
    const from = { title: doc.title, url: doc.url || `/${doc.slug}`, type: doc.type || "page", slug: doc.slug };
    const seen = new Set();
    const add = (href) => {
      if (typeof href !== "string" || !href.startsWith("/") || href.startsWith("//")) return;
      const to = normalise(href);
      if (seen.has(to)) return;
      seen.add(to);
      links.push({ from, to });
    };
    for (const match of String(doc.html || "").matchAll(/href="(\/[^"]*)"/g)) add(match[1]);
    for (const link of doc.links || []) add(link.url || link.href);
  }
  return links;
}

/** Links that go nowhere */
export function brokenLinks(content, options = {}) {
  const known = knownPaths(content, options);
  return internalLinks(content).filter((link) => !known.has(link.to) && !PREFIXES.some((prefix) => link.to.startsWith(prefix)));
}

/** The pages that link to an address, for the warning before something is trashed or unpublished */
export function linksTo(content, url) {
  const target = normalise(url);
  return internalLinks(content).filter((link) => link.to === target && link.from.url !== target).map((link) => link.from);
}
