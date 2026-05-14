/**
 * Pure LCCA (Life-Cycle Cost Analysis) computation — no side effects, no Tauri calls.
 *
 * Model:
 *  - Year 0: constructionCostUsd (initial build)
 *  - Every `resurfacingIntervalYears`: resurfacingCostUsd (periodic renewal)
 *  - All cash flows are discounted to PV at `discountRate`
 *  - NPV = sum of discounted cash flows over the analysis period
 *  - Annual Equivalent Cost (AEC) = NPV * (r * (1+r)^n) / ((1+r)^n - 1)  [capital recovery factor]
 *  - Break-even year: first year where the cheaper scenario's cumulative PV exceeds
 *    the more expensive scenario's cumulative PV (only meaningful for 2 scenarios).
 */

import type { LccaInputs, LccaResult, LccaScenarioResult } from "@/lib/store";

interface Cashflow {
  year: number;
  nominalUsd: number;
  pv: number;
}

function computeScenarioCashflows(
  constructionCostUsd: number,
  resurfacingCostUsd: number,
  resurfacingIntervalYears: number,
  discountRate: number,
  analysisPeriodYears: number,
): Cashflow[] {
  const flows: Cashflow[] = [];

  for (let y = 0; y <= analysisPeriodYears; y++) {
    let nominal = 0;
    if (y === 0) {
      nominal = constructionCostUsd;
    } else if (resurfacingIntervalYears > 0 && y % resurfacingIntervalYears === 0) {
      nominal = resurfacingCostUsd;
    }
    if (nominal === 0) continue;
    const pv = nominal / Math.pow(1 + discountRate, y);
    flows.push({ year: y, nominalUsd: nominal, pv });
  }

  return flows;
}

function capitalRecoveryFactor(r: number, n: number): number {
  if (r === 0) return 1 / n;
  const factor = Math.pow(1 + r, n);
  return (r * factor) / (factor - 1);
}

export function computeLcca(inputs: LccaInputs): LccaResult {
  const { discountRate, analysisPeriodYears, scenarios } = inputs;

  const scenarioResults: LccaScenarioResult[] = scenarios.map((s) => {
    const cashflows = computeScenarioCashflows(
      s.constructionCostUsd,
      s.resurfacingCostUsd,
      s.resurfacingIntervalYears,
      discountRate,
      analysisPeriodYears,
    );
    const npvUsd = cashflows.reduce((acc, c) => acc + c.pv, 0);
    const crf = capitalRecoveryFactor(discountRate, analysisPeriodYears);
    const annualEquivalentCostUsd = npvUsd * crf;
    return { _id: s._id, name: s.name, npvUsd, annualEquivalentCostUsd, cashflows };
  });

  // Break-even: meaningful only for exactly 2 scenarios
  let breakEvenYear: number | null = null;
  if (scenarioResults.length === 2) {
    const [a, b] = scenarioResults;
    // Build cumulative PV by year for both
    const maxYear = analysisPeriodYears;
    let cumA = 0;
    let cumB = 0;
    const pvByYearA = new Map(a.cashflows.map((c) => [c.year, c.pv]));
    const pvByYearB = new Map(b.cashflows.map((c) => [c.year, c.pv]));

    for (let y = 0; y <= maxYear; y++) {
      cumA += pvByYearA.get(y) ?? 0;
      cumB += pvByYearB.get(y) ?? 0;
      // Detect the year where the ordering flips (cheaper switches sides)
      if (y > 0 && ((cumA <= cumB && a.npvUsd > b.npvUsd) || (cumA >= cumB && a.npvUsd < b.npvUsd))) {
        breakEvenYear = y;
        break;
      }
    }
  }

  return { scenarios: scenarioResults, breakEvenYear };
}
