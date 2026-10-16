// A signed token that goes into the contact form as a hidden field. It carries the time the form was shown and a
// random submission id. On submit it tells us two things without storing anything server side:
//   1. how long the person took (bots post instantly), and
//   2. which submission this is, so pressing send twice saves one message, not two.
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

function sign(secret, payload) {
  return createHmac("sha256", secret).update(`contact-form:${payload}`).digest("base64url");
}

export function createFormToken(secret, now = Date.now()) {
  const payload = `${Math.floor(now / 1000)}.${randomBytes(12).toString("base64url")}`;
  return `${payload}.${sign(secret, payload)}`;
}

/**
 * @returns {{ ok: true, submissionId: string, ageSeconds: number } | { ok: false, reason: "malformed" | "signature" | "too_fast" | "expired" }}
 */
export function verifyFormToken(token, secret, { minSeconds = 3, maxAgeSeconds = 60 * 60 * 24, now = Date.now() } = {}) {
  const parts = typeof token === "string" ? token.split(".") : [];
  if (parts.length !== 3 || !/^\d+$/.test(parts[0]) || !/^[\w-]{16}$/.test(parts[1])) return { ok: false, reason: "malformed" };
  const payload = `${parts[0]}.${parts[1]}`;
  const expected = Buffer.from(sign(secret, payload));
  const given = Buffer.from(parts[2]);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return { ok: false, reason: "signature" };
  const ageSeconds = Math.floor(now / 1000) - Number(parts[0]);
  if (ageSeconds < minSeconds) return { ok: false, reason: "too_fast" };
  if (ageSeconds > maxAgeSeconds) return { ok: false, reason: "expired" };
  return { ok: true, submissionId: parts[1], ageSeconds };
}

/** Keyed hash of an ip address. Lets us spot one address sending a flood without ever storing the address itself */
export function hashIp(ip, secret) {
  if (!ip) return null;
  return createHmac("sha256", secret).update(`ip:${ip}`).digest("hex");
}
