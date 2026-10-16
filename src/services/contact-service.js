// Everything that happens after someone presses "Send message": spam checks, validation, saving, emailing.
// The controller only turns the result into a page.
import { validateContact } from "../validators/contact-validator.js";
import { verifyFormToken, hashIp } from "../utils/form-token.js";

/**
 * @typedef {"sent" | "duplicate" | "invalid" | "resubmit" | "spam" | "failed"} ContactStatus
 */

export class ContactService {
  /**
   * @param {object} deps
   * @param {object} deps.config
   * @param {import("pino").Logger} deps.logger
   * @param {import("../repositories/contact-message-repository.js").ContactMessageRepository | null} deps.repository
   * @param {import("./mail-service.js").MailService} deps.mail
   */
  constructor({ config, logger, repository, mail }) {
    this.config = config;
    this.logger = logger;
    this.repository = repository;
    this.mail = mail;
  }

  get topics() { return this.config.contact.topics; }

  get canStore() { return Boolean(this.config.contact.store_messages && this.repository); }

  get canNotify() { return Boolean(this.config.contact.send_notifications && this.mail.enabled); }

  /** False when there is nowhere for a message to go, the page then only shows the email address */
  get available() { return this.config.features.contact_form && (this.canStore || this.canNotify); }

  /**
   * @param {{ body: Record<string, unknown>, ip?: string }} input
   * @returns {Promise<{ status: ContactStatus, values?: object, errors?: Record<string, string>, reason?: string }>}
   */
  async submit({ body, ip }) {
    // A field people never see. Bots fill in every field they find, so anything in here means its not a person.
    // They get the normal thank you page, telling them they were caught only helps them adjust
    if (typeof body.website === "string" && body.website.trim() !== "") {
      this.logger.info({ reason: "honeypot" }, "contact form spam dropped");
      return { status: "spam", reason: "honeypot" };
    }

    const { values, errors } = validateContact(body, { topics: this.topics });

    // Mistakes first: someone fixing their email doesnt need to hear about tokens as well, they get a fresh one anyway
    if (Object.keys(errors).length) return { status: "invalid", values, errors };

    const token = verifyFormToken(body.form_token, this.config.appSecret, { minSeconds: this.config.contact.min_seconds_to_submit });
    if (!token.ok) {
      this.logger.info({ reason: token.reason }, "contact form token rejected");
      // Too fast, too old or tampered: show the form again with what they typed and a fresh token, a real person
      // only has to press send once more
      return { status: "resubmit", values, errors, reason: token.reason };
    }

    const ipHash = hashIp(ip, this.config.appSecret);
    let stored = null;
    if (this.canStore) {
      try {
        const { message, duplicate } = await this.repository.create({ ...values, submissionId: token.submissionId, ipHash });
        if (duplicate) return { status: "duplicate", values };
        stored = message;
      } catch (error) {
        this.logger.error({ err: error }, "could not save contact message");
      }
    }

    let notified = false;
    if (this.canNotify) {
      try {
        await this.mail.send({
          to: this.config.contact.notifyTo,
          replyTo: values.email,
          subject: `reece.page: ${values.topic}, from ${values.name}`,
          text: this.notificationText(values, stored)
        });
        notified = true;
        if (stored) await this.repository.markNotified(stored.id);
      } catch (error) {
        this.logger.error({ err: { message: error.message, code: error.code } }, "could not send contact notification");
        if (stored) await this.repository.markNotificationFailed(stored.id, error.message).catch(() => {});
      }
    }

    if (!stored && !notified) return { status: "failed", values };
    return { status: "sent", values };
  }

  notificationText(values, stored) {
    return [
      `New message from the contact form on ${this.config.site.domain}`,
      "",
      `Name:   ${values.name}`,
      `Email:  ${values.email}`,
      `Topic:  ${values.topic}`,
      stored ? `Stored: yes, id ${stored.id}` : "Stored: no",
      "",
      values.message,
      "",
      "--",
      "Reply to this email to answer them directly.",
      `Messages are deleted after ${this.config.contact.retention_days} days, as the privacy policy says.`
    ].join("\n");
  }
}
