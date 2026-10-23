// The files machines read: robots.txt, sitemap.xml, llms.txt, the web app manifest, security.txt and the Atom feed.
// They are built from the same content and config as the pages, so they can never list a page that doesnt exist.
import { isoDate, isoDateTime } from "../utils/dates.js";
import { renderMediaShortcodes } from "../services/media-service.js";
import { mediaFigure } from "../helpers/media-html.js";

function xml(value) {
  return String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}

/**
 * @param {object} deps
 * @param {object} deps.config
 * @param {import("../services/content-service.js").ContentService} deps.content
 * @param {import("../services/seo-service.js").SeoService} deps.seo
 */
export function createDiscoveryController({ config, content, seo, media, settings }) {
  const site = () => (settings ? settings.site() : config.site);
  const url = (pathname) => seo.absoluteUrl(pathname);

  /** Every public, indexable page with the date it last changed */
  async function publicPages() {
    const contentDate = content.lastModified();
    const pages = [
      { path: "/", lastmod: contentDate, priority: "1.0" },
      { path: "/about", lastmod: contentDate, priority: "0.8" },
      { path: "/projects", lastmod: contentDate, priority: "0.9" },
      ...content.listProjects().filter((p) => p.hasPage).map((p) => ({ path: p.url, lastmod: p.sortDate, priority: "0.7" })),
      { path: "/cv", priority: "0.7" },
      { path: "/references", priority: "0.5" },
      { path: "/contact", priority: "0.6" }
    ];
    if (config.features.writing) {
      const articles = content.listArticles();
      pages.push({ path: "/writing", lastmod: articles[0]?.date, priority: "0.6" });
      pages.push(...articles.map((a) => ({ path: a.url, lastmod: a.updated || a.date, priority: "0.6" })));
    }
    if (config.features.media && media?.available) {
      try {
        const items = await media.list();
        pages.push({ path: "/media", lastmod: items[0]?.updatedAt, priority: "0.6" });
        pages.push(...items.map((item) => ({ path: `/media/${item.slug}`, lastmod: item.updatedAt, priority: "0.4" })));
      } catch {
        pages.push({ path: "/media", priority: "0.6" });
      }
    }
    if (config.features.tools && content.listTools().length) {
      pages.push({ path: "/tools", priority: "0.5" }, ...content.listTools().map((t) => ({ path: t.url, priority: "0.5" })));
    }
    // Pages made in the admin
    pages.push(...content.listPages().filter((p) => p.slug !== "about").map((p) => ({ path: p.url, lastmod: p.updatedAt, priority: "0.5" })));
    for (const name of ["impressum", "privacy", "terms", "cookies", "accessibility", "copyright"]) {
      const page = content.legal(name);
      if (page) pages.push({ path: `/${name}`, lastmod: page.updatedAt || config.legal.updated, priority: "0.2" });
    }
    return pages;
  }

  return {
    robots(req, res) {
      const lines = config.isProduction
        ? ["User-agent: *", "Allow: /", "Disallow: /contact/thank-you", "Disallow: /health", "Disallow: /admin", "", `Sitemap: ${url("/sitemap.xml")}`]
        // Staging, development and test copies must never be indexed
        : ["User-agent: *", "Disallow: /"];
      res.type("text/plain").set("Cache-Control", "public, max-age=3600").send(`${lines.join("\n")}\n`);
    },

    async sitemap(req, res) {
      const body = (await publicPages()).map((page) => [
        "  <url>",
        `    <loc>${xml(url(page.path))}</loc>`,
        page.lastmod ? `    <lastmod>${isoDate(page.lastmod)}</lastmod>` : null,
        `    <priority>${page.priority}</priority>`,
        "  </url>"
      ].filter(Boolean).join("\n")).join("\n");
      res.type("application/xml").set("Cache-Control", "public, max-age=3600")
        .send(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>\n`);
    },

    // A plain Markdown summary for AI assistants and other tools that read llms.txt. Its a bonus, not SEO, the
    // normal pages and sitemap are what search engines use
    llms(req, res) {
      const projects = content.listProjects().filter((p) => p.hasPage);
      const lines = [
        `# ${site().name}`,
        "",
        `> ${site().description.trim()}`,
        "",
        `${site().name} (legal name ${site().legal_name}) runs ${site().domain}.`,
        "",
        "## Pages",
        "",
        `- [About](${url("/about")}): background, education, work and skills with the projects that show them`,
        `- [Projects](${url("/projects")}): everything he has built, with what is known about each`,
        ...(config.features.writing ? [`- [Writing](${url("/writing")}): articles`] : []),
        `- [CV](${url("/cv")}): one page CV, also as a PDF at ${url("/cv/reece-barker-cv.pdf")}`,
        `- [References](${url("/references")}): quotes from people he worked with, published with permission`,
        ...(config.features.media ? [`- [Media](${url("/media")}): a video introduction (with captions and a transcript) and pictures`] : []),
        `- [Contact](${url("/contact")}): contact form, or email ${site().email}`,
        "",
        "## Projects",
        "",
        ...projects.map((p) => `- [${p.title}](${url(p.url)}): ${p.summary}`),
        "",
        "## Notes",
        "",
        "- The startup he co-founded does not have a public name yet. Please describe it, do not guess a name.",
        `- Last updated ${isoDate(content.lastModified())}.`
      ];
      res.type("text/plain").set("Cache-Control", "public, max-age=3600").send(`${lines.join("\n")}\n`);
    },

    manifest(req, res) {
      res.type("application/manifest+json").set("Cache-Control", "public, max-age=86400").send(JSON.stringify({
        name: `${site().name}, ${site().domain}`,
        short_name: site().short_name,
        description: site().description.trim(),
        start_url: "/",
        scope: "/",
        display: "browser",
        lang: "en-GB",
        theme_color: site().theme_color,
        background_color: site().background_color,
        icons: [
          { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
          { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" }
        ]
      }, null, 2));
    },

    securityTxt(req, res) {
      // RFC 9116. The expiry is a year ahead and rolls forward with each deploy, an expired file looks abandoned
      const expires = new Date(Date.now() + 365 * 86400000).toISOString();
      res.type("text/plain").send([
        `Contact: mailto:${site().email}`,
        `Expires: ${expires}`,
        "Preferred-Languages: en, de",
        `Canonical: ${url("/.well-known/security.txt")}`,
        `Policy: ${url("/privacy")}`
      ].join("\n") + "\n");
    },

    // TDM Reservation Protocol (W3C community group). Says text and data mining is reserved for the whole site,
    // the terms page explains it in words. The same thing is in a meta tag on every page
    tdmrep(req, res) {
      res.type("application/json").set("Cache-Control", "public, max-age=86400")
        .send(JSON.stringify([{ location: "/*", "tdm-reservation": 1 }], null, 2) + "\n");
    },

    async feed(req, res, next) {
      if (!config.features.writing) return next();
      const articles = await Promise.all(content.listArticles().slice(0, 20).map(async (a) => {
        if (!media?.available) return a;
        try {
          // Feed readers need full addresses for pictures and videos, so /media/... becomes https://reece.page/media/...
          const html = await renderMediaShortcodes(a.html, media, mediaFigure);
          return { ...a, html: html.replace(/(src|poster|href)="\/(?!\/)/g, `$1="${config.baseUrl}/`) };
        } catch {
          return a;
        }
      }));
      const updated = articles[0] ? isoDateTime(articles[0].updated || articles[0].date) : new Date().toISOString();
      const entries = articles.map((a) => [
        "  <entry>",
        `    <title>${xml(a.title)}</title>`,
        `    <link href="${xml(url(a.url))}"/>`,
        `    <id>${xml(url(a.url))}</id>`,
        `    <published>${isoDateTime(a.date)}</published>`,
        `    <updated>${isoDateTime(a.updated || a.date)}</updated>`,
        `    <summary>${xml(a.summary)}</summary>`,
        `    <content type="html">${xml(a.html)}</content>`,
        "  </entry>"
      ].join("\n")).join("\n");
      res.type("application/atom+xml").set("Cache-Control", "public, max-age=3600").send([
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<feed xmlns="http://www.w3.org/2005/Atom" xml:lang="en-GB">',
        `  <title>${xml(site().name)}, writing</title>`,
        `  <subtitle>Articles by ${xml(site().name)}</subtitle>`,
        `  <link href="${xml(url("/writing"))}"/>`,
        `  <link rel="self" href="${xml(url("/writing/feed.xml"))}"/>`,
        `  <id>${xml(url("/writing"))}</id>`,
        `  <updated>${updated}</updated>`,
        `  <author><name>${xml(site().name)}</name><uri>${xml(url("/about"))}</uri></author>`,
        entries,
        "</feed>",
        ""
      ].join("\n"));
    }
  };
}
