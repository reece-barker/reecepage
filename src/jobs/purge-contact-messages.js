// Deletes contact messages older than contact.retention_days. Runs once a day inside the app and can also be run by
// hand or from cron with `npm run contact:purge`. The privacy policy promises this, so it has to actually happen.

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * @param {{ repository: import("../repositories/contact-message-repository.js").ContactMessageRepository, retentionDays: number, logger: import("pino").Logger, now?: Date }} options
 * @returns {Promise<number>} rows deleted
 */
export async function purgeContactMessages({ repository, retentionDays, logger, now = new Date() }) {
  const cutoff = new Date(now.getTime() - retentionDays * DAY_MS);
  const deleted = await repository.deleteOlderThan(cutoff);
  logger.info({ deleted, cutoff: cutoff.toISOString() }, "old contact messages purged");
  return deleted;
}

/** Runs the purge now and then every 24 hours. The timer is unref'd so it never keeps the process alive on its own */
export function schedulePurge(options) {
  const run = () => purgeContactMessages(options).catch((error) => options.logger.error({ err: error }, "purge failed"));
  run();
  const timer = setInterval(run, DAY_MS);
  timer.unref();
  return () => clearInterval(timer);
}
