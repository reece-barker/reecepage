// The admin in a real browser: sign in, write a post with blocks, switch to Markdown and back, publish it and see
// it on the site. Also that the admin pages have no accessibility problems and no console errors (the content
// security policy is stricter than most, a blocked style or script shows up here)
import { test, expect } from "@playwright/test";
import { axe, watchConsole } from "./helpers.js";

// Desktop and phone are enough for the admin, the tablet sizes dont add anything here
test.beforeEach(() => {
  const name = test.info().project.name;
  test.skip(name !== "desktop" && name !== "phone", "desktop and phone are enough");
});

async function signIn(page) {
  await page.goto("/admin/login");
  await page.getByRole("button", { name: "Development sign in" }).click();
  await expect(page).toHaveURL(/\/admin$/);
}

test("write, switch to Markdown and back, publish, and see it on the site", async ({ page }) => {
  test.skip(test.info().project.name !== "desktop", "once is enough");
  const errors = watchConsole(page);
  await signIn(page);
  await page.goto("/admin/writing/new");
  await page.waitForSelector(".ce-paragraph");
  const title = `End to end post ${Date.now().toString(36)}`;
  await page.fill("[data-title]", title);
  await page.click(".ce-paragraph");
  await page.keyboard.type("Written in the browser test.");
  await page.keyboard.press("Enter");
  await page.waitForTimeout(300);
  await page.keyboard.press("/");
  await page.waitForSelector(".ce-popover--opened .ce-popover__container");
  await page.keyboard.type("Callout", { delay: 20 });
  await page.keyboard.press("Enter");
  await page.click(".rp-callout__body");
  await page.keyboard.type("A note in a callout.");

  await page.getByRole("button", { name: "Markdown" }).click();
  await expect(page.locator(".studio__markdown")).toHaveValue(/Written in the browser test\.\n\n:::note\nA note in a callout\.\n:::/);
  await page.getByRole("button", { name: "Blocks" }).click();
  await expect(page.locator(".rp-callout__body")).toHaveText("A note in a callout.");

  await page.click('[data-side-tab="details"]');
  await page.getByLabel("Summary").fill("A post made by the end to end test");
  await page.click('[data-action="publish"]');
  await expect(page.locator("[data-status]")).toHaveText(/Published/);
  await expect(page).toHaveURL(/\/admin\/writing\/\d+$/);

  const slug = title.toLowerCase().replace(/ /g, "-");
  await page.goto(`/writing/${slug}`);
  await expect(page.locator("h1")).toHaveText(title);
  await expect(page.locator(".callout--note")).toContainText("A note in a callout.");
  expect(errors).toEqual([]);
});

for (const path of ["/admin", "/admin/writing", "/admin/writing/new", "/admin/lists/timeline", "/admin/lists/settings", "/admin/account", "/admin/library", "/admin/system", "/admin/paperwork", "/admin/lists/business"]) {
  test(`${path} is accessible and clean`, async ({ page }) => {
    const errors = watchConsole(page);
    await signIn(page);
    await page.goto(path);
    if (path.endsWith("/new")) await page.waitForSelector(".ce-paragraph");
    const violations = await axe(page);
    expect(violations, JSON.stringify(violations, null, 2)).toEqual([]);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow, "no sideways scrolling").toBeLessThanOrEqual(0);
    expect(errors, errors.join("\n")).toEqual([]);
  });
}

test("a contract: the facts change the page, the clauses write out and stay editable", async ({ page }) => {
  test.skip(test.info().project.name !== "desktop", "once is enough");
  const errors = watchConsole(page);
  await signIn(page);
  await page.goto("/admin/paperwork");
  await page.getByLabel("Type of contract").selectOption("sale");
  await page.getByRole("button", { name: "New contract" }).click();
  await expect(page).toHaveURL(/\/admin\/paperwork\/\d+$/);
  await page.getByLabel("Item").fill("A bike from the end to end test");
  const frame = page.frameLocator("[data-preview-frame]");
  await expect(frame.locator(".doc--contract")).toContainText("A bike from the end to end test");
  await expect(page.locator("[data-status]")).toHaveText("Saved", { timeout: 8000 });
  await page.getByRole("button", { name: "Write out the clauses" }).click();
  await expect(page.locator("[data-status]")).toHaveText("Saved", { timeout: 8000 });
  await expect(page.locator(".editor-item").first()).toBeVisible();
  expect(await axe(page)).toEqual([]);
  expect(errors).toEqual([]);
});

test("a business card and the email signature: the preview follows and the signature copies", async ({ page, context }) => {
  test.skip(test.info().project.name !== "desktop", "once is enough");
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  const errors = watchConsole(page);
  await signIn(page);
  await page.goto("/admin/paperwork");
  await page.getByRole("button", { name: "New business card" }).click();
  await expect(page).toHaveURL(/\/admin\/paperwork\/\d+$/);
  await page.getByLabel("Line under the name").fill("End to end tester");
  const frame = page.frameLocator("[data-preview-frame]");
  await expect(frame.locator(".card__role")).toHaveText("End to end tester");
  await page.getByLabel("Design").selectOption("white");
  await expect(frame.locator(".card--front img")).toHaveAttribute("src", /long-horizontal-colour/);
  await expect(page.locator("[data-status]")).toHaveText("Saved", { timeout: 8000 });
  expect(await axe(page)).toEqual([]);

  await page.goto("/admin/paperwork");
  await page.getByRole("button", { name: "New email signature" }).click();
  await expect(page).toHaveURL(/\/admin\/paperwork\/\d+$/);
  await expect(frame.locator(".sig__mail table")).toBeVisible();
  await page.getByRole("button", { name: "Copy signature" }).click();
  await expect(page.locator("[data-status]")).toContainText("Signature copied");
  expect(await page.evaluate(() => navigator.clipboard.readText())).toMatch(/^-- \n/);
  expect(errors).toEqual([]);
});

test("a letter: type, the preview follows, and the editor page is accessible", async ({ page }) => {
  test.skip(test.info().project.name !== "desktop", "once is enough");
  const errors = watchConsole(page);
  await signIn(page);
  await page.goto("/admin/paperwork");
  await page.getByRole("button", { name: "New letter" }).click();
  await expect(page).toHaveURL(/\/admin\/paperwork\/\d+$/);
  await page.getByLabel("Subject").fill("A letter from the end to end test");
  const frame = page.frameLocator("[data-preview-frame]");
  await expect(frame.locator(".din-subject")).toHaveText("A letter from the end to end test");
  await expect(page.locator("[data-status]")).toHaveText("Saved", { timeout: 8000 });
  expect(await axe(page)).toEqual([]);
  expect(errors).toEqual([]);
});
