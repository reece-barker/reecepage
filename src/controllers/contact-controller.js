// The contact page, sending the form, and the thank you page
import { createFormToken } from "../utils/form-token.js";

const FIELD_ORDER = ["name", "email", "topic", "message"];

/**
 * @param {object} deps
 * @param {import("../services/contact-service.js").ContactService} deps.contact
 * @param {import("../services/seo-service.js").SeoService} deps.seo
 * @param {object} deps.config
 */
export function createContactController({ contact, seo, config }) {
  const meta = () => seo.build({
    title: "Contact",
    description: "Contact Reece Barker about internships, projects, the startup or anything else. Send a message here or write to me@reece.page.",
    path: "/contact",
    breadcrumbs: [{ label: "Contact", href: "/contact" }]
  });

  function renderForm(res, { values = {}, errors = {}, notice = null, status = 200 } = {}) {
    // The error summary lists problems in the same order as the fields on the page
    const errorList = FIELD_ORDER.filter((field) => errors[field]).map((field) => ({ field, message: errors[field] }));
    res.status(status).render("pages/contact", {
      meta: meta(),
      bodyClass: "page-contact",
      formAvailable: contact.available,
      formToken: createFormToken(config.appSecret),
      topics: contact.topics.map((topic) => ({ value: topic, selected: topic === values.topic })),
      values,
      errors,
      errorList,
      notice,
      retentionDays: config.contact.retention_days
    });
  }

  return {
    show(req, res) {
      renderForm(res);
    },

    async submit(req, res) {
      if (!contact.available) return renderForm(res, { status: 503, notice: "failed" });
      const result = await contact.submit({ body: req.body || {}, ip: req.ip });

      switch (result.status) {
        case "sent":
        case "duplicate":
        case "spam":
          // 303 so a refresh on the next page does not post the form again
          return res.redirect(303, "/contact/thank-you");
        case "invalid":
          return renderForm(res, { status: 422, values: result.values, errors: result.errors });
        case "resubmit":
          return renderForm(res, { status: 422, values: result.values, errors: result.errors, notice: "resubmit" });
        default:
          return renderForm(res, { status: 503, values: result.values, notice: "failed" });
      }
    },

    thankYou(req, res) {
      res.render("pages/thank-you", {
        meta: seo.build({ title: "Message sent", description: "Your message was sent to Reece.", path: "/contact/thank-you", noindex: true }),
        bodyClass: "page-thank-you"
      });
    }
  };
}
