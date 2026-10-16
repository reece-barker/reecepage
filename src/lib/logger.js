// One logger for the whole app. JSON lines in production (easy to ship to any log service), still JSON in
// development but its fine to pipe it through pino-pretty if you have it installed globally.
import pino from "pino";

// Anything that could hold a secret or someones personal data gets masked before its written anywhere
export const REDACT_PATHS = [
  "req.headers.cookie",
  "req.headers.authorization",
  "req.headers['x-csrf-token']",
  "res.headers['set-cookie']",
  "password",
  "*.password",
  "smtp.password",
  "database.password",
  "appSecret",
  "body.email",
  "body.message",
  "body.name"
];

/**
 * @param {{ logLevel: string, env: string }} config
 * @param {import("pino").DestinationStream} [destination] tests pass a stream to read what was logged
 */
export function createLogger(config, destination) {
  return pino(
    {
      level: config.logLevel,
      base: { env: config.env },
      redact: { paths: REDACT_PATHS, censor: "[redacted]" },
      timestamp: pino.stdTimeFunctions.isoTime
    },
    destination
  );
}
