// Rate limits. The store is in memory, which is right for one Node process. If the site ever runs as several
// processes behind a load balancer, swap in a shared store (Redis or MySQL), see docs/OPERATIONS.md
import { rateLimit } from "express-rate-limit";

function renderTooMany(res, next, retryMinutes) {
  res.status(429);
  res.locals.retryMinutes = retryMinutes;
  const error = new Error("Too many requests");
  error.status = 429;
  next(error);
}

/** Generous limit for the whole site, only there to slow down scrapers hammering every page */
export function siteRateLimit() {
  return rateLimit({
    windowMs: 60 * 1000,
    limit: 300,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    skip: (req) => req.path.startsWith("/assets/") || req.path.startsWith("/health"),
    handler: (req, res, next) => renderTooMany(res, next, 1)
  });
}

/** Tight limit for sending the contact form */
export function contactRateLimit(config) {
  const { window_minutes: windowMinutes, max_submissions: max } = config.contact.rate_limit;
  return rateLimit({
    windowMs: windowMinutes * 60 * 1000,
    limit: max,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    handler: (req, res, next) => renderTooMany(res, next, windowMinutes)
  });
}

/** Browser error reports: a page with a broken script can fire a lot, 20 a minute per address is plenty */
export function errorReportLimit() {
  return rateLimit({
    windowMs: 60 * 1000,
    limit: 20,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    handler: (req, res) => res.status(429).end()
  });
}
