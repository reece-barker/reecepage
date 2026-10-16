// Every page in every project (phone, tablet, desktop, phone landscape) and both themes:
// no accessibility violations, no console errors, nothing wider than the screen
import { test, expect } from "@playwright/test";
import { PAGES, axe, watchConsole, setTheme } from "./helpers.js";

for (const path of PAGES) {
  for (const theme of ["light", "dark"]) {
    test(`${path} in ${theme} is accessible and clean`, async ({ page }) => {
      const errors = watchConsole(page);
      await page.emulateMedia({ colorScheme: theme, reducedMotion: "reduce" });
      await page.goto(path);
      await setTheme(page, theme);
      // Reveals and lazy bits: scroll through once so everything is in its final state
      await page.evaluate(async () => {
        for (let y = 0; y < document.body.scrollHeight; y += 500) { window.scrollTo(0, y); await new Promise((r) => setTimeout(r, 30)); }
        window.scrollTo(0, 0);
      });

      const violations = await axe(page);
      expect(violations, JSON.stringify(violations, null, 2)).toEqual([]);

      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow, "no sideways scrolling").toBeLessThanOrEqual(0);

      expect(errors, errors.join("\n")).toEqual([]);
    });
  }
}

test("the tree comes alive on the home page and the poster steps aside", async ({ page, browserName }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "once is enough");
  const errors = watchConsole(page);
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute("data-tree-ready", "true", { timeout: 15000 });
  await expect(page.locator("[data-tree-stage]")).toHaveClass(/is-live/);
  expect(errors).toEqual([]);
  expect(browserName).toBe("chromium");
});

test("with reduced motion the tree still draws, once", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "once is enough");
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute("data-tree-ready", "true", { timeout: 15000 });
});
