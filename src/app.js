// Builds the Express app. Nothing in here listens on a port or touches process signals, server.js does that, so the
// tests can create as many apps as they like with their own config, database and fake mail transport.
import path from "node:path";
import express from "express";
import { create as createHandlebars } from "express-handlebars";
import compression from "compression";
import cookieParser from "cookie-parser";
import { pinoHttp } from "pino-http";

import { createLogger } from "./lib/logger.js";
import { createDatabase } from "./database/index.js";
import { ContactMessageRepository } from "./repositories/contact-message-repository.js";
import { AssetManifest } from "./services/asset-manifest.js";
import { ContentService } from "./services/content-service.js";
import { SeoService } from "./services/seo-service.js";
import { ConsentService } from "./services/consent-service.js";
import { MailService } from "./services/mail-service.js";
import { ContactService } from "./services/contact-service.js";
import { MediaService } from "./services/media-service.js";
import { createMediaController } from "./controllers/media-controller.js";
import { adminAuth } from "./middleware/admin-auth.js";
import { ContentEditor } from "./services/content-editor.js";
import { createStatusService } from "./services/status-service.js";
import { createAdminController } from "./controllers/admin-controller.js";
import { createProfileController } from "./controllers/profile-controller.js";
import { createHelpers } from "./helpers/handlebars.js";
import { requestContext } from "./middleware/request-context.js";
import { securityHeaders, permissionsPolicy } from "./middleware/security.js";
import { canonicalRedirects, noIndexOutsideProduction } from "./middleware/canonical.js";
import { precompressedAssets } from "./middleware/precompressed.js";
import { createCsrf } from "./middleware/csrf.js";
import { siteRateLimit, contactRateLimit, errorReportLimit } from "./middleware/rate-limits.js";
import { templateLocals } from "./middleware/locals.js";
import { notFoundHandler, errorHandler } from "./middleware/errors.js";
import { createPagesController } from "./controllers/pages-controller.js";
import { createContactController } from "./controllers/contact-controller.js";
import { createLegalController } from "./controllers/legal-controller.js";
import { createDiscoveryController } from "./controllers/discovery-controller.js";
import { createHealthController } from "./controllers/health-controller.js";
import { createErrorReportController } from "./controllers/error-report-controller.js";
import { createRouter } from "./routes/index.js";
import { createErrorReporter } from "./lib/error-reporter.js";

// Hashed build files never change, so browsers can keep them for a year. Everything else is checked daily
const HASHED_FILE = /\.[0-9a-f]{10}\.\w+$/;

function staticHeaders(res, filePath) {
  if (HASHED_FILE.test(filePath) || filePath.includes(`${path.sep}vendor${path.sep}`)) {
    res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
  } else {
    res.setHeader("Cache-Control", "public, max-age=86400");
  }
}

/**
 * @param {object} options
 * @param {ReturnType<import("./config/index.js").loadConfig>} options.config
 * @param {import("pino").Logger} [options.logger]
 * @param {ReturnType<typeof createDatabase>} [options.database] pass null to run without one, leave out to create from config
 * @param {object} [options.mailTransport] a fake nodemailer transport for tests
 * @returns {{ app: import("express").Express, services: object }}
 */
export function createApp({ config, logger = createLogger(config), database, mailTransport, errorReporter } = {}) {
  const db = database === undefined ? createDatabase(config, logger) : database;

  const assets = new AssetManifest({ file: config.paths.assetManifest, reload: config.isDevelopment });
  const content = new ContentService({ contentDir: config.paths.content, cache: !config.isDevelopment });
  content.load(); // throws on broken front matter, better at startup than on the first visitor
  const seo = new SeoService({ config, assets });
  const consent = new ConsentService({ config });
  const mail = new MailService({ config, logger, transport: mailTransport });
  const repository = db ? new ContactMessageRepository(db.models) : null;
  const contact = new ContactService({ config, logger, repository, mail });
  const csrf = createCsrf(config);
  const editor = new ContentEditor({ contentDir: config.paths.content, content, logger });
  const media = new MediaService({ dir: config.media.dir, models: db?.models, logger, maxImageBytes: config.media.maxImageBytes, maxVideoBytes: config.media.maxVideoBytes });
  const reporter = errorReporter || createErrorReporter({ dsn: config.monitoring?.dsn, environment: config.env, release: config.monitoring?.release, logger });

  const app = express();
  app.disable("x-powered-by");
  app.set("trust proxy", config.trustProxy);
  app.set("env", config.env);

  const hbs = createHandlebars({
    extname: ".hbs",
    defaultLayout: "main",
    layoutsDir: path.join(config.paths.views, "layouts"),
    partialsDir: [path.join(config.paths.views, "partials")],
    helpers: {}
  });
  hbs.helpers = createHelpers({ assets }, hbs.handlebars);
  app.engine(".hbs", hbs.engine);
  app.set("view engine", ".hbs");
  app.set("views", config.paths.views);
  if (config.isProduction) app.enable("view cache");

  app.use(requestContext());
  app.use(pinoHttp({
    logger,
    genReqId: (req) => req.id,
    // Static files and health checks would drown the useful lines
    autoLogging: { ignore: (req) => req.url.startsWith("/assets/") || req.url.startsWith("/health") || req.url.startsWith("/icons/") },
    customLogLevel: (req, res, error) => (error || res.statusCode >= 500 ? "error" : res.statusCode >= 400 ? "warn" : "info"),
    serializers: {
      req: (req) => ({ id: req.id, method: req.method, url: req.url }),
      res: (res) => ({ statusCode: res.statusCode })
    }
  }));
  app.use(securityHeaders(config));
  app.use(permissionsPolicy());
  app.use(noIndexOutsideProduction(config));
  app.use(compression());
  app.use(canonicalRedirects(config));

  app.use(precompressedAssets({ publicDir: config.paths.public }));
  app.use(express.static(config.paths.public, {
    index: false,
    redirect: false,
    dotfiles: "ignore",
    fallthrough: true,
    setHeaders: staticHeaders
  }));

  app.use(siteRateLimit());
  app.use(cookieParser());
  app.use(express.urlencoded({ extended: false, limit: "20kb", parameterLimit: 20 }));
  app.use(templateLocals({ config, consent, csrf }));

  const controllers = {
    pages: createPagesController({ content, seo, config, media }),
    media: createMediaController({ media, seo, config }),
    contact: createContactController({ contact, seo, config }),
    legal: createLegalController({ config, seo, consent }),
    discovery: createDiscoveryController({ config, content, seo, media }),
    health: createHealthController({ database: db, logger }),
    errorReports: createErrorReportController({ reporter, config })
  };
  const status = createStatusService({ config, database: db, mail, reporter, media });
  controllers.profile = createProfileController({ content, seo, config, status });
  controllers.admin = createAdminController({ config, seo, content, editor, media, status });
  app.use(createRouter(controllers, { csrf, contactLimit: contactRateLimit(config), admin: adminAuth(config.admin), errorReportLimit: errorReportLimit(), errorReportBody: express.json({ limit: "8kb", type: ["application/json", "text/plain"] }), adminJson: express.json({ limit: "2mb" }) }));

  app.use(notFoundHandler());
  app.use(errorHandler({ logger, seo, csrf, reporter }));

  return { app, services: { database: db, content, seo, consent, mail, contact, assets, logger, reporter, media, editor, status } };
}
