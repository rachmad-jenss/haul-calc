import { test, expect } from "../fixtures";
import { navigate } from "../fixtures";

const STORE_KEY = "haul-calc-store";

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
      coverages: 72000,
      trhCategory: "B",
      cbrResult: null,
      trhResult: null,
      pavementDirty: false,
      customMaterials: [],
      costScenarios: [],
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

test.describe("DAS-163 custom materials in pavement compute", () => {
  test.beforeEach(async ({ page }) => {
    await page.evaluate(
      ({ key, payload }) => {
        localStorage.setItem(key, JSON.stringify(payload));
      },
      {
        key: STORE_KEY,
        payload: persistPayload({
          customMaterials: [
            {
              id: "mat-test-1",
              name: "Site gravel base",
              material_type: "granular",
              elastic_modulus_mpa: 150,
              cbr_percent: 25,
              poisson_ratio: 0.35,
              layer_coefficient: null,
              thickness_mm: null,
              description: "E2E custom",
            },
          ],
        }),
      },
    );
    await page.reload();
    await page.waitForTimeout(1200);
    await navigate(page, "/pavement");
  });

  test("compute thickness shows custom material layer names", async ({ page }) => {
    await page.getByRole("button", { name: /Compute thickness/i }).click();
    await expect(page.getByTestId("pavement-total-thickness")).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByText("Site gravel base")).toBeVisible();
  });

  test("run comparison keeps form coverages and shows results", async ({ page }) => {
    await page.getByRole("tab", { name: "Compare" }).click();
    await page.getByRole("button", { name: /Run comparison/i }).click();
    await expect(page.getByTestId("compare-usace-thickness-mm")).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByTestId("compare-trh14-thickness-mm")).toBeVisible();
  });
});
