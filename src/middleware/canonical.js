// Makes sure every page has exactly one address: https, the real domain, no trailing slash, and old paths sent on to
// their new home. Duplicate addresses split search ranking and confuse analytics, so they all get a 301.

const SKIP = /^\/(health|assets|icons)(\/|$)/;

export function canonicalRedirects(config) {
  const base = new URL(config.baseUrl);
  const redirects = config.redirects || {};

  return (req, res, next) => {
    if (req.method !== "GET" && req.method !== "HEAD") return next();
    if (SKIP.test(req.path)) return next();

    const query = req.originalUrl.slice(req.path.length);

    // In production: wrong host (www., an ip, an old domain) or plain http goes to https://reece.page
    if (config.isProduction) {
      const wrongHost = req.hostname && req.hostname !== base.hostname;
      const insecure = !req.secure && base.protocol === "https:";
      if (wrongHost || insecure) return res.redirect(301, `${base.origin}${req.path}${query}`);
    }

    // /projects/ -> /projects (but leave "/" alone)
    if (req.path.length > 1 && req.path.endsWith("/")) {
      // Leading slashes are collapsed too: "//evil.example/" must never turn into a redirect to another site
      const trimmed = `/${req.path.replace(/^\/+/, "").replace(/\/+$/, "")}`;
      // Straight to the final address when the trimmed one has moved, one hop instead of two (and /admin/media/
      // from nginx doesnt bounce back to /admin/media and loop)
      const moved = redirects[trimmed.toLowerCase()];
      return res.redirect(301, moved || `${trimmed}${query}`);
    }

    const target = redirects[req.path.toLowerCase()];
    if (target) return res.redirect(301, target);

    next();
  };
}

/** Outside production every response says noindex, so a staging copy never ends up in search results */
export function noIndexOutsideProduction(config) {
  return (req, res, next) => {
    if (!config.isProduction) res.setHeader("X-Robots-Tag", "noindex, nofollow");
    next();
  };
}
