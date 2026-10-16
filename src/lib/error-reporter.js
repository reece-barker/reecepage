// Sends errors to a self hosted GlitchTip (or anything else that speaks the Sentry protocol) without any SDK.
// GlitchTip runs on the same Hetzner box (deploy/glitchtip), so error reports never leave our own server.
//
// What goes out: the error type, message and stack, the request method and path (no query string), the request id,
// the environment and the release. What never goes out: cookies, headers, form bodies, IP addresses, emails.
// When ERROR_DSN isnt set every function here does nothing, so development and tests stay quiet.
import { randomUUID } from "node:crypto";
import path from "node:path";
import { ROOT_DIR } from "../config/index.js";

const MAX_PER_MINUTE = 30;          // a crash loop must not flood the monitor or the network
const SEND_TIMEOUT_MS = 3000;

/** "https://key@errors.reece.page/2" -> { storeUrl, key }. Returns null for anything else */
export function parseDsn(dsn) {
  if (!dsn) return null;
  try {
    const url = new URL(dsn);
    const projectId = url.pathname.replace(/^\/+|\/+$/g, "");
    if (!url.username || !/^\d+$/.test(projectId) || !/^https?:$/.test(url.protocol)) return null;
    return { key: decodeURIComponent(url.username), storeUrl: `${url.protocol}//${url.host}/api/${projectId}/store/` };
  } catch {
    return null;
  }
}

/** Turns error.stack into Sentry frames, oldest call first, paths made relative so the server layout doesnt leak */
export function stackFrames(stack) {
  const frames = [];
  for (const line of String(stack || "").split("\n").slice(1, 40)) {
    const match = /^\s*at (?:(.+?) \()?(.+?):(\d+):(\d+)\)?$/.exec(line);
    if (!match) continue;
    let file = match[2].replace(/^file:\/\//, "");
    const inApp = file.startsWith(ROOT_DIR) && !file.includes("node_modules");
    if (file.startsWith(ROOT_DIR)) file = path.relative(ROOT_DIR, file);
    frames.push({ function: match[1] || "<anonymous>", filename: file, lineno: Number(match[3]), colno: Number(match[4]), in_app: inApp });
  }
  return frames.reverse();
}

/** Removes anything that looks like an email address or a long number from free text before it is sent */
export function scrub(text) {
  return String(text ?? "")
    .replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, "[email]")
    .replace(/\b\d{6,}\b/g, "[number]")
    .slice(0, 2000);
}

export function createErrorReporter({ dsn, environment, release, logger, fetchImpl = globalThis.fetch }) {
  const target = parseDsn(dsn);
  if (dsn && !target) logger?.warn("ERROR_DSN is not a valid DSN, error reporting is off");
  let windowStart = Date.now();
  let sentInWindow = 0;

  function allowed() {
    const now = Date.now();
    if (now - windowStart > 60000) { windowStart = now; sentInWindow = 0; }
    sentInWindow += 1;
    return sentInWindow <= MAX_PER_MINUTE;
  }

  async function send(event) {
    if (!target || !allowed()) return false;
    const body = {
      event_id: randomUUID().replace(/-/g, ""),
      timestamp: new Date().toISOString(),
      environment,
      release,
      ...event
    };
    try {
      const res = await fetchImpl(target.storeUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Sentry-Auth": `Sentry sentry_version=7, sentry_client=reece-page/1.0, sentry_key=${target.key}`
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(SEND_TIMEOUT_MS)
      });
      if (!res.ok) logger?.warn({ status: res.status }, "error monitor refused a report");
      return res.ok;
    } catch (error) {
      // Never let the monitor break the thing it watches. One line in the log is enough
      logger?.warn({ err: { message: error.message } }, "could not reach the error monitor");
      return false;
    }
  }

  return {
    enabled: Boolean(target),

    /** A server side error, with the request if there is one */
    captureException(error, { req, level = "error", tags = {} } = {}) {
      return send({
        platform: "node",
        level,
        exception: { values: [{ type: error?.name || "Error", value: scrub(error?.message), stacktrace: { frames: stackFrames(error?.stack) } }] },
        ...(req ? { request: { method: req.method, url: req.path } } : {}),
        tags: { ...(req?.id ? { request_id: req.id } : {}), ...tags }
      });
    },

    /** An error reported by a visitor's browser through POST /errors, already validated by the controller */
    captureBrowserError({ message, type, stack, page, userAgentFamily }) {
      return send({
        platform: "javascript",
        level: "error",
        exception: { values: [{ type: type || "Error", value: scrub(message), stacktrace: { frames: browserFrames(stack) } }] },
        request: { url: page },
        tags: { source: "browser", ...(userAgentFamily ? { browser: userAgentFamily } : {}) }
      });
    }
  };
}

// Browser stacks look like "fn@https://reece.page/assets/js/main.1a2b.js:10:5" (Firefox, Safari) or the V8 format
function browserFrames(stack) {
  const frames = [];
  for (const line of String(stack || "").split("\n").slice(0, 30)) {
    const match = /(?:at\s+(?:(.+?)\s+\()?|^(.*?)@)(https?:\/\/[^\s)]+?):(\d+):(\d+)\)?\s*$/.exec(line.trim());
    if (!match) continue;
    let file = match[3];
    try { file = new URL(file).pathname; } catch { /* keep as is */ }
    frames.push({ function: match[1] || match[2] || "<anonymous>", filename: file, lineno: Number(match[4]), colno: Number(match[5]), in_app: file.startsWith("/assets/js/") });
  }
  return frames.reverse();
}
