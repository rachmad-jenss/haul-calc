import { test, expect } from "../fixtures";

const STORE_KEY = "haul-calc-store";

/** Minimal persisted slice so the app boots after localStorage seeding. */
function persistPayload(overrides: Record<string, unknown>) {
  return {
    version: 8,
    state: {
      fleet: [
        { _id: "t1", vehicle_id: "cat-797f", count: 8, trips_per_day: 22, payload_kn: 4000 },
      ],
      designLifeYears: 10,
      workingDaysPerYear: 250,
      cesaResult: null,
      cesaDirty: false,
      subgradeCbr: 8,
      coverages: 1_050_000,
      trhCategory: "B",
      cbrResult: null,
      trhResult: null,
      pavementDirty: false,
      costScenarios: [
        {
          _id: "s1",
          name: "Asphalt",
          surface: "asphalt",
          thickness_mm: 100,
          haul_distance_km: 5,
          trips_per_day: 200,
        },
      ],
      costResult: null,
      economicsDirty: false,
      lccaInputs: { discountRate: 0.1, analysisPeriodYears: 20, scenarios: [] },
      lccaResult: null,
      customVehicles: [],
      projectName: "Test",
      authorName: "",
      reportSummary: null,
      theme: "system",
      autoCheckUpdates: true,
      unitSystem: "SI",
      boqGeometry: { roadLengthKm: 1, roadWidthM: 8, shoulderWidthM: 1.5 },
      isProjectDirty: false,
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
  await page.waitForTimeout(1500);
}

test.describe("Save file binding (DAS-127)", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/#/dashboard");
    await page.waitForTimeout(500);
  });

  test("sidebar hides orphan filename after rehydrate desync", async ({ page }) => {
    await seedPersistAndReload(page, {
      activeFileName: "ghost.hcalc",
      activeFilePath: null,
      isProjectDirty: true,
      recentFiles: [],
    });

    await expect(page.locator("aside")).not.toContainText("ghost.hcalc");
  });

  test("sidebar shows filename when activeFilePath is persisted", async ({ page }) => {
    await seedPersistAndReload(page, {
      activeFileName: "real-project.hcalc",
      activeFilePath: "C:/Users/test/real-project.hcalc",
      isProjectDirty: true,
    });

    await expect(page.locator("aside")).toContainText("real-project");
  });

  test("rehydrate heals path from recentFiles when name matches", async ({ page }) => {
    await seedPersistAndReload(page, {
      activeFileName: "real-project.hcalc",
      activeFilePath: null,
      recentFiles: ["C:/Users/test/real-project.hcalc"],
      isProjectDirty: true,
    });

    await expect(page.locator("aside")).toContainText("real-project", { timeout: 10_000 });
  });
});
