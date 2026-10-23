// Starts the site on a free port for scripts that need a real browser (posters, og images, the site checker).
// It uses the development config with no database, so nothing gets stored anywhere.
import { loadConfig } from "../../src/config/index.js";
import { createLogger } from "../../src/lib/logger.js";
import { createApp } from "../../src/app.js";

function pickFeatureFlags(source) {
  return Object.fromEntries(Object.entries(source).filter(([key]) => key.startsWith("FEATURE_")));
}

export async function startLocalServer({ env = "development", overrides = {} } = {}) {
  // Only the bits of the environment that matter here, so a .env with production values cant leak into a screenshot
  // SITE_DB_STORAGE and MEDIA_DIR let a screenshot run use a SQLite file with media in it, otherwise no database
  const base = loadConfig({
    env: { NODE_ENV: env, PORT: "3000", ...pickFeatureFlags(process.env), ...(process.env.MEDIA_DIR ? { MEDIA_DIR: process.env.MEDIA_DIR } : {}), ...(process.env.LEGAL_PHONE ? { LEGAL_PHONE: process.env.LEGAL_PHONE } : {}) },
    loadDotEnv: false
  });
  // Config is frozen, so a plain copy with the bits we need changed
  const database = process.env.SITE_DB_STORAGE
    ? { ...base.database, dialect: "sqlite", storage: process.env.SITE_DB_STORAGE }
    : { ...base.database, dialect: "none" };
  const config = { ...base, ...overrides, logLevel: "warn", database };
  const logger = createLogger({ ...config, logLevel: "silent" });
  const { app, prepare, stop } = createApp({ config, logger });
  // Loads the content from the SQLite file when theres one, without a database it just keeps the files
  await prepare();
  const server = await new Promise((resolve) => {
    const s = app.listen(0, "127.0.0.1", () => resolve(s));
  });
  const { port } = server.address();
  return {
    url: `http://127.0.0.1:${port}`,
    close: () => new Promise((resolve) => { stop(); server.close(resolve); })
  };
}

// Chromium that comes with the container or the one Playwright downloaded, whichever is there
export function chromiumOptions() {
  const options = { args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] };
  if (process.env.CHROMIUM_PATH) options.executablePath = process.env.CHROMIUM_PATH;
  return options;
}
