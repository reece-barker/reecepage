// End to end tests in a real browser: every page at phone, tablet and desktop sizes, both themes, keyboard use,
// axe accessibility checks and console errors. The web server is the real app, started with the test settings.
//
//   npm run build:dev && npm run test:e2e
//
// On a machine without Playwright's own Chromium, point CHROMIUM_PATH at any Chromium or Chrome binary.
import { defineConfig, devices } from "@playwright/test";

const PORT = Number(process.env.E2E_PORT || 4123);
const launchOptions = process.env.CHROMIUM_PATH
  ? { executablePath: process.env.CHROMIUM_PATH, args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] }
  : { args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] };

export default defineConfig({
  testDir: "tests/e2e",
  outputDir: "test-results",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  timeout: 30000,
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    trace: "retain-on-failure",
    launchOptions
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 }, launchOptions } },
    { name: "tablet", use: { ...devices["Desktop Chrome"], viewport: { width: 820, height: 1180 }, hasTouch: true, launchOptions } },
    { name: "phone", use: { ...devices["Desktop Chrome"], viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2, launchOptions } },
    { name: "phone-landscape", use: { ...devices["Desktop Chrome"], viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true, launchOptions } }
  ],
  webServer: {
    command: "node --disable-warning=ExperimentalWarning src/server.js",
    url: `http://127.0.0.1:${PORT}/health`,
    reuseExistingServer: !process.env.CI,
    timeout: 30000,
    env: {
      NODE_ENV: "test",
      PORT: String(PORT),
      HOST: "127.0.0.1",
      BASE_URL: `http://127.0.0.1:${PORT}`,
      DB_DIALECT: "sqlite",
      DB_STORAGE: ":memory:",
      ADMIN_DEV_LOGIN: "true",
      LOG_LEVEL: "silent"
    }
  }
});
