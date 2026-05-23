import path from "node:path";
import { test, expect, navigate } from "../fixtures";

test.describe("CSV import trips_per_day validation (DAS-135)", () => {
  test.beforeEach(async ({ page }) => {
    await navigate(page, "/fleet");
    await page.waitForTimeout(500);
  });

  test("rejects CSV rows with trips_per_day=0", async ({ page }) => {
    await page.getByRole("button", { name: /import csv/i }).click();
    const csvPath = path.resolve("tests/fixtures/fleet-zero-trips.csv");
    await page.locator('input[type="file"]').setInputFiles(csvPath);
    await expect(page.getByText(/trips_per_day must be at least 1/i)).toBeVisible();
    await expect(page.getByRole("dialog").getByRole("button", { name: "Import" })).toBeDisabled();
  });
});
