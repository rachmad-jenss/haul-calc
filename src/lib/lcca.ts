/**
 * Pure LCCA (Life-Cycle Cost Analysis) computation — no side effects, no Tauri calls.
 *
 * Model:
 *  - Year 0: constructionCostUsd (initial build)
 *  - Every `resurfacingIntervalYears`: resurfacingCostUsd (periodic renewal)
 *  - All cash flows are discounted to PV at `discountRate`
 *  - NPV = sum of discounted cash flows over the analysis period
 *  - Annual Equivalent Cost (AEC) = NPV * (r * (1+r)^n) / ((1+r)^n - 1)  [capital recovery factor]
 *  - Break-even year: first analysis year where cumulative discounted costs cross
 *    (only meaningful for exactly 2 scenarios; null if no crossover).
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

/** First year cumulative PV costs cross between two scenarios (null if never). */
export function findBreakEvenYear(
  cashflowsA: Cashflow[],
  cashflowsB: Cashflow[],
  analysisPeriodYears: number,
): number | null {
  const pvByYearA = new Map(cashflowsA.map((c) => [c.year, c.pv]));
  const pvByYearB = new Map(cashflowsB.map((c) => [c.year, c.pv]));
  let cumA = 0;
  let cumB = 0;
  let prevDiff: number | null = null;

  for (let y = 0; y <= analysisPeriodYears; y++) {
    cumA += pvByYearA.get(y) ?? 0;
    cumB += pvByYearB.get(y) ?? 0;
    const diff = cumA - cumB;
    if (prevDiff !== null && prevDiff !== 0) {
      if ((prevDiff > 0 && diff <= 0) || (prevDiff < 0 && diff >= 0)) {
        return y;
      }
    }
    prevDiff = diff;
  }
  return null;
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

  let breakEvenYear: number | null = null;
  if (scenarioResults.length === 2) {
    const [a, b] = scenarioResults;
    breakEvenYear = findBreakEvenYear(a.cashflows, b.cashflows, analysisPeriodYears);
  }

  return { scenarios: scenarioResults, breakEvenYear };
}
