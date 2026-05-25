import { test, expect, seedStoreState } from "../fixtures";

test.describe("Compare page workspace isolation (DAS-140)", () => {
  test("shows read-only banner and bound workspace file name", async ({ page }) => {
    await page.goto("/#/compare");
    await seedStoreState(page, {
      activeFileName: "audit-project.hcalc",
      activeFilePath: "C:/Users/test/audit-project.hcalc",
    });
    await expect(page.getByText(/read-only comparison/i)).toBeVisible();
    await expect(page.getByText(/Save \(Ctrl\+S\) still applies to/i)).toContainText("audit-project.hcalc");
    await expect(page.getByText(/do not change your active project/i)).toBeVisible();
  });

  test("banner explains no bound project when path is empty", async ({ page }) => {
    await page.goto("/#/compare");
    await seedStoreState(page, {
      activeFileName: null,
      activeFilePath: null,
      recentFiles: [],
    });
    await expect(page.getByText(/no project file is bound/i)).toBeVisible();
  });
});
