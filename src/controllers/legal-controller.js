// Impressum, privacy, terms, accessibility, copyright and the cookie settings page with its form

const SAFE_RETURN = /^\/[a-z0-9\-/]*$/;

const PAGES = {
  impressum: { title: "Impressum", description: "Impressum and legal notice for reece.page under section 5 DDG: who runs this website and how to reach him, in German and English." },
  privacy: { title: "Privacy policy", description: "How reece.page handles personal data: server logs, the contact form, cookies and your rights under the GDPR, in English and German." },
  terms: { title: "Terms of use", description: "The terms for using reece.page, its content and its contact form." },
  accessibility: { title: "Accessibility", description: "How accessible reece.page is, what is known not to work yet and how to report a problem." },
  copyright: { title: "Copyright and trademarks", description: "Who owns the text, images, code and dove brand on reece.page, and the licences of the fonts and libraries it uses." }
};

/**
 * @param {object} deps
 * @param {object} deps.config
 * @param {import("../services/seo-service.js").SeoService} deps.seo
 * @param {import("../services/consent-service.js").ConsentService} deps.consent
 */
export function createLegalController({ config, seo, consent }) {
  const legal = config.legal;

  function legalPage(name) {
    const page = PAGES[name];
    return (req, res) => {
      res.render(`pages/legal/${name}`, {
        meta: seo.build({ title: page.title, description: page.description, path: `/${name}`, breadcrumbs: [{ label: page.title, href: `/${name}` }] }),
        bodyClass: "page-legal",
        legal,
        contactConfig: config.contact,
        mailConfigured: config.contact.send_notifications,
        analyticsProvider: config.features.analytics ? config.analytics.provider : "none"
      });
    };
  }

  return {
    impressum: legalPage("impressum"),
    privacy: legalPage("privacy"),
    terms: legalPage("terms"),
    accessibility: legalPage("accessibility"),
    copyright: legalPage("copyright"),

    cookies(req, res) {
      res.render("pages/legal/cookies", {
        meta: seo.build({
          title: "Cookies and settings",
          description: "Which cookies reece.page sets, why, and the settings for optional services such as analytics.",
          path: "/cookies",
          breadcrumbs: [{ label: "Cookies", href: "/cookies" }]
        }),
        bodyClass: "page-legal page-cookies",
        legal,
        consentCookieName: config.consent.cookie_name,
        consentDays: config.consent.max_age_days,
        analyticsProvider: config.features.analytics ? config.analytics.provider : "none",
        saved: req.query.saved === "1"
      });
    },

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
