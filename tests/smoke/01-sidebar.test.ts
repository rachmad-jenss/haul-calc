import { test, expect, navigate, SS } from "../fixtures";

test.describe("Sidebar navigation", () => {
  test("shows all 5 nav items", async ({ page }) => {
    const nav = page.locator("nav");
    await expect(nav).toContainText("Fleet & Traffic");
    await expect(nav).toContainText("Pavement Design");
    await expect(nav).toContainText("Economics");
    await expect(nav).toContainText("Reports");
    await expect(nav).toContainText("Settings");
    await page.screenshot({ path: SS("01-sidebar") });
  });

  test("navigates to each page without crash", async ({ page }) => {
    for (const route of ["/pavement", "/economics", "/reports", "/settings", "/fleet"]) {
      await navigate(page, route);
      await expect(page.locator("main")).toBeVisible();
    }
    await page.screenshot({ path: SS("01-nav-all") });
  });
});
