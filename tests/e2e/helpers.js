// Shared bits for the browser tests
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const AXE_SOURCE = readFileSync(require.resolve("axe-core/axe.min.js"), "utf8");

export const PAGES = ["/", "/about", "/projects", "/projects/microclimate-startup", "/writing", "/writing/how-this-site-is-built",
  "/contact", "/media", "/cv", "/references", "/status", "/impressum", "/privacy", "/terms", "/cookies", "/accessibility", "/copyright", "/does-not-exist"];

/**
 * Runs axe in the page. page.evaluate is not bound by the page's CSP, so axe can run on the real, strict site.
 * Returns the violations at WCAG 2.2 AA, with enough detail to fix them.
 */
export async function axe(page) {
  await page.evaluate(AXE_SOURCE);
  return page.evaluate(async () => {
    const result = await window.axe.run(document, {
      runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa", "best-practice"] },
      resultTypes: ["violations"]
    });
    return result.violations.map((v) => ({
      id: v.id,
      impact: v.impact,
      help: v.help,
      nodes: v.nodes.slice(0, 5).map((n) => `${n.target.join(" ")}: ${n.failureSummary?.split("\n")[1]?.trim() || ""}`)
    }));
  });
}

/** Collects console errors and page errors. Expected 404 resource messages on the 404 page are ignored */
export function watchConsole(page) {
  const errors = [];
  page.on("console", (msg) => {
    if (msg.type() !== "error") return;
    const text = msg.text();
    if (/status of 404/.test(text) && /does-not-exist/.test(page.url())) return;
    errors.push(text);
  });
  page.on("pageerror", (error) => errors.push(error.message));
  return errors;
}

export async function setTheme(page, theme) {
  await page.evaluate((value) => {
    document.documentElement.dataset.theme = value;
    document.dispatchEvent(new CustomEvent("themechange", { detail: { theme: value } }));
  }, theme);
}
