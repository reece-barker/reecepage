// Login for /admin, with HTTP basic auth over https. One person (Reece) uses it, so there are no accounts or
// sessions: the browser asks for the name and password and remembers them until it is closed.
// The password is never stored, only a scrypt hash of it in ADMIN_PASSWORD_HASH (npm run admin:password makes one).
// Wrong guesses are rate limited per address, and the whole of /admin answers 404 while no hash is set.
import { timingSafeEqual } from "node:crypto";
import { rateLimit } from "express-rate-limit";
import { hashPassword, isValidHash, verifyPassword } from "../utils/password.js";

export { hashPassword, isValidHash, verifyPassword };

function safeEqual(a, b) {
  const x = Buffer.from(String(a));
  const y = Buffer.from(String(b));
  return x.length === y.length && timingSafeEqual(x, y);
}

/** @param {{ user: string, passwordHash: string }} admin */
export function adminAuth(admin) {
  const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 10,
    skipSuccessfulRequests: true,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    handler: (req, res) => res.status(429).set("Retry-After", "900").type("text/plain").send("Too many wrong passwords, try again in 15 minutes.")
  });

  function check(req, res, next) {
    if (!isValidHash(admin.passwordHash)) return res.status(404).end();
    res.set("Cache-Control", "no-store");
    res.set("X-Robots-Tag", "noindex, nofollow");
    const header = req.get("authorization") || "";
    if (header.startsWith("Basic ")) {
      const decoded = Buffer.from(header.slice(6), "base64").toString("utf8");
      const split = decoded.indexOf(":");
      const user = decoded.slice(0, split);
      const password = decoded.slice(split + 1);
      if (split > 0 && safeEqual(user, admin.user) && verifyPassword(password, admin.passwordHash)) return next();
    }
    res.set("WWW-Authenticate", 'Basic realm="reece.page admin", charset="UTF-8"');
    res.status(401).type("text/plain").send("Sign in to continue.");
  }

  return [limiter, check];
}
