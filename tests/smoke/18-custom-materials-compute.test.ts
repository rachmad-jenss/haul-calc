import { test, expect, navigate, seedStoreState } from "../fixtures";

test.describe("DAS-163 custom materials in pavement compute", () => {
  test.beforeEach(async ({ page }) => {
    await seedStoreState(page, {
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
      coverages: 72000,
    });
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
