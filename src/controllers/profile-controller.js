// /cv and /lebenslauf (the CV in English and German, and their PDFs), /references and /status
import { germanWhen } from "../services/localise.js";
import path from "node:path";
import { notFound } from "../middleware/errors.js";
import { formatLongDate } from "../utils/dates.js";
import { CV_VERSIONS, findCvPdf } from "../services/cv-pdf.js";

export const CV_PDF_NAME = CV_VERSIONS.en.file;

// The fixed words on the CV, everything else comes from the content. German follows the usual Lebenslauf headings
const LABELS = {
  en: {
    title: "CV", profile: "Profile", education: "Education", projects: "Projects", experience: "Experience",
    skills: "Skills and languages", languages: "Languages", also: "Also", more: "Languages and more", interests: "Interests", references: "References",
    onRequest: "Available on request.", contactOnRequest: "Contact details on request.", download: "Download as PDF",
    pdfMade: "PDF made", photoAlt: "Photo of Reece Barker", other: { lang: "de", href: "/lebenslauf", label: "Auf Deutsch" },
    description: (name) => `The CV of ${name}: Applied Computer Science at Saxion, projects, work, skills and languages, also as a PDF.`
  },
  de: {
    title: "Lebenslauf", profile: "Kurzprofil", education: "Ausbildung", projects: "Projekte", experience: "Berufserfahrung",
    skills: "Kenntnisse und Sprachen", languages: "Sprachen", also: "Sonstiges", more: "Sprachen und Weiteres", interests: "Interessen", references: "Referenzen",
    onRequest: "Auf Anfrage.", contactOnRequest: "Kontaktdaten auf Anfrage.", download: "Als PDF herunterladen",
    pdfMade: "PDF erstellt am", photoAlt: "Foto von Reece Barker", other: { lang: "en", href: "/cv", label: "In English" },
    description: (name) => `Der Lebenslauf von ${name}: Technische Informatik an der Saxion, Projekte, Berufserfahrung, Kenntnisse und Sprachen, auch als PDF.`
  }
};

/** When in German if nobody wrote one: Since 09/2024 becomes Seit 09/2024, 06/2024 to 07/2026 becomes 06/2024 bis 07/2026 */
export { germanWhen };

/**
 * @param {object} deps
 * @param {import("../services/content-service.js").ContentService} deps.content
 * @param {import("../services/seo-service.js").SeoService} deps.seo
 * @param {object} deps.config
 * @param {ReturnType<import("../services/status-service.js").createStatusService>} deps.status
 */
export function createProfileController({ content, seo, config, status }) {
  // The committed PDFs (made on a computer) and the ones the admin makes on the server, the newer one wins
  const pdfDirs = [path.join(config.paths.content, "cv"), config.paths.cvPdfs].filter(Boolean);

  /** References that may be shown publicly: the person agreed to the quote */
  function publicReferences() {
    return (content.data("references") || []).filter((ref) => ref && ref.permission === true && ref.quote);
  }

  /** Everything the CV needs in one language, also used by the PDF script */
  function cvData(lang = "en") {
    const de = lang === "de";
    const cv = content.data("cv") || {};
    const local = de ? cv.de || {} : {};
    const pick = (value, german) => (de && german ? german : value);
    const entry = (item) => ({
      ...item,
      when: de ? item.de?.when || germanWhen(item.when) : item.when,
      title: pick(item.title, item.de?.title),
      place: pick(item.place, item.de?.place),
      text: pick(item.text, item.de?.text),
      // Short points written for the CV, the longer text is for the about page
      points: de && item.de?.cv_points?.length ? item.de.cv_points : item.cv_points || []
    });
    const timeline = (content.data("timeline") || []).filter((item) => item.cv !== false && !item.planned).map(entry);
    // A project on the CV can be a plain address or one with its own CV line. Projects without a page of their own
    // (like Bronkhorst) count too, they are just not linked
    const projects = (cv.projects || []).map((ref) => {
      const item = typeof ref === "string" ? { slug: ref } : ref || {};
      const project = content.state.projects.find((p) => p.slug === item.slug);
      if (!project) return null;
      return {
        // An English title of its own is optional, otherwise the project's title is used
        title: pick(item.title || project.title, item.de?.title),
        url: project.hasPage ? project.url : null,
        period: de ? germanWhen(project.period) : project.period,
        text: pick(item.text || project.summary, item.de?.text)
      };
    }).filter(Boolean);
    const referees = (content.data("references") || []).filter((ref) => ref && ref.on_cv);
    return {
      lang,
      labels: LABELS[lang],
      cv: {
        headline: pick(cv.headline, local.headline),
        profile: pick(cv.profile, local.profile),
        location: pick(cv.location, local.location),
        availability: pick(cv.availability, local.availability),
        extras: de && local.extras?.length ? local.extras : cv.extras || [],
        interests: pick(cv.interests, local.interests),
        languages: (cv.languages || []).map((l) => ({ name: pick(l.name, l.de?.name), level: pick(l.level, l.de?.level) }))
      },
      photo: cv.photo ? { webp: "images/cv/reece-barker.webp", jpg: "images/cv/reece-barker.jpg" } : null,
      work: timeline.filter((item) => item.kind === "work"),
      education: timeline.filter((item) => item.kind === "education"),
      projects,
      // languages have their own box on the cv with levels, so the skills group of the same name is left out
      skills: (content.data("skills") || []).filter((group) => !/^languages?$/i.test(group.group)).map((group) => ({
        group: pick(group.group, group.group_de),
        items: (group.items || []).map((item) => ({ name: pick(item.name, item.name_de) }))
      })),
      referees,
      allContactsPublic: referees.every((ref) => ref.contact_public),
      phone: cv.show_phone && config.legal.owner.show_phone ? config.legal.owner.phone : ""
    };
  }

  function renderCv(lang) {
    return async (req, res) => {
      const version = CV_VERSIONS[lang];
      const data = cvData(lang);
      const pdf = await findCvPdf(pdfDirs, lang);
      res.render("pages/cv", {
        meta: seo.build({
          title: data.labels.title,
          description: data.labels.description(config.site.legal_name),
          path: version.path,
          language: lang,
          lang: lang === "de" ? "de-DE" : "en-GB",
          locale: lang === "de" ? "de_DE" : undefined,
          alternates: [{ lang: "en", path: CV_VERSIONS.en.path }, { lang: "de", path: CV_VERSIONS.de.path }],
          breadcrumbs: [{ label: data.labels.title, href: version.path }]
        }),
        bodyClass: "page-cv",
        pdf: pdf ? { href: `/cv/${version.file}`, date: pdf.date } : null,
        ...data
      });
    };
  }

  function sendPdf(lang) {
    return async (req, res, next) => {
      const pdf = await findCvPdf(pdfDirs, lang);
      if (!pdf) return next(notFound());
      res.download(pdf.file, pdf.name, { headers: { "Cache-Control": "public, max-age=3600" } });
    };
  }

  return {
    cv: renderCv("en"),
    lebenslauf: renderCv("de"),
    cvPdf: sendPdf("en"),
    lebenslaufPdf: sendPdf("de"),
    cvData,

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
    }
  };
}
