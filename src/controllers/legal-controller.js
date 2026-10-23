// Impressum, privacy, terms, accessibility, copyright and the cookie settings page with its form

const SAFE_RETURN = /^\/[a-z0-9\-/]*$/;

// The page texts are Handlebars templates stored with the rest of the content (content/legal/*.hbs to start with,
// then the database), so they can be edited in the admin. They are compiled once per version and rendered with the
// same helpers and partials as every other page. A template that throws is logged and shows the error page, but
// the admin checks every template before it saves it so that shouldnt happen.
const LEGAL_PAGES = ["impressum", "privacy", "terms", "accessibility", "copyright", "cookies"];

/**
 * @param {object} deps
 * @param {object} deps.config
 * @param {import("../services/seo-service.js").SeoService} deps.seo
 * @param {import("../services/consent-service.js").ConsentService} deps.consent
 * @param {import("../services/content-service.js").ContentService} deps.content
 * @param {import("../services/legal-templates.js").LegalTemplates} deps.templates
 */
export function createLegalController({ config, seo, consent, content, templates }) {
  /** The legal facts from the config, with the "last updated" date from the admin's settings when one is set there */
  function legalFacts() {
    const updated = content.data("settings")?.legal_updated;
    return updated ? { ...config.legal, updated } : config.legal;
  }

  /** What every legal template can use, on top of the usual locals (site, csrfToken and so on) */
  function templateData(name, req) {
    return {
      legal: legalFacts(),
      contactConfig: config.contact,
      mailConfigured: config.contact.send_notifications,
      analyticsProvider: config.features.analytics ? config.analytics.provider : "none",
      consentCookieName: config.consent.cookie_name,
      consentDays: config.consent.max_age_days,
      saved: name === "cookies" && req.query.saved === "1"
    };
  }

  async function renderLegal(req, res, page, { preview = false } = {}) {
    const name = page.slug;
    const meta = seo.build({ title: page.title, description: page.description, path: `/${name}`, noindex: preview, breadcrumbs: [{ label: name === "cookies" ? "Cookies" : page.title, href: `/${name}` }] });
    const html = await templates.render(page.template, { ...res.locals, ...templateData(name, req), meta });
    res.render("pages/legal", { meta, bodyClass: `page-legal${name === "cookies" ? " page-cookies" : ""}`, legalHtml: html });
  }

  function legalPage(name) {
    return async (req, res, next) => {
      const page = content.legal(name);
      if (!page) return next();
      try { await renderLegal(req, res, page); } catch (error) { next(error); }
    };
  }

  return {
    names: LEGAL_PAGES,
    templateData,
    renderPreview: (req, res, page) => renderLegal(req, res, page, { preview: true }),
    impressum: legalPage("impressum"),
    privacy: legalPage("privacy"),
    terms: legalPage("terms"),
    accessibility: legalPage("accessibility"),
    copyright: legalPage("copyright"),
    cookies: legalPage("cookies"),

    saveCookies(req, res) {
      const choice = String(req.body?.choice || "");
      const analytics = choice === "accept" || (choice === "save" && req.body?.analytics === "yes");
      consent.write(res, { analytics });

      // Called from the banner script, it only needs to know it worked
      if (req.get("x-requested-with") === "fetch") return res.json({ ok: true, analytics });

      const returnTo = typeof req.body?.return_to === "string" && SAFE_RETURN.test(req.body.return_to) ? req.body.return_to : "/cookies";
      res.redirect(303, returnTo === "/cookies" ? "/cookies?saved=1" : returnTo);
    }
  };
}
