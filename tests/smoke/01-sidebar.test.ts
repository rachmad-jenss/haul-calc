import { test, expect, navigate, SS } from "../fixtures";

test.describe("Sidebar navigation", () => {
  test("shows all nav items", async ({ page }) => {
    const nav = page.locator("nav");
    await expect(nav).toContainText("Fleet & Traffic");
    await expect(nav).toContainText("Pavement Design");
    await expect(nav).toContainText("Economics");
    await expect(nav).toContainText("Reports");
    await expect(nav).toContainText("Settings");
    await page.screenshot({ path: SS("01-sidebar") });
  });

  test("navigates to each page without crash", async ({ page }) => {
    for (const route of ["/dashboard", "/fleet", "/pavement", "/economics", "/reports", "/sensitivity", "/settings"]) {
      await navigate(page, route);
      await expect(page.locator("main")).toBeVisible();
    }
    await page.screenshot({ path: SS("01-nav-all") });
  });
});
