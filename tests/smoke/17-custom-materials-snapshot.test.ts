import { test, expect } from "../fixtures";
import { storePatchFromSnapshot } from "@/lib/project-file";
import type { Snapshot } from "@/lib/project-file";

const V3_SNAPSHOT: Snapshot = {
  version: 3,
  savedAt: new Date().toISOString(),
  fleet: [],
  designLifeYears: 10,
  subgradeCbr: 8,
  coverages: 72000,
  trhCategory: "B",
  cbrResult: null,
  trhResult: null,
  costScenarios: [],
  costResult: null,
  projectName: "Materials v3",
  authorName: "",
  reportSummary: null,
  customMaterials: [
    {
      id: "mat-test-1",
      name: "Site gravel",
      material_type: "granular",
      elastic_modulus_mpa: 120,
      cbr_percent: 10,
      poisson_ratio: 0.35,
      layer_coefficient: null,
      thickness_mm: null,
      description: "",
    },
  ],
};

test.describe("DAS-160 custom materials snapshot v3", () => {
  test("storePatchFromSnapshot v3 restores customMaterials", () => {
    const patch = storePatchFromSnapshot(V3_SNAPSHOT);
    expect(patch.customMaterials).toHaveLength(1);
    expect(patch.customMaterials?.[0]?.name).toBe("Site gravel");
  });

  test("storePatchFromSnapshot v2 defaults customMaterials to empty", () => {
    const patch = storePatchFromSnapshot({ ...V3_SNAPSHOT, version: 2, customMaterials: undefined });
    expect(patch.customMaterials).toEqual([]);
  });
});
