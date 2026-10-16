// npm run mail:verify: logs in to the SMTP server with the settings from .env and says if it worked.
// Add --send to also send one test email to CONTACT_NOTIFY_TO (or site.email), so you can see it arrive.
import { loadConfig } from "../src/config/index.js";
import { createLogger } from "../src/lib/logger.js";
import { MailService } from "../src/services/mail-service.js";

const config = loadConfig();
const logger = createLogger({ ...config, logLevel: "warn" });
const mail = new MailService({ config, logger });

if (!config.smtp.configured) {
  console.error("SMTP is not set up. Fill in SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD and MAIL_FROM in .env (see docs/EMAIL.md).");
  process.exit(1);
}

console.log(`Connecting to ${config.smtp.host}:${config.smtp.port} (${config.smtp.secure ? "TLS" : "STARTTLS required"}) as ${config.smtp.user || "no login"}...`);
try {
  await mail.verify();
  console.log("Login worked.");
  if (process.argv.includes("--send")) {
    const info = await mail.send({
      to: config.contact.notifyTo,
      subject: "reece.page test email",
      text: `This is a test from npm run mail:verify on ${new Date().toISOString()}. If you can read it, contact form notifications will arrive too.`
    });
    console.log(`Test email sent to ${config.contact.notifyTo} (${info.messageId || "no id"}).`);
  }
} catch (error) {
  console.error(`It did not work: ${error.message}`);
  if (error.code === "EAUTH") console.error("The username or password was refused.");
  if (["ECONNECTION", "ETIMEDOUT", "ESOCKET"].includes(error.code)) console.error("The server could not be reached. Check the host and port, and that the hosting provider allows outgoing SMTP.");
  process.exitCode = 1;
}
