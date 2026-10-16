// Sends email over SMTP. Built so the rest of the app never touches nodemailer directly, which keeps the tests simple
// (they pass in a fake transport) and keeps all the timeout and error handling in one spot.
import nodemailer from "nodemailer";

export class MailNotConfiguredError extends Error {
  constructor() {
    super("SMTP is not configured (SMTP_HOST and MAIL_FROM are needed)");
    this.name = "MailNotConfiguredError";
  }
}

export class MailService {
  /**
   * @param {{ config: object, logger: import("pino").Logger, transport?: object }} deps
   *   transport is anything with sendMail(message), tests use a fake one
   */
  constructor({ config, logger, transport }) {
    this.config = config;
    this.logger = logger;
    this.transport = transport || null;
    // The status page reports how the last attempt went, nothing about who it was to
    this.lastSentAt = null;
    this.lastFailedAt = null;
  }

  get enabled() {
    return Boolean(this.transport) || this.config.smtp.configured;
  }

  getTransport() {
    if (this.transport) return this.transport;
    const { smtp } = this.config;
    if (!smtp.configured) throw new MailNotConfiguredError();
    this.transport = nodemailer.createTransport({
      host: smtp.host,
      port: smtp.port,
      secure: smtp.secure,
      auth: smtp.user ? { user: smtp.user, pass: smtp.password } : undefined,
      // A hanging mail server must never hang a visitor's request for long
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 15000,
      requireTLS: !smtp.secure,
      // Proton Mail Bridge on localhost has its own self signed certificate. The traffic never leaves the machine,
      // so its certificate is accepted there and only there (config refuses this for any other host)
      ...(smtp.allowSelfSigned ? { tls: { rejectUnauthorized: false } } : {})
    });
    return this.transport;
  }

  /**
   * @param {{ to: string, subject: string, text: string, replyTo?: string }} message
   * @returns {Promise<{ messageId?: string }>}
   */
  async send({ to, subject, text, replyTo }) {
    const transport = this.getTransport();
    let info;
    try {
      info = await this.sendWith(transport, { to, subject, text, replyTo });
    } catch (error) {
      this.lastFailedAt = new Date();
      throw error;
    }
    this.lastSentAt = new Date();
    this.logger.info({ messageId: info?.messageId }, "email sent");
    return info || {};
  }

  sendWith(transport, { to, subject, text, replyTo }) {
    return transport.sendMail({
      from: this.config.smtp.from,
      to,
      subject,
      text,
      ...(replyTo ? { replyTo } : {})
    });
  }

  /** Checks the SMTP login works, used by `npm run mail:verify`, never on a normal request */
  async verify() {
    const transport = this.getTransport();
    if (typeof transport.verify === "function") await transport.verify();
    return true;
  }
}
