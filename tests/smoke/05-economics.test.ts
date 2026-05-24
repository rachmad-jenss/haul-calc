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

  test("Export CSV button absent before compare, visible and functional after in Opex Tab", async ({ page }) => {
    await expect(page.getByRole("button", { name: /export csv/i })).toHaveCount(0);
    await page.getByRole("button", { name: /compare/i }).click();
    await expect(page.locator("svg.recharts-surface").first()).toBeVisible({ timeout: 15_000 });
    const csvBtn = page.getByRole("button", { name: /export csv/i });
    await expect(csvBtn).toBeVisible();
    await csvBtn.click();
    await expect(page.locator("body")).toContainText(/saved/i);
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

  // ---------- LCCA tab ----------

  test("LCCA tab renders discount rate and analysis period fields", async ({ page }) => {
    await page.getByRole("tab", { name: /lcca/i }).click();
    await page.waitForTimeout(300);
    await expect(page.getByText(/discount rate/i)).toBeVisible();
    await expect(page.getByText(/analysis period/i)).toBeVisible();
    await page.screenshot({ path: SS("05-lcca-initial") });
  });

  test("LCCA tab shows scenario cost inputs synced from Operating Cost scenarios", async ({ page }) => {
    await page.getByRole("tab", { name: /lcca/i }).click();
    await page.waitForTimeout(300);
    // Default scenarios are "Asphalt 100 mm" and "Gravel 250 mm"
    await expect(page.getByText(/asphalt/i).first()).toBeVisible();
    await expect(page.getByText(/gravel/i).first()).toBeVisible();
    await page.screenshot({ path: SS("05-lcca-scenarios") });
  });

  test("LCCA Compute shows NPV results table and charts", async ({ page }) => {
    await page.getByRole("tab", { name: /lcca/i }).click();
    await page.waitForTimeout(300);
    await page.getByRole("button", { name: /compute lcca/i }).click();
    await page.waitForTimeout(500);
    // Results table heading
    await expect(page.getByText(/lcca results/i)).toBeVisible();
    // NPV column header (use role to avoid strict-mode collision with chart legend/badge)
    await expect(
      page.getByRole("columnheader", { name: "NPV", exact: true }),
    ).toBeVisible();
    // Charts rendered
    await expect(page.locator("svg.recharts-surface").first()).toBeVisible({ timeout: 10_000 });
    await page.screenshot({ path: SS("05-lcca-results") });
  });

  test("LCCA Compute shows Export CSV button and works", async ({ page }) => {
    await page.getByRole("tab", { name: /lcca/i }).click();
    await page.waitForTimeout(300);
    // Export CSV button should be absent initially
    await expect(page.getByRole("button", { name: /export csv/i })).toHaveCount(0);
    await page.getByRole("button", { name: /compute lcca/i }).click();
    await page.waitForTimeout(500);
    const csvBtn = page.getByRole("button", { name: /export csv/i });
    await expect(csvBtn).toBeVisible();
    await csvBtn.click();
    await expect(page.locator("body")).toContainText(/saved/i);
  });
});
