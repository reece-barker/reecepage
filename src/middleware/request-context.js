// Gives every request an id (for matching log lines to a problem report) and a fresh CSP nonce for the few
// inline scripts the pages need.
import { randomBytes, randomUUID } from "node:crypto";

const VALID_REQUEST_ID = /^[\w.-]{8,64}$/;

export function requestContext() {
  return (req, res, next) => {
    // Reuse the id from a proxy in front of us when it looks sane, otherwise make our own
    const incoming = req.get("x-request-id");
    req.id = incoming && VALID_REQUEST_ID.test(incoming) ? incoming : randomUUID();
    res.setHeader("X-Request-Id", req.id);
    res.locals.cspNonce = randomBytes(16).toString("base64");
    next();
  };
}
