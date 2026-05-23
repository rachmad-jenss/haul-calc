import path from "node:path";
import { test, expect, navigate } from "../fixtures";

test.describe("CSV import valid rows (DAS-135 manual)", () => {
  test.beforeEach(async ({ page }) => {
    await navigate(page, "/fleet");
    await page.waitForTimeout(500);
  });

  test("imports valid CSV and replaces fleet rows", async ({ page }) => {
    await page.getByRole("button", { name: /import csv/i }).click();
    const csvPath = path.resolve("tests/fixtures/fleet-valid.csv");
    await page.locator('input[type="file"]').setInputFiles(csvPath);
    await expect(page.getByText(/2 rows ready to import/i)).toBeVisible();
    await page.getByRole("dialog").getByRole("button", { name: /import 2 rows/i }).click();
    await expect(page.getByText(/imported 2 fleet rows/i)).toBeVisible();
    await expect(page.locator("table tbody tr")).toHaveCount(2);
  });
});
