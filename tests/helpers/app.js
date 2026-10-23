// Builds a fresh app for a test: test config, an in memory SQLite database with the real migrations, and a fake mail
// transport that just remembers what it was asked to send. Nothing leaves the machine.
import { loadConfig, deepMerge } from "../../src/config/index.js";
import { createLogger } from "../../src/lib/logger.js";
import { createApp } from "../../src/app.js";
import { createDatabase } from "../../src/database/index.js";
import { createMigrator } from "../../src/database/migrator.js";

export const TEST_SECRET = "test-secret-that-is-long-enough-for-the-checks-0123456789";

/** Config for tests, `env` adds or overrides environment variables, `patch` deep merges into the finished object */
export function testConfig({ env = {}, patch = {} } = {}) {
  const base = loadConfig({
    env: { NODE_ENV: "test", APP_SECRET: TEST_SECRET, BASE_URL: "http://localhost:3000", SMTP_HOST: "", MAIL_FROM: "test@reece.page", ...env },
    loadDotEnv: false
  });
  // Config comes back frozen, tests get a thawed copy they can bend. smtp.configured is a getter so it is rebuilt
  const plain = JSON.parse(JSON.stringify(base));
  plain.smtp.configured = Boolean(plain.smtp.host && plain.smtp.from);
  return deepMerge(plain, patch);
}

export class FakeTransport {
  constructor({ fail = false } = {}) {
    this.sent = [];
    this.fail = fail;
  }
  async sendMail(message) {
    if (this.fail) {
      const error = new Error("connect ECONNREFUSED 127.0.0.1:587");
      error.code = "ECONNECTION";
      throw error;
    }
    this.sent.push(message);
    return { messageId: `<fake-${this.sent.length}@test>` };
  }
}

/**
 * In memory SQLite by default. TEST_DB_DIALECT=mysql runs the same tests on a real MySQL server with the DB_* values
 * from the environment (setup-mysql.command on the Mac does that). Never point it at a database you care about,
 * every test empties it.
 */
export function testDatabaseSettings(config) {
  if (process.env.TEST_DB_DIALECT === "mysql") {
    if (!/test/.test(process.env.DB_NAME || "")) throw new Error("TEST_DB_DIALECT=mysql needs a DB_NAME with 'test' in it, the tests empty that database");
    return {
      ...config.database,
      dialect: "mysql",
      host: process.env.DB_HOST || "127.0.0.1",
      port: Number(process.env.DB_PORT || 3306),
      name: process.env.DB_NAME,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD || "",
      pool: { max: 2, min: 0, acquire: 20000, idle: 5000 }
    };
  }
  return { ...config.database, dialect: "sqlite", storage: ":memory:" };
}

/**
 * @param {object} [options]
 * @param {object} [options.config] from testConfig()
 * @param {boolean} [options.withDatabase] default true
 * @param {FakeTransport | null} [options.transport] null means no mail at all
 */
export async function buildTestApp({ config = testConfig(), withDatabase = true, transport = new FakeTransport(), errorReporter, fetch: fetchImpl } = {}) {
  const logger = createLogger({ ...config, logLevel: "silent" });
  let database = null;
  if (withDatabase) {
    database = createDatabase({ ...config, database: testDatabaseSettings(config) }, logger);
    const migrator = createMigrator(database, null);
    // MySQL keeps its tables between tests, so every app starts from an empty schema. SQLite in memory always does
    if (database.dialect === "mysql") await migrator.down({ to: 0 });
    await migrator.up();
  }
  const { app, services, prepare, stop } = createApp({ config, logger, database, mailTransport: transport || undefined, errorReporter, fetch: fetchImpl });
  await prepare();
  return {
    app,
    services,
    config,
    transport,
    database,
    async close() { stop(); await database?.close(); }
  };
}

/** Pulls a hidden input's value out of a page */
export function hiddenValue(html, name) {
  const match = new RegExp(`name="${name}"[^>]*value="([^"]*)"`).exec(html) || new RegExp(`value="([^"]*)"[^>]*name="${name}"`).exec(html);
  return match ? match[1].replace(/&#x3D;/g, "=").replace(/&amp;/g, "&") : null;
}

/** The cookies a response set, as a single Cookie header for the next request */
export function cookieHeader(response) {
  return (response.headers["set-cookie"] || []).map((cookie) => cookie.split(";")[0]).join("; ");
}

/**
 * Signs in with the development sign in (the config needs admin.devLogin, see adminConfig) and returns the Cookie
 * header to send with admin requests and the CSRF token for posting
 */
export async function signIn(app) {
  const { default: request } = await import("supertest");
  const page = await request(app).get("/admin/login").expect(200);
  const first = cookieHeader(page);
  const csrf = hiddenValue(page.text, "_csrf");
  const res = await request(app).post("/admin/login/dev").set("Cookie", first).type("form").send({ _csrf: csrf, next: "/admin" }).expect(303);
  const cookie = [first, cookieHeader(res)].filter(Boolean).join("; ");
  return { cookie, csrf };
}

/** Test config with the development sign in switched on, which is normally only there in development */
export function adminConfig(options = {}) {
  const config = testConfig(options);
  config.admin.devLogin = true;
  return config;
}
