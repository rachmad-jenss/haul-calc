import { test, expect, navigate, seedStoreState } from "../fixtures";
import {
  parseSnapshot,
  storePatchFromSnapshot,
  type Snapshot,
} from "../../src/lib/project-file";

const SAMPLE_SENSITIVITY = {
  variable: "subgrade_cbr",
  metric: "total_thickness_mm",
  minValue: 2,
  maxValue: 20,
  steps: 5,
  perturbations: [
    { x: 2, y: 100 },
    { x: 11, y: 150 },
    { x: 20, y: 200 },
  ],
  stub: true,
  confidence: "medium" as const,
};

test.describe("DAS-290 PDF sensitivity section", () => {
  test("Reports enables sensitivity toggles when snapshot exists", async ({ page }) => {
    await seedStoreState(page, { sensitivitySnapshot: SAMPLE_SENSITIVITY });
    await navigate(page, "/reports");
    await expect(page.locator("#sec-sensitivity")).toBeEnabled();
    await expect(page.locator("#sec-chart-sensitivity")).toBeEnabled();
    await expect(page.getByText("Sensitivity run")).toBeVisible();
  });

  test("Reports disables sensitivity toggles without snapshot", async ({ page }) => {
    await seedStoreState(page, { sensitivitySnapshot: null });
    await navigate(page, "/reports");
    await expect(page.locator("#sec-sensitivity")).toBeDisabled();
    await expect(page.locator("#sec-chart-sensitivity")).toBeDisabled();
  });

  test("snapshot v4 round-trips sensitivitySnapshot through schema", () => {
    const snap: Snapshot = {
      version: 4,
      savedAt: new Date().toISOString(),
      fleet: [],
      designLifeYears: 10,
      cesaResult: null,
      subgradeCbr: 8,
      coverages: 72000,
      trhCategory: "B",
      cbrResult: null,
      trhResult: null,
      costScenarios: [],
      costResult: null,
      projectName: "Sens v4",
      authorName: "",
      reportSummary: null,
      sensitivitySnapshot: SAMPLE_SENSITIVITY,
    };
    const parsed = parseSnapshot(snap);
    expect(parsed.sensitivitySnapshot?.variable).toBe("subgrade_cbr");
    const patch = storePatchFromSnapshot(parsed);
    expect(patch.sensitivitySnapshot?.steps).toBe(5);
  });

  test("opening v2 snapshot clears sensitivitySnapshot in store patch", () => {
    const patch = storePatchFromSnapshot({
      version: 2,
      fleet: [],
      designLifeYears: 10,
      cesaResult: null,
      subgradeCbr: 8,
      coverages: 72000,
      trhCategory: "B",
      cbrResult: null,
      trhResult: null,
      costScenarios: [],
      costResult: null,
      projectName: "Legacy",
      authorName: "",
      reportSummary: null,
    });
    expect(patch.sensitivitySnapshot).toBeNull();
  });
});
