import { test, expect, navigate, SS } from "../fixtures";

test.describe("Fleet & Traffic page", () => {
  test.beforeEach(async ({ page }) => {
    await navigate(page, "/fleet");
    await page.waitForTimeout(1000);
  });

  test("renders fleet table with default rows", async ({ page }) => {
    const rows = page.locator("table tbody tr");
    await expect(rows).toHaveCount(2);
    await page.screenshot({ path: SS("03-fleet-initial") });
  });

  test("computes CESA and shows result", async ({ page }) => {
    await page.getByRole("button", { name: /compute cesa/i }).click();
    await expect(page.locator("main")).toContainText("Design coverages", { timeout: 15_000 });
    await expect(page.locator("main")).toContainText("Design life");
    await page.screenshot({ path: SS("03-fleet-result") });
  });

  test("shows stub banner after compute", async ({ page }) => {
    await page.getByRole("button", { name: /compute cesa/i }).click();
    await page.waitForTimeout(5000);
    const text = await page.locator("main").textContent();
    expect(text?.toLowerCase()).toMatch(/stub|fixture|not yet/);
    await page.screenshot({ path: SS("03-fleet-stub-banner") });
  });
});
