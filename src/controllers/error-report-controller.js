// POST /errors: the browser script sends JavaScript errors here and the server passes them on to the error monitor.
// Going through our own server means no third party script, no extra CSP host, and the visitor's IP address is never
// part of the report. Only a few short text fields are accepted, everything else is dropped.

const MAX = { message: 500, type: 80, stack: 4000, page: 300 };

function text(value, max) {
  return typeof value === "string" ? value.slice(0, max) : "";
}

function browserFamily(userAgent = "") {
  if (/Edg\//.test(userAgent)) return "Edge";
  if (/Firefox\//.test(userAgent)) return "Firefox";
  if (/Chrome\//.test(userAgent)) return "Chrome";
  if (/Safari\//.test(userAgent)) return "Safari";
  return "Other";
}

/** @param {{ reporter: ReturnType<import("../lib/error-reporter.js").createErrorReporter>, config: object }} deps */
export function createErrorReportController({ reporter, config }) {
  return {
    receive(req, res) {
      if (!reporter.enabled || !config.monitoring.browser) return res.status(204).end();
      const body = req.body && typeof req.body === "object" ? req.body : {};
      const message = text(body.message, MAX.message);
      if (!message) return res.status(400).end();
      let page = text(body.page, MAX.page);
      // Only the path of a page on this site, never a query string (it could hold anything)
      try { page = new URL(page, config.baseUrl).pathname; } catch { page = ""; }
      reporter.captureBrowserError({
        message,
        type: text(body.type, MAX.type),
        stack: text(body.stack, MAX.stack),
        page,
        userAgentFamily: browserFamily(req.get("user-agent"))
      });
      res.status(204).end();
    }
  };
}
