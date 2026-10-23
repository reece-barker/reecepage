// Every public url in one file, so its easy to see what the site has
import { Router } from "express";

/**
 * @param {object} c controllers
 * @param {object} m route level middleware ({ csrf, contactLimit })
 */
export function createRouter(c, m) {
  const router = Router();
  // Ids in admin addresses are always numbers (Express 5 has no regex params), anything else isnt one of these routes
  for (const name of ["id", "rev"]) {
    router.param(name, (req, res, next, value) => (/^\d{1,10}$/.test(String(value)) ? next() : next("route")));
  }

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

  // Admin. Signing in first: these are the only admin addresses that work without a session
  const a = c.admin;
  const auth = c.auth;
  const signIn = [m.adminHeaders, m.signInLimit];
  router.get("/admin/login", m.adminHeaders, m.csrf.provideToken, auth.login);
  router.post("/admin/login/simplelogin", ...signIn, m.csrf.protect, m.csrf.provideToken, auth.startSimpleLogin);
  router.get("/admin/login/simplelogin/callback", ...signIn, m.csrf.provideToken, auth.simpleLoginCallback);
  router.post("/admin/login/passkey/options", ...signIn, m.adminJson, m.csrf.protect, auth.passkeyOptions);
  router.post("/admin/login/passkey", ...signIn, m.adminJson, m.csrf.protect, auth.passkeySignIn);
  router.post("/admin/login/dev", ...signIn, m.csrf.protect, auth.devSignIn);

  // Everything else needs a session. CSRF on everything that changes something
  const admin = [m.adminHeaders, m.requireAdmin];
  const page = [...admin, m.csrf.provideToken];
  const json = [...admin, m.adminJson, m.csrf.protect];
  const form = [...admin, m.csrf.protect];
  router.post("/admin/logout", ...form, auth.logout);
  router.get("/admin", ...page, a.dashboard);
  router.get("/admin/account", ...page, auth.account);
  router.post("/admin/account/passkeys/options", ...json, auth.passkeyAddOptions);
  router.post("/admin/account/passkeys", ...json, auth.passkeyAdd);
  router.post("/admin/account/passkeys/:key/rename", ...form, auth.passkeyRename);
  router.post("/admin/account/passkeys/:key/remove", ...form, auth.passkeyRemove);
  router.post("/admin/account/sessions/others", ...form, auth.signOutOthers);

  router.get("/admin/media", ...page, c.media.admin.page);
  router.get("/admin/media/library.json", ...admin, a.mediaLibrary);
  router.put("/admin/media/upload", ...admin, m.csrf.protect, c.media.admin.upload);
  router.put("/admin/media/:id/captions", ...admin, m.csrf.protect, c.media.admin.captions);
  router.put("/admin/media/:id/poster", ...admin, m.csrf.protect, c.media.admin.poster);
  router.put("/admin/media/:id/variant", ...admin, m.csrf.protect, c.media.admin.variant);
  router.post("/admin/media/:id", ...form, m.csrf.provideToken, c.media.admin.update);
  router.post("/admin/media/:id/delete", ...form, c.media.admin.remove);

  router.post("/admin/preview", ...json, a.createPreview);
  router.get("/admin/preview/:key", m.adminHeaders, m.requireAdmin, m.csrf.provideToken, a.showPreview);
  router.get("/admin/lists/:name", ...page, a.editList);
  router.post("/admin/lists/:name", ...json, a.saveList);
  router.get("/admin/lists/:name/revisions", ...page, a.listRevisions);
  router.post("/admin/lists/:name/revisions/:rev/restore", ...form, a.restoreListRevision);
  router.post("/admin/cv-pdf", ...form, a.cvPdf);
  router.get("/admin/sync", ...page, a.syncPage);
  router.post("/admin/sync", ...form, a.syncNow);
  router.get("/admin/system", ...page, a.system);

  // Posts, pages, projects, tools and the legal pages, :type is checked against the schemas in the controller
  router.get("/admin/:type", ...page, a.list);
  router.get("/admin/:type/new", ...page, a.editor);
  router.post("/admin/:type/save", ...json, a.save);
  router.get("/admin/:type/:id", ...page, a.editor);
  router.get("/admin/:type/:id/revisions", ...page, a.revisions);
  router.post("/admin/:type/:id/revisions/:rev/restore", ...form, a.restoreRevision);
  router.post("/admin/:type/:id/trash", ...form, a.trash);
  router.post("/admin/:type/:id/restore", ...form, a.restore);
  router.post("/admin/:type/:id/delete", ...form, a.destroy);

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

  // Pages made in the admin live at /their-address, so this has to come after every other route
  router.get("/:slug", c.pages.page);

  return router;
}
