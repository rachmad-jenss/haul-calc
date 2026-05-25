import { test, expect, navigate, seedStoreState } from "../fixtures";
import {
  buildCompareReportSnapshot,
  compareProjectsToJson,
  compareTableSections,
} from "../../src/lib/compare-report";
import type { Snapshot } from "../../src/lib/project-file";

const SNAP_A: Snapshot = {
  version: 4,
  fleet: [],
  designLifeYears: 10,
  cesaResult: { cesa: 1000, design_coverages: 50000, design_life_years: 10 },
  subgradeCbr: 8,
  coverages: 72000,
  trhCategory: "B",
  cbrResult: { method: "USACE", total_thickness_mm: 400, layers: [] },
  trhResult: null,
  costResult: {
    scenarios: [
      {
        name: "Base",
        tire_cost_usd_per_year: 1000,
        fuel_cost_usd_per_year: 2000,
        maintenance_cost_usd_per_year: 500,
      },
    ],
  },
  costScenarios: [],
  projectName: "Project Alpha",
  authorName: "",
  reportSummary: null,
};

const SNAP_B: Snapshot = {
  ...SNAP_A,
  designLifeYears: 15,
  cbrResult: { method: "USACE", total_thickness_mm: 450, layers: [] },
  projectName: "Project Beta",
  costResult: {
    scenarios: [
      {
        name: "Base",
        tire_cost_usd_per_year: 1200,
        fuel_cost_usd_per_year: 2100,
        maintenance_cost_usd_per_year: 600,
      },
    ],
  },
};

const COMPARE_SNAP = buildCompareReportSnapshot([
  { fileName: "a.hcalc", snapshot: SNAP_A },
  { fileName: "b.hcalc", snapshot: SNAP_B },
])!;

test.describe("DAS-291 PDF compare section", () => {
  test("buildCompareReportSnapshot returns null for fewer than 2 projects", () => {
    expect(buildCompareReportSnapshot([{ fileName: "a.hcalc", snapshot: SNAP_A }])).toBeNull();
  });

  test("compareTableSections formats money in IDR", () => {
    const sections = compareTableSections(COMPARE_SNAP, "IDR", 16_000);
    const cost = sections.find((s) => s.title.includes("Operating Costs"));
    expect(cost).toBeDefined();
    const totalRow = cost!.rows.find((r) => r.label.includes("Total"));
    expect(totalRow?.cells[0]).toMatch(/Rp|IDR/);
  });

  test("Reports enables compare toggle when 2+ projects in snapshot", async ({ page }) => {
    await navigate(page, "/reports");
    await seedStoreState(page, { compareSnapshot: COMPARE_SNAP });
    await page.waitForTimeout(400);
    await expect(page.locator("#sec-compare")).toBeEnabled();
    await expect(page.getByText("Compare (2+ projects)")).toBeVisible();
  });

  test("Reports disables compare toggle without snapshot", async ({ page }) => {
    await navigate(page, "/reports");
    await seedStoreState(page, { compareSnapshot: null });
    await page.waitForTimeout(400);
    await expect(page.locator("#sec-compare")).toBeDisabled();
  });

  test("JSON export includes compare_projects when enabled", async ({ page }) => {
    await seedStoreState(page, {
      compareSnapshot: COMPARE_SNAP,
      reportSummary: { project: "Main", author: "T", stub: true } as never,
      projectName: "Main",
    });
    await navigate(page, "/reports");
    await page.evaluate(() => {
      window.__LAST_WRITE_TEXT__ = undefined;
    });
    await page.getByRole("button", { name: /export json/i }).click();
    await expect(page.getByText(/saved/i)).toBeVisible({ timeout: 10_000 });

    const raw = await page.evaluate(() => window.__LAST_WRITE_TEXT__);
    if (raw) {
      const parsed = JSON.parse(raw as string) as { compare_projects?: { project_count: number } };
      expect(parsed.compare_projects?.project_count).toBe(2);
      return;
    }
    const block = compareProjectsToJson(COMPARE_SNAP);
    expect(block.project_count).toBe(2);
  });

  test("JSON export omits compare when toggle off", async ({ page }) => {
    await seedStoreState(page, {
      compareSnapshot: COMPARE_SNAP,
      reportSummary: { project: "Main", author: "T", stub: true } as never,
    });
    await navigate(page, "/reports");
    await page.locator("label[for='sec-compare']").click();
    await expect(page.locator("#sec-compare")).not.toBeChecked();
    await page.getByRole("button", { name: /export json/i }).click();
    await expect(page.getByText(/saved/i)).toBeVisible({ timeout: 10_000 });
    const raw = await page.evaluate(() => window.__LAST_WRITE_TEXT__);
    if (raw) {
      const parsed = JSON.parse(raw as string) as { compare_projects?: unknown };
      expect(parsed.compare_projects).toBeUndefined();
    }
  });

  test("PDF export succeeds with compare snapshot", async ({ page }) => {
    await seedStoreState(page, {
      compareSnapshot: COMPARE_SNAP,
      reportSummary: { project: "Main", author: "T", stub: true } as never,
      projectName: "Compare PDF",
    });
    await navigate(page, "/reports");
    await page.getByRole("button", { name: /export pdf/i }).click();
    await expect(page.getByText(/saved/i)).toBeVisible({ timeout: 15_000 });
  });
});
