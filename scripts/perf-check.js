// npm run perf:check: a lab measurement of the main pages on a throttled phone (4x slower CPU, about 1.6 Mbit/s and
// 150ms round trips), compared against the budgets below. Lab numbers, not field data: real visitors are measured
// by the Chrome UX report once the site is live. Run after `npm run build` so it measures the production assets.
import { chromium } from "playwright";
import { startLocalServer, chromiumOptions } from "./lib/local-server.js";

const BUDGET = { lcpMs: 2500, cls: 0.1, scriptKB: 30 };
const PAGES = ["/", "/about", "/projects", "/projects/microclimate-startup", "/contact"];

const server = await startLocalServer();
const browser = await chromium.launch(chromiumOptions());
let failed = 0;
try {
  for (const path of PAGES) {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    const page = await context.newPage();
    const cdp = await context.newCDPSession(page);
    await cdp.send("Network.enable");
    await cdp.send("Network.emulateNetworkConditions", { offline: false, latency: 150, downloadThroughput: 1.6 * 1024 * 1024 / 8, uploadThroughput: 750 * 1024 / 8 });
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
    let bytes = 0;
    let scriptBytes = 0;
    cdp.on("Network.loadingFinished", (e) => { bytes += e.encodedDataLength; });
    const scripts = new Set();
    cdp.on("Network.responseReceived", (e) => { if (e.type === "Script" && !e.response.url.includes("/vendor/")) scripts.add(e.requestId); });
    cdp.on("Network.loadingFinished", (e) => { if (scripts.has(e.requestId)) scriptBytes += e.encodedDataLength; });
    await page.addInitScript(() => {
      window.__lcp = 0; window.__cls = 0;
      new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__lcp = e.startTime; }).observe({ type: "largest-contentful-paint", buffered: true });
      new PerformanceObserver((l) => { for (const e of l.getEntries()) if (!e.hadRecentInput) window.__cls += e.value; }).observe({ type: "layout-shift", buffered: true });
    });
    await page.goto(server.url + path, { waitUntil: "load" });
    await page.waitForTimeout(1500);
    const { lcp, cls } = await page.evaluate(() => ({ lcp: window.__lcp, cls: window.__cls }));
    // three.js on the home page loads after the page is done (idle time) and is not part of the first load budget
    const firstKB = Math.round(bytes / 1024);
    const ok = lcp <= BUDGET.lcpMs && cls <= BUDGET.cls && scriptBytes / 1024 <= BUDGET.scriptKB;
    if (!ok) failed++;
    console.log(`${ok ? "ok  " : "OVER"} ${path.padEnd(32)} LCP ${Math.round(lcp)}ms  CLS ${cls.toFixed(3)}  transferred ${firstKB} KB (incl. late three.js on /)  own JS ${Math.round(scriptBytes / 1024)} KB`);
    await context.close();
  }
} finally {
  await browser.close();
  await server.close();
}
console.log(`\nBudgets: LCP ${BUDGET.lcpMs}ms, CLS ${BUDGET.cls}, own JavaScript ${BUDGET.scriptKB} KB compressed.`);
process.exitCode = failed ? 1 : 0;
