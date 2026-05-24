import { test, expect, navigate } from "../fixtures";

test.describe("Visual identity sprint smoke (DAS-236)", () => {
  test("loads shell with Google Sans Flex and visible nav", async ({ page }) => {
    const fontFamily = await page.evaluate(() => getComputedStyle(document.body).fontFamily);
    expect(fontFamily.toLowerCase()).toContain("google sans flex");

    const nav = page.locator("nav");
    await expect(nav).toBeVisible();
    await expect(nav).toContainText("Fleet & Traffic");
    await expect(page.locator("main")).toBeVisible();
  });

  test("sidebar navigates core routes without crash", async ({ page }) => {
    for (const route of [
      "/dashboard",
      "/fleet",
      "/pavement",
      "/economics",
      "/reports",
      "/settings",
    ]) {
      await navigate(page, route);
      await expect(page.locator("main")).toBeVisible();
    }
  });

  test("theme toggle cycles light, dark, and system without crash", async ({ page }) => {
    const toggle = page.getByRole("button", {
      name: /light mode|dark mode|system theme/i,
    });
    await expect(toggle).toBeVisible();

    const labels: string[] = [];
    for (let i = 0; i < 3; i++) {
      labels.push((await toggle.getAttribute("aria-label")) ?? "");
      await toggle.click();
      await expect(page.locator("main")).toBeVisible();
    }

    expect(labels.some((l) => /light mode/i.test(l))).toBe(true);
    expect(labels.some((l) => /dark mode/i.test(l))).toBe(true);
    expect(labels.some((l) => /system theme/i.test(l))).toBe(true);
  });

  test("custom vehicles dialog opens and closes from fleet", async ({ page }) => {
    await navigate(page, "/fleet");
    await page.getByRole("button", { name: /custom vehicles/i }).click();

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
  });
});
