// Keyboard use, the menu, the theme switch and the contact form in a real browser
import { test, expect } from "@playwright/test";
import { axe } from "./helpers.js";

test("the first tab stop is the skip link and it moves focus to the content", async ({ page }) => {
  await page.goto("/about");
  await page.keyboard.press("Tab");
  const skip = page.locator(".skip-link");
  await expect(skip).toBeFocused();
  await expect(skip).toBeVisible();
  await page.keyboard.press("Enter");
  await expect(page.locator("#main")).toBeFocused();
});

test("focus is always visible on links and buttons", async ({ page }) => {
  await page.goto("/");
  for (let i = 0; i < 8; i++) {
    await page.keyboard.press("Tab");
    const outline = await page.evaluate(() => {
      const el = document.activeElement;
      const style = getComputedStyle(el);
      return { tag: el.tagName, outline: style.outlineStyle, width: parseFloat(style.outlineWidth), shadow: style.boxShadow };
    });
    expect(outline.outline !== "none" && outline.width >= 2 || outline.shadow !== "none", JSON.stringify(outline)).toBeTruthy();
  }
});

test("the phone menu opens and closes with the keyboard", async ({ page }, testInfo) => {
  test.skip(!["phone", "phone-landscape"].includes(testInfo.project.name), "the menu button only exists on small screens");
  await page.goto("/");
  const button = page.locator("[data-menu-button]");
  await expect(button).toBeVisible();
  await expect(button).toHaveAttribute("aria-expanded", "false");
  await expect(page.locator("#site-nav-list")).toBeHidden();
  await button.focus();
  await page.keyboard.press("Enter");
  await expect(button).toHaveAttribute("aria-expanded", "true");
  await expect(page.getByRole("link", { name: "Projects" }).first()).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(button).toHaveAttribute("aria-expanded", "false");
  await expect(button).toBeFocused();
});

test("the theme switch flips the theme, says what it will do and remembers it", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "light" });
  await page.goto("/");
  const toggle = page.locator("[data-theme-toggle]");
  await expect(toggle).toHaveAttribute("aria-label", "Use the dark theme");
  await toggle.click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await expect(toggle).toHaveAttribute("aria-label", "Use the light theme");
  await page.goto("/about");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
});

test("the contact form shows its errors, then sends", async ({ page }) => {
  await page.goto("/contact");
  await page.fill("#field-name", "Ada Lovelace");
  await page.fill("#field-email", "not an email");
  await page.click("[data-submit]");
  const summary = page.locator("[data-error-summary]");
  await expect(summary).toBeVisible();
  await expect(summary).toBeFocused();
  await expect(page.locator("#field-email")).toHaveAttribute("aria-invalid", "true");
  await expect(page.locator("#field-name")).toHaveValue("Ada Lovelace");
  expect(await axe(page)).toEqual([]);

  // Following the link in the summary lands on the field
  await summary.getByRole("link", { name: /email address/ }).click();
  await expect(page.locator("#field-email")).toBeFocused();

  await page.fill("#field-email", "ada@example.org");
  await page.selectOption("#field-topic", "Something else");
  await page.fill("#field-message", "Hello Reece, this is a browser test of the contact form.");
  await expect(page.locator("[data-char-count]")).toContainText("characters left");
  await page.click("[data-submit]");
  await expect(page).toHaveURL(/\/contact\/thank-you$/);
  await expect(page.locator("h1")).toBeVisible();
});

test("without JavaScript every page still works", async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  for (const path of ["/", "/projects", "/about", "/contact"]) {
    const res = await page.goto(path);
    expect(res.status()).toBe(200);
    await expect(page.locator("h1")).toBeVisible();
    // Navigation links are reachable without the menu script
    await expect(page.locator(".site-nav__list a").first()).toBeVisible();
  }
  // The poster tree is shown instead of the live one
  await page.goto("/");
  await expect(page.locator(".grove__poster").first()).toBeVisible();
  await context.close();
});
