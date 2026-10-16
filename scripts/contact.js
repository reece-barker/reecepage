// Looking after contact form messages from the command line.
//
//   npm run contact:list            the 20 newest messages (add a number for more: npm run contact:list -- 50)
//   npm run contact:purge           delete everything older than contact.retention_days (the daily job does this too)
//   npm run contact:retry           email the ones that were saved but never reached the inbox
import { loadConfig } from "../src/config/index.js";
import { createLogger } from "../src/lib/logger.js";
import { createDatabase } from "../src/database/index.js";
import { ContactMessageRepository } from "../src/repositories/contact-message-repository.js";
import { MailService } from "../src/services/mail-service.js";
import { ContactService } from "../src/services/contact-service.js";
import { purgeContactMessages } from "../src/jobs/purge-contact-messages.js";

const [command, arg] = process.argv.slice(2);
const config = loadConfig();
const logger = createLogger({ ...config, logLevel: "warn" });
const database = createDatabase(config, logger);
if (!database) {
  console.error("No database is configured, so there are no stored messages.");
  process.exit(1);
}
const repository = new ContactMessageRepository(database.models);

try {
  if (command === "list") {
    const rows = await repository.listRecent(Number(arg) || 20);
    if (!rows.length) console.log("No messages.");
    for (const row of rows) {
      const created = new Date(row.created_at || row.createdAt).toISOString().slice(0, 16).replace("T", " ");
      const mailed = row.notified_at || row.notifiedAt ? "mailed" : "NOT MAILED";
      console.log(`#${row.id}  ${created}  ${mailed}  ${row.name} <${row.email}>  ${row.topic}`);
      console.log(`    ${String(row.message).replace(/\s+/g, " ").slice(0, 140)}`);
    }
  } else if (command === "purge") {
    const removed = await purgeContactMessages({ repository, retentionDays: config.contact.retention_days, logger });
    console.log(`Deleted ${removed} message(s) older than ${config.contact.retention_days} days.`);
  } else if (command === "retry") {
    const mail = new MailService({ config, logger });
    if (!mail.enabled) throw new Error("SMTP is not set up, so there is nothing to retry with. See docs/EMAIL.md.");
    const contact = new ContactService({ config, logger, repository, mail });
    const pending = await repository.listUnnotified();
    if (!pending.length) console.log("Every stored message has been emailed.");
    for (const message of pending) {
      try {
        await mail.send({
          to: config.contact.notifyTo,
          replyTo: message.email,
          subject: `reece.page: ${message.topic}, from ${message.name} (sent again)`,
          text: contact.notificationText(message, message)
        });
        await repository.markNotified(message.id);
        console.log(`#${message.id} sent`);
      } catch (error) {
        await repository.markNotificationFailed(message.id, error.message);
        console.log(`#${message.id} failed again: ${error.message}`);
      }
    }
  } else {
    console.error("Use one of: list, purge, retry");
    process.exitCode = 1;
  }
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  await database.close();
}
