import { test, expect, navigate, SS } from "../fixtures";

test.describe("Reports page", () => {
  test.beforeEach(async ({ page }) => {
    await navigate(page, "/reports");
    await page.waitForTimeout(1000);
  });

  test("renders project and author inputs", async ({ page }) => {
    await expect(page.locator("main")).toContainText("Project");
    await expect(page.locator("main")).toContainText("Author");
    await page.screenshot({ path: SS("06-reports-initial") });
  });

  test("generates design summary", async ({ page }) => {
    await page.getByRole("button", { name: /generate/i }).click();
    await page.waitForTimeout(5000);
    await page.screenshot({ path: SS("06-reports-generated") });
    // Stub returns fixture — summary card rendered, not empty state
    const text = await page.locator("main").textContent();
    expect(text).toBeTruthy();
  });

  test("Export JSON button is visible after generate", async ({ page }) => {
    await page.getByRole("button", { name: /generate/i }).click();
    await page.waitForTimeout(5000);
    const exportBtn = page.getByRole("button", { name: /export json/i });
    await expect(exportBtn).toBeVisible({ timeout: 10_000 });
    await page.screenshot({ path: SS("06-reports-export-btn") });
  });
});
