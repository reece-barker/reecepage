// The contact page, sending the form, and the thank you page
import { createFormToken } from "../utils/form-token.js";
import { localePath, translator } from "../lib/i18n.js";

const FIELD_ORDER = ["name", "email", "topic", "message"];

/**
 * @param {object} deps
 * @param {import("../services/contact-service.js").ContactService} deps.contact
 * @param {import("../services/seo-service.js").SeoService} deps.seo
 * @param {object} deps.config
 */
export function createContactController({ contact, seo, config }) {
  const meta = (lang) => {
    const t = translator(lang);
    return seo.build({
      title: t("contact.title"),
      description: t("contact.description"),
      path: "/contact",
      language: lang,
      breadcrumbs: [{ label: t("contact.title"), href: "/contact" }]
    });
  };

  function renderForm(req, res, { values = {}, errors = {}, notice = null, status = 200 } = {}) {
    const lang = req.lang || "en";
    const t = translator(lang);
    // The error summary lists problems in the same order as the fields on the page
    const errorList = FIELD_ORDER.filter((field) => errors[field]).map((field) => ({ field, message: errors[field] }));
    res.status(status).render("pages/contact", {
      meta: meta(lang),
      bodyClass: "page-contact",
      formAvailable: contact.available,
      formToken: createFormToken(config.appSecret),
      // The value that gets sent (and stored) stays the english text and only what the person reads is in there language
      topics: contact.topics.map((topic) => ({ value: topic, label: t.has(`contact.topics.${topic}`) ? t(`contact.topics.${topic}`) : topic, selected: topic === values.topic })),
      values,
      errors,
      errorList,
      notice,
      retentionDays: config.contact.retention_days
    });
  }

  return {
    show(req, res) {
      renderForm(req, res);
    },

    async submit(req, res) {
      if (!contact.available) return renderForm(req, res, { status: 503, notice: "failed" });
      const result = await contact.submit({ body: req.body || {}, ip: req.ip, lang: req.lang || "en" });

      switch (result.status) {
        case "sent":
        case "duplicate":
        case "spam":
          // 303 so a refresh on the next page does not post the form again
          return res.redirect(303, localePath(req.lang || "en", "/contact/thank-you"));
        case "invalid":
          return renderForm(req, res, { status: 422, values: result.values, errors: result.errors });
        case "resubmit":
          return renderForm(req, res, { status: 422, values: result.values, errors: result.errors, notice: "resubmit" });
        default:
          return renderForm(req, res, { status: 503, values: result.values, notice: "failed" });
      }
    },

    thankYou(req, res) {
      const lang = req.lang || "en";
      const t = translator(lang);
      res.render("pages/thank-you", {
        meta: seo.build({ title: t("thanks.title"), description: t("thanks.description"), path: "/contact/thank-you", noindex: true, language: lang }),
        bodyClass: "page-thank-you"
      });
    }
  };
}
