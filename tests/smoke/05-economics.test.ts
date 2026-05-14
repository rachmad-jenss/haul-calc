import { test, expect, navigate, SS } from "../fixtures";

test.describe("Economics page", () => {
  test.beforeEach(async ({ page }) => {
    await navigate(page, "/economics");
    await page.waitForTimeout(1000);
  });

  test("renders default scenarios", async ({ page }) => {
    await expect(page.locator("main")).toContainText("Asphalt");
    await expect(page.locator("main")).toContainText("Gravel");
    await page.screenshot({ path: SS("05-economics-initial") });
  });

  test("compare renders SVG chart", async ({ page }) => {
    await page.getByRole("button", { name: /compare/i }).click();
    await expect(page.locator("svg.recharts-surface").first()).toBeVisible({ timeout: 15_000 });
    await page.screenshot({ path: SS("05-economics-chart") });
  });

  test("Export PNG button absent before compare, visible after", async ({ page }) => {
    // No results yet — button must not exist
    await expect(page.getByRole("button", { name: /export png/i })).toHaveCount(0);

    // Run comparison, then button must appear
    await page.getByRole("button", { name: /compare/i }).click();
    await expect(page.locator("svg.recharts-surface").first()).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole("button", { name: /export png/i })).toBeVisible();
    await page.screenshot({ path: SS("05-economics-export-btn") });
  });

  test("add scenario increases card count", async ({ page }) => {
    // Scenarios are rendered as div cards, not table rows
    const before = await page.locator("[class*='rounded'][class*='border'][class*='p-3']").count();
    await page.getByRole("button", { name: /add/i }).first().click();
    await page.waitForTimeout(300);
    const after = await page.locator("[class*='rounded'][class*='border'][class*='p-3']").count();
    expect(after).toBeGreaterThan(before);
    await page.screenshot({ path: SS("05-economics-added") });
  });
});
