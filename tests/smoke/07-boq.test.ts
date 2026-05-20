import { test, expect, navigate, SS } from "../fixtures";

test.describe("Material BoQ section", () => {
  test.beforeEach(async ({ page }) => {
    await navigate(page, "/reports");
    await page.waitForTimeout(1000);
  });

  test("Reports page loads and project/author inputs are visible", async ({ page }) => {
    await expect(page.locator("main")).toContainText("Project");
    await expect(page.locator("main")).toContainText("Author");
    await page.screenshot({ path: SS("07-boq-initial") });
  });

  test("BoQ road length input is not visible without pavement data", async ({ page }) => {
    // BoQ section only renders when cbrResult or trhResult is present.
    // Fresh app has no pavement data, so road length input must not exist.
    const roadLengthLabel = page.getByLabel("Road length (km)");
    await expect(roadLengthLabel).not.toBeVisible();
    await page.screenshot({ path: SS("07-boq-hidden") });
  });

  test("BoQ section appears after running pavement calculation", async ({ page }) => {
    // Navigate to pavement page and run calculation to populate cbrResult
    await navigate(page, "/pavement");
    await page.waitForTimeout(500);
    await page.getByRole("button", { name: /compute/i }).first().click();
    await page.waitForTimeout(3000);

    // Now go back to reports
    await navigate(page, "/reports");
    await page.waitForTimeout(1000);

    // BoQ section should now be visible
    const roadLengthLabel = page.getByLabel("Road length (km)");
    await expect(roadLengthLabel).toBeVisible({ timeout: 5000 });
    await expect(page.locator("main")).toContainText("Material BoQ");
    await page.screenshot({ path: SS("07-boq-visible") });
  });

  test("Export BoQ CSV button works after running pavement calculation", async ({ page }) => {
    // Navigate to pavement page and run calculation to populate cbrResult
    await navigate(page, "/pavement");
    await page.waitForTimeout(500);
    await page.getByRole("button", { name: /compute/i }).first().click();
    await page.waitForTimeout(3000);

    // Now go back to reports
    await navigate(page, "/reports");
    await page.waitForTimeout(1000);

    // Export CSV button should be visible and clickable
    const csvBtn = page.getByRole("button", { name: /export csv/i });
    await expect(csvBtn).toBeVisible({ timeout: 5000 });
    await csvBtn.click();
    await expect(page.locator("body")).toContainText(/saved/i);
  });
});
