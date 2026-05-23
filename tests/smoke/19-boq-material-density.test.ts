import { test, expect } from "@playwright/test";
import { computeBoq, densityForLayer, DENSITY_BY_MATERIAL_TYPE } from "@/lib/boq";

const GEOMETRY = { roadLengthKm: 1, roadWidthM: 8, shoulderWidthM: 1.5 };

test.describe("DAS-164 BoQ material_type density", () => {
  test("densityForLayer uses material_type when set", () => {
    expect(
      densityForLayer({
        name: "Site gravel base",
        thickness_mm: 200,
        cbr: 25,
        material_type: "granular",
      }),
    ).toBe(DENSITY_BY_MATERIAL_TYPE.granular);
    expect(
      densityForLayer({
        name: "Custom wearing",
        thickness_mm: 100,
        cbr: null,
        material_type: "asphalt",
      }),
    ).toBe(DENSITY_BY_MATERIAL_TYPE.asphalt);
  });

  test("computeBoq preserves custom layer names in export rows", () => {
    const rows = computeBoq(
      [
        {
          name: "Crusher run",
          thickness_mm: 300,
          cbr: 30,
          material_type: "granular",
        },
        {
          name: "AC wearing",
          thickness_mm: 80,
          cbr: null,
          material_type: "asphalt",
        },
      ],
      GEOMETRY,
    );
    expect(rows).toHaveLength(2);
    expect(rows[0].layer).toBe("Crusher run");
    expect(rows[0].densityTm3).toBe(2.0);
    expect(rows[1].layer).toBe("AC wearing");
    expect(rows[1].densityTm3).toBe(2.3);
  });

  test("name-based fallback still works without material_type", () => {
    expect(
      densityForLayer({ name: "Sub-base", thickness_mm: 100, cbr: 10 }),
    ).toBe(2.0);
  });
});
