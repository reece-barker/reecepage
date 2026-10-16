import { test } from "node:test";
import assert from "node:assert/strict";
import { parseDsn, stackFrames, scrub, createErrorReporter } from "../../src/lib/error-reporter.js";
import { hashPassword, verifyPassword, isValidHash } from "../../src/middleware/admin-auth.js";

test("DSNs are read like Sentry does", () => {
  assert.deepEqual(parseDsn("https://abc123@errors.reece.page/2"), { key: "abc123", storeUrl: "https://errors.reece.page/api/2/store/" });
  assert.equal(parseDsn("not a dsn"), null);
  assert.equal(parseDsn("https://errors.reece.page/2"), null);
  assert.equal(parseDsn(""), null);
});

test("stack frames are oldest first with paths made relative", () => {
  const error = new Error("boom");
  const frames = stackFrames(error.stack);
  assert.ok(frames.length > 0);
  assert.ok(frames.at(-1).filename.startsWith("tests/unit/"), frames.at(-1).filename);
  assert.ok(!frames.some((f) => f.filename.startsWith("/home/")));
});

test("emails and long numbers are scrubbed from messages", () => {
  assert.equal(scrub("failed for ada@example.org with card 4111111111111111"), "failed for [email] with card [number]");
});

test("the reporter sends a Sentry event, and does nothing without a DSN", async () => {
  const calls = [];
  const fetchImpl = async (url, options) => { calls.push({ url, options }); return { ok: true }; };
  const reporter = createErrorReporter({ dsn: "https://k@errors.example/7", environment: "test", release: "r1", fetchImpl });
  const req = { method: "GET", path: "/about", id: "req-1", query: { secret: "x" }, headers: { cookie: "a=b" } };
  assert.equal(await reporter.captureException(new TypeError("bad thing for bob@example.org"), { req }), true);
  const sent = JSON.parse(calls[0].options.body);
  assert.equal(calls[0].url, "https://errors.example/api/7/store/");
  assert.match(calls[0].options.headers["X-Sentry-Auth"], /sentry_key=k/);
  assert.equal(sent.exception.values[0].type, "TypeError");
  assert.equal(sent.exception.values[0].value, "bad thing for [email]");
  assert.deepEqual(sent.request, { method: "GET", url: "/about" });
  assert.equal(sent.tags.request_id, "req-1");
  assert.ok(!calls[0].options.body.includes("a=b"), "no cookies");

  const off = createErrorReporter({ dsn: "", fetchImpl });
  assert.equal(off.enabled, false);
  assert.equal(await off.captureException(new Error("x")), false);
});

test("a dead monitor never throws", async () => {
  const reporter = createErrorReporter({ dsn: "https://k@errors.example/7", fetchImpl: async () => { throw new Error("ECONNREFUSED"); } });
  assert.equal(await reporter.captureException(new Error("x")), false);
});

test("admin passwords are hashed with scrypt and checked in constant time", () => {
  const hash = hashPassword("a long enough admin password");
  assert.ok(isValidHash(hash));
  assert.equal(verifyPassword("a long enough admin password", hash), true);
  assert.equal(verifyPassword("a long enough admin passworD", hash), false);
  assert.equal(verifyPassword("anything", "plain text"), false);
});
