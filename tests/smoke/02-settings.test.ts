import { test, expect, navigate, SS } from "../fixtures";

test.describe("Settings page", () => {
  test.beforeEach(async ({ page }) => {
    await navigate(page, "/settings");
    await page.waitForTimeout(2000);
  });

  test("shows sidecar status rows", async ({ page }) => {
    await expect(page.locator("main")).toContainText("Bridge process");
    await expect(page.locator("main")).toContainText("haul-pave loaded");
    await expect(page.locator("main")).toContainText("Bridge version");
    await page.screenshot({ path: SS("02-settings") });
  });

  test("shows a version string for bridge", async ({ page }) => {
    const text = await page.locator("main").textContent();
    expect(text).toMatch(/\d+\.\d+/);
  });
});
