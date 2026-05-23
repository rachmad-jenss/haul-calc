import { test, expect } from "../fixtures";
import { computeLcca, findBreakEvenYear } from "../../src/lib/lcca";
import type { LccaInputs } from "../../src/lib/store";

test.describe("DAS-141 LCCA break-even", () => {
  test("findBreakEvenYear detects crossover at year 1", () => {
    const flowsA = [{ year: 0, nominalUsd: 2000, pv: 2000 }];
    const flowsB = [
      { year: 0, nominalUsd: 1000, pv: 1000 },
      { year: 1, nominalUsd: 1500, pv: 1500 },
    ];
    expect(findBreakEvenYear(flowsA, flowsB, 5)).toBe(1);
  });

  test("findBreakEvenYear returns null when one scenario is always cheaper", () => {
    const flowsA = [{ year: 0, nominalUsd: 100, pv: 100 }];
    const flowsB = [{ year: 0, nominalUsd: 10_000, pv: 10_000 }];
    expect(findBreakEvenYear(flowsA, flowsB, 10)).toBeNull();
  });

  test("computeLcca reports break-even when high upfront vs periodic maintenance crosses", () => {
    const inputs: LccaInputs = {
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
    const result = computeLcca(inputs);
    expect(result.breakEvenYear).toBe(4);
  });
});
