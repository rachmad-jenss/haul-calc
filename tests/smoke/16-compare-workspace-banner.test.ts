import { test, expect } from "../fixtures";

const STORE_KEY = "haul-calc-store";

function persistPayload(overrides: Record<string, unknown>) {
  return {
    version: 8,
    state: {
      fleet: [],
      designLifeYears: 10,
      workingDaysPerYear: 250,
      projectName: "Test",
      activeFileName: null,
      activeFilePath: null,
      recentFiles: [],
      ...overrides,
    },
  };
}

async function seedPersistAndReload(
  page: import("@playwright/test").Page,
  overrides: Record<string, unknown>,
) {
  await page.evaluate(
    ({ key, payload }) => {
      localStorage.setItem(key, JSON.stringify(payload));
    },
    { key: STORE_KEY, payload: persistPayload(overrides) },
  );
  await page.reload();
  await expect(page.locator("main")).toBeVisible({ timeout: 15_000 });
}

test.describe("Compare page workspace isolation (DAS-140)", () => {
  test("shows read-only banner and bound workspace file name", async ({ page }) => {
    await page.goto("/#/compare");
    await seedPersistAndReload(page, {
      activeFileName: "audit-project.hcalc",
      activeFilePath: "C:/Users/test/audit-project.hcalc",
    });
    await expect(page.getByText(/read-only comparison/i)).toBeVisible();
    await expect(page.getByText(/Save \(Ctrl\+S\) still applies to/i)).toContainText("audit-project.hcalc");
    await expect(page.getByText(/does not change your active project/i)).toBeVisible();
  });

  test("banner explains no bound project when path is empty", async ({ page }) => {
    await page.goto("/#/compare");
    await seedPersistAndReload(page, {
      activeFileName: null,
      activeFilePath: null,
      recentFiles: [],
    });
    await expect(page.getByText(/no project file is bound/i)).toBeVisible();
  });
});
