// Server side checks for the contact form. The browser checks are only there for convenience, these are the real ones.
import { CONTACT_LIMITS } from "../models/contact-message.js";
import { translator } from "../lib/i18n.js";

// Deliberately simple: something@something.something, no spaces, no line breaks. Anything stricter rejects
// real addresses, and the only way to really validate an address is replying to it
const EMAIL_PATTERN = /^[^\s@<>()[\]\\,;:"]+@[^\s@<>()[\]\\,;:"]+\.[^\s@<>()[\]\\,;:"]{2,}$/;
// Control characters (except tab and line breaks in the message) never belong in a form field
// eslint-disable-next-line no-control-regex -- matching control characters is the whole point here
const CONTROL_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/;
const LINE_BREAK = /[\r\n]/;

export const MESSAGE_MIN = 10;

function clean(value) {
  return typeof value === "string" ? value.normalize("NFC").trim() : "";
}

/**
 * @param {Record<string, unknown>} body the parsed form body
 * @param {{ topics: string[], t?: ReturnType<typeof translator> }} options t gives the messages in the right language, English without it
 * @returns {{ values: { name: string, email: string, topic: string, message: string }, errors: Record<string, string> }}
 */
export function validateContact(body, { topics, t = translator("en") }) {
  const values = {
    name: clean(body.name),
    email: clean(body.email).toLowerCase(),
    topic: clean(body.topic),
    message: clean(body.message).replace(/\r\n/g, "\n")
  };
  const errors = {};

  if (!values.name) errors.name = t("contact.errors.nameRequired");
  else if (values.name.length > CONTACT_LIMITS.name) errors.name = t("contact.errors.nameTooLong", { max: CONTACT_LIMITS.name });
  else if (CONTROL_CHARS.test(values.name) || LINE_BREAK.test(values.name)) errors.name = t("contact.errors.nameInvalid");

  if (!values.email) errors.email = t("contact.errors.emailRequired");
  else if (values.email.length > CONTACT_LIMITS.email || LINE_BREAK.test(values.email) || !EMAIL_PATTERN.test(values.email)) {
    errors.email = t("contact.errors.emailInvalid");
  }

  if (!topics.includes(values.topic)) errors.topic = t("contact.errors.topicRequired");

  if (!values.message) errors.message = t("contact.errors.messageRequired");
  else if (values.message.length < MESSAGE_MIN) errors.message = t("contact.errors.messageShort", { min: MESSAGE_MIN });
  else if (values.message.length > CONTACT_LIMITS.message) errors.message = t("contact.errors.messageLong", { max: CONTACT_LIMITS.message, length: values.message.length });
  else if (CONTROL_CHARS.test(values.message)) errors.message = t("contact.errors.messageInvalid");

  return { values, errors };
}
