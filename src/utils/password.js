// Password hashing for the admin login. scrypt from Node itself, no extra package. The stored form is
// scrypt:N:r:p:salt:hash so the cost can be raised later without breaking old hashes
import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

const PARAMS = { N: 32768, r: 8, p: 1 };

export function hashPassword(password, salt = randomBytes(16)) {
  const hash = scryptSync(String(password).normalize("NFC"), salt, 32, { ...PARAMS, maxmem: 64 * 1024 * 1024 });
  return `scrypt:${PARAMS.N}:${PARAMS.r}:${PARAMS.p}:${salt.toString("base64")}:${hash.toString("base64")}`;
}

export function isValidHash(stored) {
  return /^scrypt:\d+:\d+:\d+:[A-Za-z0-9+/=]+:[A-Za-z0-9+/=]+$/.test(String(stored || ""));
}

export function verifyPassword(password, stored) {
  if (!isValidHash(stored)) return false;
  const [, N, r, p, salt, expected] = stored.split(":");
  const want = Buffer.from(expected, "base64");
  const got = scryptSync(String(password).normalize("NFC"), Buffer.from(salt, "base64"), want.length, { N: Number(N), r: Number(r), p: Number(p), maxmem: 64 * 1024 * 1024 });
  return timingSafeEqual(got, want);
}

