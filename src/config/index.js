// Loads and checks all the settings in one place. Everything else imports the finished object from here and never
// reads process.env itself, that way theres exactly one spot that knows where a setting comes from.
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { load as parseYaml } from "js-yaml";

export const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

const ENVIRONMENTS = ["development", "test", "production"];
const PLACEHOLDER_SECRET = "change-me-to-a-long-random-string";

export class ConfigError extends Error {
  /** @param {string[]} problems */
  constructor(problems) {
    super(`Invalid configuration:\n  - ${problems.join("\n  - ")}`);
    this.name = "ConfigError";
    this.problems = problems;
  }
}

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

/** Deep merge for plain objects, arrays and scalars from `override` replace whats in `base`. */
export function deepMerge(base, override) {
  if (!isPlainObject(base) || !isPlainObject(override)) return override === undefined ? base : override;
  const out = { ...base };
  for (const [key, value] of Object.entries(override)) {
    out[key] = isPlainObject(value) && isPlainObject(base[key]) ? deepMerge(base[key], value) : value;
  }
  return out;
}

function deepFreeze(object) {
  for (const value of Object.values(object)) {
    if (value && typeof value === "object" && !Object.isFrozen(value)) deepFreeze(value);
  }
  return Object.freeze(object);
}

function readBoolean(value, fallback) {
  if (value === undefined || value === "") return fallback;
  return ["1", "true", "yes", "on"].includes(String(value).toLowerCase());
}

function readInteger(value, fallback) {
  if (value === undefined || value === "") return fallback;
  const number = Number.parseInt(value, 10);
  return Number.isFinite(number) ? number : Number.NaN;
}

/** Strips the trailing slash so we can always do `${baseUrl}${path}` with paths that start with a slash */
function normaliseBaseUrl(value) {
  return String(value || "").trim().replace(/\/+$/, "");
}

function loadYamlFile(file) {
  const parsed = parseYaml(readFileSync(file, "utf8"));
  if (!isPlainObject(parsed)) throw new ConfigError([`${file} must contain a YAML mapping at the top level`]);
  return parsed;
}

/**
 * Builds the config from the YAML file plus environment variables.
 * @param {object} [options]
 * @param {NodeJS.ProcessEnv} [options.env] defaults to process.env, tests pass their own
 * @param {string} [options.yamlFile]
 * @param {boolean} [options.loadDotEnv] reads .env into process.env first (only when env is process.env)
 */
export function loadConfig({ env = process.env, yamlFile = path.join(ROOT_DIR, "config/application.yml"), loadDotEnv = true } = {}) {
  // Node 22 can read .env files on its own, so no dotenv package is needed. Real environment variables always win
  const dotEnvFile = path.join(ROOT_DIR, ".env");
  if (loadDotEnv && env === process.env && existsSync(dotEnvFile) && env.NODE_ENV !== "test") {
    process.loadEnvFile(dotEnvFile);
  }

  const nodeEnv = env.NODE_ENV || "development";
  const problems = [];
  if (!ENVIRONMENTS.includes(nodeEnv)) problems.push(`NODE_ENV must be one of ${ENVIRONMENTS.join(", ")}, got "${nodeEnv}"`);

  const yaml = loadYamlFile(yamlFile);
  const { environments = {}, ...shared } = yaml;
  const settings = deepMerge(shared, environments[nodeEnv] || {});

  const isProduction = nodeEnv === "production";
  const port = readInteger(env.PORT, 3000);
  const baseUrl = normaliseBaseUrl(env.BASE_URL || (isProduction ? "" : `http://localhost:${port}`));

  // Development and tests get SQLite out of the box so the contact form works without installing MySQL.
  // Production has no default on purpose, it has to be told
  const dbDialect = (env.DB_DIALECT || (isProduction ? "none" : "sqlite")).toLowerCase();
  const database = {
    dialect: dbDialect,
    host: env.DB_HOST || "127.0.0.1",
    port: readInteger(env.DB_PORT, 3306),
    name: env.DB_NAME || "",
    user: env.DB_USER || "",
    password: env.DB_PASSWORD || "",
    storage: env.DB_STORAGE || (nodeEnv === "test" ? ":memory:" : path.join(ROOT_DIR, "var/dev.sqlite")),
    pool: { max: readInteger(env.DB_POOL_MAX, 5), min: 0, acquire: 20000, idle: 10000 },
    ssl: readBoolean(env.DB_SSL, false),
    logQueries: readBoolean(env.DB_LOG_QUERIES, false)
  };

  const smtp = {
    host: env.SMTP_HOST || "",
    port: readInteger(env.SMTP_PORT, 587),
    secure: readBoolean(env.SMTP_SECURE, false),
    user: env.SMTP_USER || "",
    password: env.SMTP_PASSWORD || "",
    from: env.MAIL_FROM || "",
    // Proton Mail Bridge on the same server uses a self signed certificate. Only accepted when the host is this machine
    allowSelfSigned: readBoolean(env.SMTP_ALLOW_SELF_SIGNED, false),
    // Sending is only attempted when the host and the sender are both there, anything less is treated as not set up
    get configured() { return Boolean(this.host && this.from); }
  };

  const features = { ...settings.features };
  // Lets an environment switch a flag without editing YAML, for example FEATURE_TOOLS=true on a staging box
  for (const name of Object.keys(features)) {
    const fromEnv = env[`FEATURE_${name.toUpperCase()}`];
    if (fromEnv !== undefined) features[name] = readBoolean(fromEnv, features[name]);
  }

  // Version shown with every error report, so a crash can be matched to a deploy. RELEASE can be set to the git commit
  const packageVersion = JSON.parse(readFileSync(path.join(ROOT_DIR, "package.json"), "utf8")).version;
  // Signing in to /admin. Theres one person who can: the SimpleLogin account with the id in ADMIN_SIMPLELOGIN_ID
  // (SimpleLogin shows a Log in with Proton button, so a Proton account works), plus any passkeys added in the
  // admin afterwards. On your own computer theres also a one click development sign in, never anywhere else
  const admin = {
    simplelogin: {
      clientId: env.SIMPLELOGIN_CLIENT_ID || "",
      clientSecret: env.SIMPLELOGIN_CLIENT_SECRET || "",
      allowedId: env.ADMIN_SIMPLELOGIN_ID || "",
      issuer: "https://app.simplelogin.io",
      get configured() { return Boolean(this.clientId && this.clientSecret); }
    },
    // On in development unless ADMIN_DEV_LOGIN=false, in the tests only when asked for, in production never
    devLogin: (nodeEnv === "development" && readBoolean(env.ADMIN_DEV_LOGIN, true)) || (nodeEnv === "test" && readBoolean(env.ADMIN_DEV_LOGIN, false)),
    sessionDays: readInteger(env.ADMIN_SESSION_DAYS, 14),
    idleDays: readInteger(env.ADMIN_IDLE_DAYS, 3)
  };
  // Published content is committed to this repository from the admin. Without a token the sync is off, which is
  // right for your computer: there you pull from GitHub instead
  const github = {
    token: env.GITHUB_SYNC_TOKEN || "",
    repo: env.GITHUB_SYNC_REPO || "reece-barker/reecepage",
    branch: env.GITHUB_SYNC_BRANCH || "main"
  };
  const media = {
    dir: path.resolve(ROOT_DIR, env.MEDIA_DIR || "var/media"),
    maxImageBytes: readInteger(env.MEDIA_MAX_IMAGE_MB, 20) * 1048576,
    maxVideoBytes: readInteger(env.MEDIA_MAX_VIDEO_MB, 1024) * 1048576
  };

  const monitoring = {
    dsn: env.ERROR_DSN || "",
    release: env.RELEASE || `reece-page@${packageVersion}`,
    // Errors from visitors' browsers come in through POST /errors and are forwarded the same way
    browser: readBoolean(env.ERROR_REPORT_BROWSER, true)
  };

  const analyticsProvider = (env.ANALYTICS_PROVIDER || settings.analytics?.provider || "none").toLowerCase();

  const config = {
    env: nodeEnv,
    isProduction,
    isTest: nodeEnv === "test",
    isDevelopment: nodeEnv === "development",
    rootDir: ROOT_DIR,
    // Only this machine by default: nginx sits in front in production, and the development admin login must not be
    // reachable from the rest of the network. HOST=0.0.0.0 opens it up (Docker, testing on a phone)
    host: env.HOST || "127.0.0.1",
    port,
    baseUrl,
    // Number of proxies in front of the app (nginx, a load balancer). Needed so rate limits see the real visitor ip
    trustProxy: readInteger(env.TRUST_PROXY, 0),
    logLevel: env.LOG_LEVEL || settings.log_level || "info",
    appSecret: env.APP_SECRET || (isProduction ? "" : "development-only-secret-do-not-use-in-production-xxxxxxxx"),
    site: settings.site,
    navigation: settings.navigation,
    redirects: settings.redirects || {},
    features,
    contact: {
      ...settings.contact,
      notifyTo: env.CONTACT_NOTIFY_TO || settings.contact?.notify_to || settings.site?.email
    },
    analytics: { ...settings.analytics, provider: analyticsProvider },
    consent: settings.consent,
    legal: env.LEGAL_PHONE ? deepMerge(settings.legal, { owner: { phone: env.LEGAL_PHONE } }) : settings.legal,
    seo: settings.seo,
    database,
    smtp,
    monitoring,
    admin,
    github,
    media,
    paths: {
      views: path.join(ROOT_DIR, "views"),
      content: path.join(ROOT_DIR, "content"),
      public: path.join(ROOT_DIR, "public"),
      assetManifest: path.join(ROOT_DIR, "public/assets/manifest.json")
    }
  };

  problems.push(...validateConfig(config));
  if (problems.length) throw new ConfigError(problems);
  return deepFreeze(config);
}

/** Returns a list of human readable problems, empty when everything is fine. */
export function validateConfig(config) {
  const problems = [];
  const { isProduction } = config;

  if (!Number.isInteger(config.port) || config.port < 1 || config.port > 65535) problems.push("PORT must be a whole number between 1 and 65535");
  if (!Number.isInteger(config.trustProxy) || config.trustProxy < 0) problems.push("TRUST_PROXY must be 0 or a positive whole number (the number of proxies in front of the app)");

  let parsedBase = null;
  try { parsedBase = new URL(config.baseUrl); } catch { problems.push(`BASE_URL must be a full URL such as https://reece.page, got "${config.baseUrl}"`); }
  if (isProduction && parsedBase) {
    if (parsedBase.protocol !== "https:") problems.push("BASE_URL must use https in production");
    if (["localhost", "127.0.0.1", "0.0.0.0", "::1"].includes(parsedBase.hostname) || parsedBase.hostname.endsWith(".vercel.app")) {
      problems.push(`BASE_URL points at ${parsedBase.hostname}, production needs the real public domain (https://reece.page)`);
    }
  }

  if (isProduction && (config.appSecret.length < 32 || config.appSecret === PLACEHOLDER_SECRET)) {
    problems.push("APP_SECRET must be set to a random string of at least 32 characters in production (run: npm run secret)");
  }

  if (!["mysql", "sqlite", "none"].includes(config.database.dialect)) problems.push(`DB_DIALECT must be mysql, sqlite or none, got "${config.database.dialect}"`);
  if (config.database.dialect === "mysql") {
    for (const key of ["name", "user"]) if (!config.database[key]) problems.push(`DB_${key.toUpperCase()} is required when DB_DIALECT=mysql`);
  }
  if (isProduction && config.database.dialect === "sqlite") problems.push("DB_DIALECT=sqlite is only meant for tests and local development, use mysql in production");

  const wantsStorage = config.features.contact_form && config.contact.store_messages;
  if (isProduction && wantsStorage && config.database.dialect === "none") {
    problems.push("contact.store_messages is on but no database is configured. Set DB_DIALECT=mysql and the DB_* values, or switch store_messages off");
  }
  if (isProduction && config.features.contact_form && config.contact.send_notifications && !config.smtp.configured) {
    problems.push("contact.send_notifications is on but SMTP_HOST and MAIL_FROM are not set. Fill in the SMTP_* values or switch send_notifications off");
  }
  if (isProduction && config.features.contact_form && !config.contact.store_messages && !config.contact.send_notifications) {
    problems.push("The contact form is on but messages are neither stored nor emailed, so they would be lost");
  }

  if (!/^[\w.-]+\/[\w.-]+$/.test(config.github.repo)) problems.push("GITHUB_SYNC_REPO must look like owner/repository");
  if (!/^[\w./-]+$/.test(config.github.branch)) problems.push("GITHUB_SYNC_BRANCH is not a valid branch name");
  const sl = config.admin.simplelogin;
  if (Boolean(sl.clientId) !== Boolean(sl.clientSecret)) problems.push("SIMPLELOGIN_CLIENT_ID and SIMPLELOGIN_CLIENT_SECRET go together, one of them is missing");
  if (sl.allowedId && !/^[\w.-]{1,64}$/.test(sl.allowedId)) problems.push("ADMIN_SIMPLELOGIN_ID should be the id the sign in page showed you, a number like 1234");
  if (!Number.isInteger(config.admin.sessionDays) || config.admin.sessionDays < 1 || config.admin.sessionDays > 90) problems.push("ADMIN_SESSION_DAYS must be between 1 and 90");
  if (!Number.isInteger(config.admin.idleDays) || config.admin.idleDays < 1 || config.admin.idleDays > config.admin.sessionDays) problems.push("ADMIN_IDLE_DAYS must be at least 1 and no more than ADMIN_SESSION_DAYS");

  if (config.smtp.allowSelfSigned && !["127.0.0.1", "localhost", "::1"].includes(config.smtp.host)) {
    problems.push("SMTP_ALLOW_SELF_SIGNED only works with a mail bridge on this machine (SMTP_HOST=127.0.0.1)");
  }

  if (!["none", "plausible", "umami"].includes(config.analytics.provider)) problems.push(`analytics.provider must be none, plausible or umami, got "${config.analytics.provider}"`);
  if (config.features.analytics && config.analytics.provider === "umami" && (!config.analytics.umami?.website_id || !config.analytics.umami?.script_url)) {
    problems.push("Umami analytics needs analytics.umami.website_id and analytics.umami.script_url");
  }

  // The legal pages read these, publishing them half empty is worse than not starting at all
  if (isProduction) {
    const owner = config.legal?.owner || {};
    for (const key of ["name", "street", "postcode", "city", "country", "email"]) {
      if (!owner[key]) problems.push(`legal.owner.${key} must be filled in for the impressum`);
    }
    if (owner.show_phone && !owner.phone) problems.push("legal.owner.show_phone is on but LEGAL_PHONE is not set");
    if (!config.legal?.hosting?.name || !config.legal?.hosting?.server_location) {
      problems.push("legal.hosting.name and legal.hosting.server_location must be filled in, the privacy policy names the host");
    }
    if (!config.legal?.third_country_transfer?.en || !config.legal?.third_country_transfer?.de) {
      problems.push("legal.third_country_transfer.en and .de must say whether data leave the EEA (the privacy policy prints them)");
    }
    if (config.contact.send_notifications && !config.legal?.mail_provider?.name) {
      problems.push("legal.mail_provider.name must be filled in, the privacy policy names the email provider");
    }
  }

  return problems;
}
