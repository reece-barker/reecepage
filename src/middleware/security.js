// Security headers. The content security policy is strict: scripts only from this site or with the per request
// nonce, no inline styles, no framing. Analytics hosts are only added when analytics is switched on.
import helmet from "helmet";

function originOf(url) {
  try { return new URL(url).origin; } catch { return null; }
}

/** The extra origins the analytics script needs, empty when analytics is off */
export function analyticsOrigins(config) {
  if (!config.features.analytics) return { script: [], connect: [] };
  const { provider } = config.analytics;
  if (provider === "plausible") {
    const script = originOf(config.analytics.plausible.script_url);
    const api = originOf(config.analytics.plausible.api_host) || script;
    return { script: [script].filter(Boolean), connect: [api].filter(Boolean) };
  }
  if (provider === "umami") {
    const script = originOf(config.analytics.umami.script_url);
    return { script: [script].filter(Boolean), connect: [script].filter(Boolean) };
  }
  return { script: [], connect: [] };
}

export function securityHeaders(config) {
  const extra = analyticsOrigins(config);
  return helmet({
    contentSecurityPolicy: {
      useDefaults: false,
      directives: {
        "default-src": ["'self'"],
        "script-src": ["'self'", (req, res) => `'nonce-${res.locals.cspNonce}'`, ...extra.script],
        "style-src": ["'self'"],
        "img-src": ["'self'", "data:"],
        "font-src": ["'self'"],
        "connect-src": ["'self'", ...extra.connect],
        "manifest-src": ["'self'"],
        "media-src": ["'self'"],
        "worker-src": ["'none'"],
        "object-src": ["'none'"],
        "base-uri": ["'none'"],
        "form-action": ["'self'"],
        "frame-ancestors": ["'none'"],
        ...(config.isProduction ? { "upgrade-insecure-requests": [] } : {})
      }
    },
    // HSTS only makes sense on the real https domain, on localhost it would just confuse the browser
    strictTransportSecurity: config.isProduction ? { maxAge: 31536000, includeSubDomains: true } : false,
    crossOriginEmbedderPolicy: false,
    referrerPolicy: { policy: "strict-origin-when-cross-origin" }
  });
}

/** Permissions-Policy, helmet doesnt set this one. The site needs none of these powerful features */
export function permissionsPolicy() {
  // Only features every current browser knows, unknown names make Chrome print a console error on every page
  const value = ["camera=()", "microphone=()", "geolocation=()", "payment=()", "usb=()"].join(", ");
  return (req, res, next) => {
    res.setHeader("Permissions-Policy", value);
    next();
  };
}
