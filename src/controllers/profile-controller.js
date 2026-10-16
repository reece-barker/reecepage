// /cv (the one page CV and its PDF), /references and /status
import { stat } from "node:fs/promises";
import path from "node:path";
import { notFound } from "../middleware/errors.js";
import { formatLongDate } from "../utils/dates.js";

export const CV_PDF_NAME = "reece-barker-cv.pdf";

/**
 * @param {object} deps
 * @param {import("../services/content-service.js").ContentService} deps.content
 * @param {import("../services/seo-service.js").SeoService} deps.seo
 * @param {object} deps.config
 * @param {ReturnType<import("../services/status-service.js").createStatusService>} deps.status
 */
export function createProfileController({ content, seo, config, status }) {
  const pdfPath = path.join(config.paths.content, "cv", CV_PDF_NAME);

  /** References that may be shown publicly: the person agreed to the quote */
  function publicReferences() {
    return (content.data("references") || []).filter((ref) => ref && ref.permission === true && ref.quote);
  }

  /** Everything the CV needs, also used by the PDF script */
  function cvData() {
    const cv = content.data("cv") || {};
    const timeline = (content.data("timeline") || []).filter((item) => item.cv !== false && !item.planned);
    const projects = (cv.projects || []).map((slug) => content.getProject(slug)).filter(Boolean);
    const referees = (content.data("references") || []).filter((ref) => ref && ref.on_cv);
    return {
      cv,
      work: timeline.filter((item) => item.kind === "work"),
      education: timeline.filter((item) => item.kind === "education"),
      projects,
      // languages have their own box on the cv with levels, so the skills group of the same name is left out
      skills: (content.data("skills") || []).filter((group) => !/^languages?$/i.test(group.group)),
      referees,
      allContactsPublic: referees.every((ref) => ref.contact_public),
      phone: cv.show_phone && config.legal.owner.show_phone ? config.legal.owner.phone : ""
    };
  }

  return {
    async cv(req, res) {
      const pdf = await stat(pdfPath).then((info) => ({ date: info.mtime }), () => null);
      res.render("pages/cv", {
        meta: seo.build({
          title: "CV",
          description: `The CV of ${config.site.legal_name}: Applied Computer Science at Saxion, work, projects, skills and languages on one page, also as a PDF.`,
          path: "/cv",
          breadcrumbs: [{ label: "CV", href: "/cv" }]
        }),
        bodyClass: "page-cv",
        pdf,
        ...cvData()
      });
    },

    async cvPdf(req, res, next) {
      try {
        await stat(pdfPath);
      } catch {
        return next(notFound());
      }
      res.download(pdfPath, CV_PDF_NAME, { headers: { "Cache-Control": "public, max-age=3600" } });
    },

    references(req, res) {
      const references = publicReferences();
      res.render("pages/references", {
        meta: seo.build({
          title: "References",
          description: "What employers, teachers and partners who worked with Reece Barker say about him, published with their permission.",
          path: "/references",
          breadcrumbs: [{ label: "References", href: "/references" }]
        }),
        bodyClass: "page-references",
        references
      });
    },

    async status(req, res, next) {
      if (!config.features.status_page) return next(notFound());
      const result = await status.run();
      res.set("Cache-Control", "no-store");
      res.status(result.overall.state === "down" ? 503 : 200).render("pages/status", {
        meta: seo.build({ title: "Status", description: "Live checks of the reece.page website, its database, the contact form and the media library.", path: "/status", breadcrumbs: [{ label: "Status", href: "/status" }] }),
        bodyClass: "page-status",
        ...result,
        checkedAt: `${formatLongDate(result.checkedAt)}, ${result.checkedAt.toISOString().slice(11, 16)} UTC`,
        startedAt: `${formatLongDate(result.startedAt)}, ${result.startedAt.toISOString().slice(11, 16)} UTC`
      });
    },

    cvData
  };
}
