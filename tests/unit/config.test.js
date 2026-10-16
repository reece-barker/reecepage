import { test } from "node:test";
import assert from "node:assert/strict";
import { loadConfig, ConfigError, deepMerge } from "../../src/config/index.js";

const load = (env) => loadConfig({ env, loadDotEnv: false });

test("development works with no environment at all", () => {
  const config = load({});
  assert.equal(config.env, "development");
  assert.equal(config.baseUrl, "http://localhost:3000");
  assert.equal(config.database.dialect, "sqlite");
  assert.match(config.database.storage, /var\/dev\.sqlite$/);
  assert.ok(Object.isFrozen(config));
  assert.ok(Object.isFrozen(config.site));
});

test("test env defaults to in memory sqlite and the test overrides from the yaml", () => {
  const config = load({ NODE_ENV: "test" });
  assert.equal(config.database.dialect, "sqlite");
  assert.equal(config.database.storage, ":memory:");
  assert.equal(config.contact.min_seconds_to_submit, 0);
  // deep merged, so the bits the test section doesnt mention are kept
  assert.equal(config.contact.retention_days, 365);
});

test("unknown NODE_ENV is refused", () => {
  assert.throws(() => load({ NODE_ENV: "staging" }), ConfigError);
});

test("production refuses an empty or unsafe setup and lists every problem", () => {
  let error;
  try { load({ NODE_ENV: "production" }); } catch (e) { error = e; }
  assert.ok(error instanceof ConfigError);
  const text = error.problems.join("\n");
  assert.match(text, /BASE_URL/);
  assert.match(text, /APP_SECRET/);
  assert.match(text, /no database is configured/);
  assert.match(text, /SMTP_HOST/);
  assert.match(text, /LEGAL_PHONE/);
});

test("production refuses plain http, localhost and vercel previews", () => {
  for (const url of ["http://reece.page", "https://localhost", "https://reece-page.vercel.app"]) {
    try {
      load({ NODE_ENV: "production", BASE_URL: url });
      assert.fail("should have thrown");
    } catch (error) {
      assert.ok(error.problems.some((p) => p.includes("BASE_URL")), url);
    }
  }
});

test("production refuses sqlite and a short secret", () => {
  try {
    load({ NODE_ENV: "production", BASE_URL: "https://reece.page", APP_SECRET: "short", DB_DIALECT: "sqlite" });
    assert.fail("should have thrown");
  } catch (error) {
    assert.ok(error.problems.some((p) => p.includes("sqlite")));
    assert.ok(error.problems.some((p) => p.includes("APP_SECRET")));
  }
});

test("mysql needs a name and a user", () => {
  assert.throws(() => load({ DB_DIALECT: "mysql" }), /DB_NAME is required/);
});

test("feature flags can be switched from the environment", () => {
  assert.equal(load({}).features.tools, false);
  assert.equal(load({ FEATURE_TOOLS: "true" }).features.tools, true);
  assert.equal(load({ FEATURE_WRITING: "0" }).features.writing, false);
});

test("trailing slashes come off BASE_URL", () => {
  assert.equal(load({ BASE_URL: "http://example.test:8080///" }).baseUrl, "http://example.test:8080");
});

test("the phone number only comes from the environment", () => {
  assert.equal(load({}).legal.owner.phone, "");
  assert.equal(load({ LEGAL_PHONE: "+49 000 0000000" }).legal.owner.phone, "+49 000 0000000");
});

test("bad numbers are reported, not silently replaced", () => {
  assert.throws(() => load({ PORT: "abc" }), /PORT/);
  assert.throws(() => load({ TRUST_PROXY: "-1" }), /TRUST_PROXY/);
});

test("deepMerge merges objects and replaces arrays", () => {
  assert.deepEqual(deepMerge({ a: { b: 1, c: [1, 2] } }, { a: { c: [3] } }), { a: { b: 1, c: [3] } });
  assert.equal(deepMerge({ a: 1 }, undefined).a, 1);
});

test("a bad admin hash and a self signed certificate on a remote host are refused", () => {
  assert.throws(() => load({ ADMIN_PASSWORD_HASH: "hunter2" }), /ADMIN_PASSWORD_HASH/);
  assert.throws(() => load({ SMTP_HOST: "smtp.example.test", SMTP_ALLOW_SELF_SIGNED: "true" }), /SMTP_ALLOW_SELF_SIGNED/);
  assert.equal(load({ SMTP_HOST: "127.0.0.1", SMTP_ALLOW_SELF_SIGNED: "true" }).smtp.allowSelfSigned, true);
});
