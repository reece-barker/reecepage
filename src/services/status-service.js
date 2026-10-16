// The live checks behind /status (public) and the admin dashboard. Every line comes from a real check made right
// now, nothing is stored or made up: no uptime percentage until there is monitoring data to back one.
import { access, constants, mkdir } from "node:fs/promises";

const STATES = {
  ok: "Working",
  degraded: "Partly working",
  down: "Not working",
  off: "Switched off"
};

/**
 * @param {{ config: object, database: object | null, mail: import("./mail-service.js").MailService, reporter: object, media: import("./media-service.js").MediaService }} deps
 */
export function createStatusService({ config, database, mail, reporter, media }) {
  const startedAt = new Date();

  async function databaseCheck() {
    if (!database) return { id: "database", name: "Database", state: "off", detail: "No database is configured." };
    try {
      await Promise.race([database.ping(), new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), 3000).unref())]);
      return { id: "database", name: "Database", state: "ok", detail: "Answers within three seconds." };
    } catch {
      return { id: "database", name: "Database", state: "down", detail: "Does not answer. Messages from the contact form are still emailed if email works." };
    }
  }

  function contactCheck(db) {
    if (!config.features.contact_form) return { id: "contact", name: "Contact form", state: "off", detail: "Switched off, the email address on the contact page still works." };
    const stores = config.contact.store_messages && db.state === "ok";
    const emails = config.contact.send_notifications && mail.enabled;
    const failedLast = mail.lastFailedAt && (!mail.lastSentAt || mail.lastFailedAt > mail.lastSentAt);
    if (stores && emails && !failedLast) return { id: "contact", name: "Contact form", state: "ok", detail: "Messages are saved and emailed." };
    if (stores || (emails && !failedLast)) return { id: "contact", name: "Contact form", state: "degraded", detail: stores ? "Messages are saved, emailing them is not working right now." : "Messages are emailed but not saved." };
    return { id: "contact", name: "Contact form", state: "down", detail: "Messages cannot be delivered right now, please email instead." };
  }

  async function mediaCheck() {
    if (!config.features.media) return { id: "media", name: "Pictures and videos", state: "off", detail: "The media library is switched off." };
    if (!media.available) return { id: "media", name: "Pictures and videos", state: "down", detail: "The media library needs the database." };
    try {
      await mkdir(media.dir, { recursive: true });
      await access(media.dir, constants.R_OK | constants.W_OK);
      return { id: "media", name: "Pictures and videos", state: "ok", detail: "Files can be read and uploaded." };
    } catch {
      return { id: "media", name: "Pictures and videos", state: "degraded", detail: "The media folder cannot be written to, uploads would fail." };
    }
  }

  return {
    startedAt,

    /** @param {{ detailed?: boolean }} options detailed adds the checks only the admin needs to see */
    async run({ detailed = false } = {}) {
      const db = await databaseCheck();
      const checks = [
        { id: "website", name: "Website", state: "ok", detail: "Pages are being served." },
        db,
        contactCheck(db),
        await mediaCheck()
      ];
      if (detailed) {
        checks.push(
          { id: "email", name: "Email sending", state: mail.enabled ? (mail.lastFailedAt && (!mail.lastSentAt || mail.lastFailedAt > mail.lastSentAt) ? "degraded" : "ok") : "off",
            detail: mail.enabled ? `Last sent: ${mail.lastSentAt ? mail.lastSentAt.toISOString() : "nothing since the start"}. Last failure: ${mail.lastFailedAt ? mail.lastFailedAt.toISOString() : "none"}.` : "SMTP is not set up (SMTP_HOST and MAIL_FROM)." },
          { id: "errors", name: "Error monitor", state: reporter.enabled ? "ok" : "off", detail: reporter.enabled ? "Errors are sent to GlitchTip." : "ERROR_DSN is not set, errors only go to the log." },
          { id: "admin", name: "Admin login", state: config.admin.devPassword ? "degraded" : config.admin.passwordHash ? "ok" : "off", detail: config.admin.devPassword ? "Using the development password, fine on your own computer only." : config.admin.passwordHash ? "Password set." : "No ADMIN_PASSWORD_HASH, the admin is closed." }
        );
      }
      for (const check of checks) check.label = STATES[check.state];
      const states = checks.filter((c) => c.state !== "off").map((c) => c.state);
      const overall = states.includes("down") ? "down" : states.includes("degraded") ? "degraded" : "ok";
      return {
        overall: { state: overall, label: overall === "ok" ? "Everything is working" : overall === "degraded" ? "Some parts are not working fully" : "Something is not working" },
        checks,
        startedAt,
        checkedAt: new Date(),
        release: config.monitoring?.release
      };
    }
  };
}
