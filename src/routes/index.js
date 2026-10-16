// Every public url in one file, so its easy to see what the site has
import { Router } from "express";

/**
 * @param {object} c controllers
 * @param {object} m route level middleware ({ csrf, contactLimit })
 */
export function createRouter(c, m) {
  const router = Router();

  router.get("/", c.pages.home);
  router.get("/about", c.pages.about);
  router.get("/projects", c.pages.projects);
  router.get("/projects/:slug", c.pages.project);
  router.get("/writing", c.pages.writing);
  router.get("/writing/feed.xml", c.discovery.feed);
  router.get("/writing/:slug", c.pages.article);
  router.get("/tools", c.pages.tools);
  router.get("/tools/:slug", c.pages.tool);

  router.get("/media", c.media.index);
  router.get("/media/files/:name", c.media.file);
  router.get("/media/:slug", c.media.show);

  router.get("/cv", c.profile.cv);
  router.get("/cv/reece-barker-cv.pdf", c.profile.cvPdf);
  router.get("/references", c.profile.references);
  router.get("/status", c.profile.status);

  // Admin: basic auth first, then CSRF on everything that changes something
  router.get("/admin", m.admin, m.csrf.provideToken, c.admin.hub);
  router.get("/admin/content/:collection", m.admin, m.csrf.provideToken, c.admin.collection);
  router.get("/admin/content/:collection/new", m.admin, m.csrf.provideToken, c.admin.editDoc);
  router.get("/admin/content/:collection/:slug", m.admin, m.csrf.provideToken, c.admin.editDoc);
  router.post("/admin/content/:collection", m.admin, m.adminJson, m.csrf.protect, c.admin.saveDoc);
  router.post("/admin/content/:collection/:slug/delete", m.admin, m.csrf.protect, c.admin.deleteDoc);
  router.get("/admin/data/:name", m.admin, m.csrf.provideToken, c.admin.editData);
  router.post("/admin/data/:name", m.admin, m.adminJson, m.csrf.protect, c.admin.saveData);
  router.post("/admin/preview", m.admin, m.adminJson, m.csrf.protect, c.admin.preview);
  router.post("/admin/cv-pdf", m.admin, m.csrf.protect, c.admin.cvPdf);
  router.get("/admin/media", m.admin, m.csrf.provideToken, c.media.admin.page);
  router.put("/admin/media/upload", m.admin, m.csrf.protect, c.media.admin.upload);
  router.put("/admin/media/:id/captions", m.admin, m.csrf.protect, c.media.admin.captions);
  router.put("/admin/media/:id/poster", m.admin, m.csrf.protect, c.media.admin.poster);
  router.post("/admin/media/:id", m.admin, m.csrf.protect, m.csrf.provideToken, c.media.admin.update);
  router.post("/admin/media/:id/delete", m.admin, m.csrf.protect, c.media.admin.remove);

  router.get("/contact", m.csrf.provideToken, c.contact.show);
  router.post("/contact", m.contactLimit, m.csrf.protect, m.csrf.provideToken, c.contact.submit);
  router.get("/contact/thank-you", c.contact.thankYou);

  router.get("/impressum", c.legal.impressum);
  router.get("/privacy", c.legal.privacy);
  router.get("/terms", c.legal.terms);
  router.get("/accessibility", c.legal.accessibility);
  router.get("/copyright", c.legal.copyright);
  router.get("/cookies", m.csrf.provideToken, c.legal.cookies);
  router.post("/cookies", m.csrf.protect, c.legal.saveCookies);

  router.get("/robots.txt", c.discovery.robots);
  router.get("/sitemap.xml", c.discovery.sitemap);
  router.get("/llms.txt", c.discovery.llms);
  router.get("/site.webmanifest", c.discovery.manifest);
  router.get("/.well-known/security.txt", c.discovery.securityTxt);
  router.get("/.well-known/tdmrep.json", c.discovery.tdmrep);

  router.post("/errors", m.errorReportLimit, m.errorReportBody, c.errorReports.receive);

  router.get("/health", c.health.live);
  router.get("/health/ready", c.health.ready);

  return router;
}
