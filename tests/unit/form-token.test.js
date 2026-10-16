import { test } from "node:test";
import assert from "node:assert/strict";
import { createFormToken, verifyFormToken, hashIp } from "../../src/utils/form-token.js";

const SECRET = "a-test-secret-a-test-secret-a-test-secret";
const NOW = Date.UTC(2026, 9, 12, 12, 0, 0);

test("a token made earlier verifies and gives a stable submission id", () => {
  const token = createFormToken(SECRET, NOW - 10000);
  const result = verifyFormToken(token, SECRET, { now: NOW });
  assert.equal(result.ok, true);
  assert.equal(result.ageSeconds, 10);
  assert.match(result.submissionId, /^[\w-]{16}$/);
  assert.equal(verifyFormToken(token, SECRET, { now: NOW }).submissionId, result.submissionId);
});

test("two tokens never share a submission id", () => {
  const ids = new Set(Array.from({ length: 50 }, () => createFormToken(SECRET).split(".")[1]));
  assert.equal(ids.size, 50);
});

test("posting faster than a person could is refused", () => {
  const token = createFormToken(SECRET, NOW - 1000);
  assert.deepEqual(verifyFormToken(token, SECRET, { now: NOW, minSeconds: 3 }), { ok: false, reason: "too_fast" });
});

test("old tokens expire", () => {
  const token = createFormToken(SECRET, NOW - 2 * 86400000);
  assert.deepEqual(verifyFormToken(token, SECRET, { now: NOW }), { ok: false, reason: "expired" });
});

test("tampering and wrong secrets are caught", () => {
  const token = createFormToken(SECRET, NOW - 10000);
  const [time, id, sig] = token.split(".");
  assert.equal(verifyFormToken(`${Number(time) - 100}.${id}.${sig}`, SECRET, { now: NOW }).reason, "signature");
  assert.equal(verifyFormToken(token, "another-secret-another-secret-another", { now: NOW }).reason, "signature");
  assert.equal(verifyFormToken(`${time}.${id}.x`, SECRET, { now: NOW }).reason, "signature");
});

test("anything that isnt a token is malformed", () => {
  for (const value of [undefined, null, "", "abc", "1.2", "x.y.z", 42, ["a", "b"], "123.short.sig"]) {
    assert.equal(verifyFormToken(value, SECRET, { now: NOW }).reason, "malformed", String(value));
  }
});

test("ip hashes are stable, keyed and never the address", () => {
  const a = hashIp("203.0.113.7", SECRET);
  assert.equal(a, hashIp("203.0.113.7", SECRET));
  assert.notEqual(a, hashIp("203.0.113.8", SECRET));
  assert.notEqual(a, hashIp("203.0.113.7", "another-secret-another-secret-another"));
  assert.ok(!a.includes("203"));
  assert.equal(hashIp("", SECRET), null);
});
