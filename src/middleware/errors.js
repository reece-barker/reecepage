import { translator } from "../lib/i18n.js";

// 404 and error pages. Visitors get a friendly page with the right status code, the details only go to the log.

export class HttpError extends Error {
  constructor(status, message, { expose = true } = {}) {
    super(message);
    this.status = status;
    this.expose = expose;
  }
}

export const notFound = () => new HttpError(404, "Page not found");

/** Runs when no route matched */
export function notFoundHandler() {
  return (req, res, next) => next(notFound());
}

// Wich text key each status uses and the actual words are in the language files
const TITLE_KEYS = { 403: "errors.expired", 404: "errors.notFound", 429: "errors.slow", 500: "errors.wrong", 503: "errors.break" };

/**
 * @param {{ logger: import("pino").Logger, seo: import("../services/seo-service.js").SeoService, csrf: ReturnType<import("./csrf.js").createCsrf> }} deps
 */
export function errorHandler({ logger, seo, csrf, reporter }) {
   
  return (error, req, res, next) => {
    let status = Number(error.status || error.statusCode) || 500;
    if (csrf.isCsrfError(error)) status = 403;
    if (status < 400 || status > 599) status = 500;

    if (status >= 500) {
      (req.log || logger).error({ err: error, requestId: req.id }, "request failed");
      reporter?.captureException(error, { req });
    }
    else if (status !== 404) (req.log || logger).warn({ status, path: req.path, message: error.message }, "request rejected");

    if (res.headersSent) return next(error);

    res.status(status);
    // Errors are never indexed and never cached, a 500 page stuck in a cache is a very long outage
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("X-Robots-Tag", "noindex");

    const view = status === 404 ? "errors/404" : "errors/error";
    const lang = req.lang || "en";
    const title = translator(lang)(TITLE_KEYS[status] || TITLE_KEYS[500]);
    const meta = seo.build({ title, description: title, path: req.path, noindex: true, language: lang });

    if (req.accepts(["html", "json"]) === "json" && !req.accepts("html")) {
      return res.json({ error: title, status, requestId: req.id });
    }

    res.render(view, {
      meta,
      status,
      title,
      isCsrf: status === 403,
      retryMinutes: res.locals.retryMinutes,
      requestId: req.id,
      // Never the stack, never the error message for 500s, those can hold internal details
      bodyClass: "page-error"
    }, (renderError, html) => {
      if (renderError) {
        logger.error({ err: renderError }, "error page failed to render");
        return res.type("text").send(`${status} ${title}`);
      }
      res.send(html);
    });
  };
}
