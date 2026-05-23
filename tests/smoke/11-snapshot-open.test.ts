import { test, expect, navigate } from "../fixtures";
import {
  parseSnapshot,
  storePatchFromSnapshot,
  type Snapshot,
} from "../../src/lib/project-file";
import type { CalcStore } from "../../src/lib/store";

const STORE_KEY = "haul-calc-store";

/** Zustand persist blob (v9) — same pattern as 08-save-binding.test.ts */
function persistPayloadFromPatch(
  patch: Partial<CalcStore>,
  file: { activeFileName: string; activeFilePath: string },
) {
  return {
    version: 9,
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
      customMaterials: [],
      projectName: "Test",
      authorName: "",
      reportSummary: null,
      theme: "system",
      autoCheckUpdates: true,
      unitSystem: "SI",
      boqGeometry: { roadLengthKm: 1, roadWidthM: 8, shoulderWidthM: 1.5 },
      activeFileName: null,
      activeFilePath: null,
      recentFiles: [],
      ...patch,
      ...file,
    },
  };
}

const V2_SNAPSHOT: Snapshot = {
  version: 2,
  savedAt: new Date().toISOString(),
  fleet: [
    { _id: "f1", vehicle_id: "cat-797f", count: 4, trips_per_day: 12, payload_kn: 4000 },
  ],
  designLifeYears: 10,
  workingDaysPerYear: 300,
  customVehicles: [
    { id: "custom-snap-1", name: "Snapshot Hauler", gvw_kn: 5000, axles: 4 },
  ],
  cesaResult: null,
  subgradeCbr: 8,
  coverages: 72000,
  trhCategory: "B",
  cbrResult: null,
  trhResult: null,
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
  lccaInputs: { discountRate: 0.08, analysisPeriodYears: 15, scenarios: [] },
  lccaResult: null,
  boqGeometry: { roadLengthKm: 2, roadWidthM: 10, shoulderWidthM: 2 },
  unitSystem: "SI",
  cesaDirty: false,
  pavementDirty: false,
  economicsDirty: false,
  projectName: "Snapshot V2 Roundtrip",
  authorName: "",
  reportSummary: null,
};

const V1_SNAPSHOT: Snapshot = {
  version: 1,
  savedAt: new Date().toISOString(),
  fleet: V2_SNAPSHOT.fleet,
  designLifeYears: 10,
  cesaResult: null,
  subgradeCbr: 8,
  coverages: 72000,
  trhCategory: "B",
  cbrResult: null,
  trhResult: null,
  costScenarios: V2_SNAPSHOT.costScenarios,
  costResult: null,
  projectName: "Legacy V1 Project",
  authorName: "",
  reportSummary: null,
};

test.describe("DAS-131 snapshot parsing", () => {
  test("parseSnapshot accepts JSON object from readTextFile", () => {
    const snap = parseSnapshot(V2_SNAPSHOT);
    expect(snap.projectName).toBe("Snapshot V2 Roundtrip");
  });

  test("storePatchFromSnapshot v2 preserves extended fields", () => {
    const patch = storePatchFromSnapshot(V2_SNAPSHOT);
    expect(patch.workingDaysPerYear).toBe(300);
    expect(patch.customVehicles?.[0]?.name).toBe("Snapshot Hauler");
    expect(patch.boqGeometry?.roadLengthKm).toBe(2);
  });

  test("storePatchFromSnapshot v1 applies defaults for new fields", () => {
    const patch = storePatchFromSnapshot(V1_SNAPSHOT);
    expect(patch.workingDaysPerYear).toBe(250);
    expect(patch.customVehicles).toEqual([]);
    expect(patch.unitSystem).toBe("SI");
  });
});

async function applySnapshotInBrowser(
  page: import("@playwright/test").Page,
  snap: Snapshot,
) {
  const patch = storePatchFromSnapshot(snap);
  const file = { activeFileName: "mock.hcalc", activeFilePath: "C:/mock/mock.hcalc" };
  await page.evaluate(
    ({ key, payload }) => {
      localStorage.setItem(key, JSON.stringify(payload));
    },
    {
      key: STORE_KEY,
      payload: persistPayloadFromPatch(patch, file),
    },
  );
  await page.reload();
  await page.waitForTimeout(800);
}

test.describe("DAS-131 snapshot v2 in UI", () => {
  test("loadFromSnapshot restores custom vehicle and working days", async ({ page }) => {
    await navigate(page, "/dashboard");
    await applySnapshotInBrowser(page, V2_SNAPSHOT);

    await expect(page.locator("main")).toContainText("Snapshot V2 Roundtrip");
    await navigate(page, "/fleet");
    await page.getByRole("button", { name: /custom vehicles/i }).click();
    const dialog = page.getByRole("dialog", { name: /custom vehicles/i });
    await expect(dialog.getByText(/Snapshot Hauler — 5000 kN/)).toBeVisible();
    await expect(page.locator("#working-days")).toHaveValue("300");
  });
});

test.describe("DAS-133 undo cleared after load", () => {
  test("Ctrl+Z after loadFromSnapshot does not restore pre-load fleet edits", async ({ page }) => {
    await navigate(page, "/fleet");
    const tripsInput = page.locator("table tbody tr").first().getByRole("spinbutton").nth(1);
    await tripsInput.fill("99");
    await expect(tripsInput).toHaveValue("99");

    await applySnapshotInBrowser(page, {
      ...V2_SNAPSHOT,
      projectName: "Opened File",
    });

    const tripsAfterLoad = page.locator("table tbody tr").first().getByRole("spinbutton").nth(1);
    await expect(tripsAfterLoad).toHaveValue("12");

    await page.keyboard.press("Control+Z");
    await page.waitForTimeout(300);
    await expect(tripsAfterLoad).toHaveValue("12");
  });
});
