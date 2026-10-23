// Starts the web server. Run with `npm start` (production) or `npm run dev` (development, rebuilds assets on change).
import { loadConfig, ConfigError } from "./config/index.js";
import { createLogger } from "./lib/logger.js";
import { createApp } from "./app.js";
import { ContactMessageRepository } from "./repositories/contact-message-repository.js";
import { schedulePurge } from "./jobs/purge-contact-messages.js";

let config;
try {
  config = loadConfig();
} catch (error) {
  // Config problems are written plainly to stderr, the logger isnt set up yet and this is what a human reads first
  if (error instanceof ConfigError) {
    console.error(`\n${error.message}\n\nSee .env.example and docs/CONFIGURATION.md\n`);
    process.exit(78); // EX_CONFIG
  }
  throw error;
}

const logger = createLogger(config);
const { app, services, prepare, stop } = createApp({ config, logger });
const { database } = services;

if (database) {
  try {
    await database.ping();
    logger.info({ dialect: database.dialect }, "database connected");
    // SQLite is only ever a local or test database, often in memory, so it gets its tables straight away.
    // MySQL never migrates on its own, thats a deliberate step in the deploy (npm run db:migrate)
    if (database.dialect === "sqlite") {
      const { createMigrator } = await import("./database/migrator.js");
      await createMigrator(database, logger).up();
    }
  } catch (error) {
    // The site still serves pages without the database, only storing contact messages is affected.
    // /health/ready reports it, so monitoring will notice
    logger.error({ err: { message: error.message } }, "database not reachable at startup");
  }
}
// Content from the database. If that fails the site serves the files in content/ and keeps trying in the background
await prepare();

const stopPurge = database && config.contact.store_messages
  ? schedulePurge({ repository: new ContactMessageRepository(database.models), retentionDays: config.contact.retention_days, logger })
  : () => {};

const server = app.listen(config.port, config.host, () => {
  logger.info({ url: config.baseUrl, port: config.port, env: config.env }, "reece.page is running");
  if (config.admin.devLogin) {
    // Plain console line on purpose, it is for the person at the keyboard, not for the log files
    console.log(`\n  Admin: ${config.baseUrl}/admin   (development sign in, one click)\n`);
  }
});
// Slightly longer than a typical proxy keep alive, so the proxy never reuses a socket we just closed
server.keepAliveTimeout = 65000;
server.headersTimeout = 66000;
// Long enough for a big video upload on the admin page. Slow header attacks are still cut off by headersTimeout,
// and nginx in front has its own limits
server.requestTimeout = 15 * 60 * 1000;

let shuttingDown = false;
async function shutdown(signal, exitCode = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info({ signal }, "shutting down");
  stopPurge();
  stop();
  // Give open requests up to 10 seconds to finish, then go anyway
  const force = setTimeout(() => {
    logger.error("forced shutdown after timeout");
    process.exit(exitCode || 1);
  }, 10000);
  force.unref();
  server.close(async () => {
    try { await database?.close(); } catch (error) { logger.error({ err: error }, "error closing database"); }
    logger.info("stopped");
    process.exit(exitCode);
  });
  server.closeIdleConnections?.();
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
// Report first (it gives up after 3 seconds), then shut down so systemd starts a clean process
process.on("unhandledRejection", async (reason) => {
  logger.fatal({ err: reason }, "unhandled promise rejection");
  await services.reporter.captureException(reason instanceof Error ? reason : new Error(String(reason)), { level: "fatal" });
  shutdown("unhandledRejection", 1);
});
process.on("uncaughtException", async (error) => {
  logger.fatal({ err: error }, "uncaught exception");
  await services.reporter.captureException(error, { level: "fatal" });
  shutdown("uncaughtException", 1);
});
