import { test, expect, navigate } from "../fixtures";

test.describe("DAS-139 corrupt .hcalc open", () => {
  test("invalid project file shows error toast instead of blank screen", async ({ page }) => {
    await page.addInitScript(() => {
      window.__HAULCALC_OPEN_JSON__ = JSON.stringify({ version: 1, designLifeYears: 10 });
    });
    await page.reload();
    await page.goto("/#/dashboard");
    await page.waitForTimeout(400);
    await page.getByTitle(/open project/i).click();
    await expect(page.locator("body")).toContainText(/open failed/i, { timeout: 10_000 });
    await expect(page.locator("body")).toContainText(/file tidak valid/i);
    await expect(page.locator("main")).toBeVisible();
    await expect(page.getByRole("heading", { name: /something went wrong/i })).toHaveCount(0);
  });
});
