import { test, expect, navigate, seedStoreState } from "../fixtures";
import type { LccaInputs } from "../../src/lib/store";

const BREAK_EVEN_LCCA: LccaInputs = {
  discountRate: 0,
  analysisPeriodYears: 10,
  scenarios: [
    {
      _id: "a",
      name: "High upfront",
      constructionCostUsd: 5000,
      resurfacingCostUsd: 0,
      resurfacingIntervalYears: 0,
    },
    {
      _id: "b",
      name: "Low upfront + annual",
      constructionCostUsd: 1000,
      resurfacingCostUsd: 1000,
      resurfacingIntervalYears: 1,
    },
  ],
};

test.describe("DAS-141 LCCA break-even in UI", () => {
  test("shows break-even year when two scenarios cross", async ({ page }) => {
    await navigate(page, "/economics");
    await seedStoreState(page, {
      costScenarios: BREAK_EVEN_LCCA.scenarios.map((s) => ({
        _id: s._id,
        name: s.name,
        surface: "asphalt" as const,
        thickness_mm: 100,
        haul_distance_km: 5,
        trips_per_day: 10,
      })),
      lccaInputs: BREAK_EVEN_LCCA,
    });

    await page.getByRole("tab", { name: /lcca/i }).click();
    await page.getByRole("button", { name: /compute lcca/i }).click();
    await expect(page.getByText(/break-even at year 4/i)).toBeVisible({ timeout: 10_000 });
  });
});
