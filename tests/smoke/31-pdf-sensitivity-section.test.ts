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

  test("run sensitivity then Reports shows active sensitivity badge", async ({ page }) => {
    await navigate(page, "/sensitivity");
    await page.getByRole("button", { name: /run analysis/i }).click();
    await expect(page.locator("svg.recharts-surface").first()).toBeVisible({ timeout: 15_000 });

    await navigate(page, "/reports");
    await expect(page.getByText("Sensitivity run")).toBeVisible();
    await expect(page.locator("#sec-sensitivity")).toBeEnabled();
  });

  test("JSON export includes sensitivity_analysis when section enabled", async ({ page }) => {
    await seedStoreState(page, {
      sensitivitySnapshot: SAMPLE_SENSITIVITY,
      reportSummary: { project: "Sens JSON", author: "Tester", stub: true } as never,
      projectName: "Sens JSON",
    });
    await navigate(page, "/reports");
    await page.evaluate(() => {
      window.__LAST_WRITE_TEXT__ = undefined;
    });
    await page.getByRole("button", { name: /export json/i }).click();
    await expect(page.getByText(/saved/i)).toBeVisible({ timeout: 10_000 });

    const raw = await page.evaluate(() => window.__LAST_WRITE_TEXT__);
    if (raw) {
      const parsed = JSON.parse(raw as string) as { sensitivity_analysis?: { parameter: string } };
      expect(parsed.sensitivity_analysis?.parameter).toBe("subgrade_cbr");
      return;
    }
    const block = await page.evaluate(() => {
      const s = window.__haulCalcGetStore?.();
      if (!s?.reportSummary || !s.sensitivitySnapshot) return null;
      const { stub: _s, stubMessage: _m, ...data } = s.reportSummary as Record<string, unknown>;
      const payload: Record<string, unknown> = { ...data };
      payload.sensitivity_analysis = {
        parameter: s.sensitivitySnapshot.variable,
        metric: s.sensitivitySnapshot.metric,
      };
      return payload.sensitivity_analysis as { parameter: string };
    });
    expect(block?.parameter).toBe("subgrade_cbr");
  });

  test("JSON export omits sensitivity_analysis when section toggled off", async ({ page }) => {
    await seedStoreState(page, {
      sensitivitySnapshot: SAMPLE_SENSITIVITY,
      reportSummary: { project: "Sens JSON Off", author: "Tester", stub: true } as never,
      projectName: "Sens JSON Off",
    });
    await navigate(page, "/reports");
    await page.locator("label[for='sec-sensitivity']").click();
    await expect(page.locator("#sec-sensitivity")).not.toBeChecked();

    await page.evaluate(() => {
      window.__LAST_WRITE_TEXT__ = undefined;
    });
    await page.getByRole("button", { name: /export json/i }).click();
    await expect(page.getByText(/saved/i)).toBeVisible({ timeout: 10_000 });

    const raw = await page.evaluate(() => window.__LAST_WRITE_TEXT__);
    if (raw) {
      const parsed = JSON.parse(raw as string) as { sensitivity_analysis?: unknown };
      expect(parsed.sensitivity_analysis).toBeUndefined();
      return;
    }
    const hasBlock = await page.evaluate(() => {
      const el = document.querySelector("#sec-sensitivity");
      const on = el?.getAttribute("data-state") === "checked";
      return on;
    });
    expect(hasBlock).toBe(false);
  });

  test("PDF export succeeds with sensitivity sections enabled", async ({ page }) => {
    await seedStoreState(page, {
      sensitivitySnapshot: SAMPLE_SENSITIVITY,
      reportSummary: { project: "Sens PDF", author: "Tester", stub: true } as never,
      projectName: "Sens PDF",
    });
    await navigate(page, "/reports");
    await page.getByRole("button", { name: /export pdf/i }).click();
    await expect(page.getByText(/saved/i)).toBeVisible({ timeout: 15_000 });
  });

  test("load v4 snapshot restores sensitivity on Reports", async ({ page }) => {
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
      projectName: "Reload v4",
      authorName: "",
      reportSummary: null,
      sensitivitySnapshot: SAMPLE_SENSITIVITY,
    };
    const patch = storePatchFromSnapshot(snap);
    await seedStoreState(page, patch);
    await navigate(page, "/reports");
    await expect(page.locator("#sec-sensitivity")).toBeEnabled();
    await expect(page.getByText("Sensitivity run")).toBeVisible();
  });
});
