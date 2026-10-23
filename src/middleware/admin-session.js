// Guards everything under /admin except the sign in pages. A page request without a session is sent to the sign in
// page (and comes back to where it was going afterwards), a fetch from the editor gets a 401 it can show
import { rateLimit } from "express-rate-limit";

/** Admin pages are private: never cached, never indexed, never framed by anything except the admin itself */
export function adminHeaders(req, res, next) {
  res.set("Cache-Control", "no-store");
  res.set("X-Robots-Tag", "noindex, nofollow");
  next();
}

/** @param {import("../services/admin-auth-service.js").AdminAuthService} auth */
export function requireAdmin(auth) {
  return async (req, res, next) => {
    if (!auth.available) return res.status(503).type("text/plain").send("The admin needs the database, and it isnt configured on this server.");
    try {
      const session = await auth.readSession(req);
      if (session) {
        req.admin = session;
        res.locals.admin = session;
        return next();
      }
    } catch (error) {
      return next(error);
    }
    const wantsPage = req.method === "GET" && req.accepts(["html", "json"]) === "html";
    if (wantsPage) return res.redirect(303, `/admin/login?next=${encodeURIComponent(req.originalUrl)}`);
    res.status(401).json({ ok: false, error: "You've been signed out, sign in again in another tab and try once more.", signedOut: true });
  };
}

/** Sign in attempts per address. Generous enough for a few mistakes, tight enough that guessing gets nowhere */
export function signInLimit() {
  return rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 30,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    handler: (req, res) => res.status(429).type("text/plain").send("Too many sign in attempts, wait 15 minutes and try again.")
  });
}
