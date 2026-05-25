import type { DisplayCurrency } from "@/lib/store";
import { convertThickness, unitLabels, type UnitSystem } from "@/lib/unit-convert";
import { formatMoneyFromUsd } from "@/lib/utils";
import type { SensitivityPerturbation } from "@/lib/types";

export type SensParam = "subgrade_cbr" | "design_coverages" | "design_life_years" | "trips_per_day";
export type SensMetric = "total_thickness_mm" | "cesa" | "cost_total";

const PARAM_LABELS: Record<SensParam, string> = {
  subgrade_cbr: "Subgrade CBR",
  design_coverages: "Design coverages",
  design_life_years: "Design life",
  trips_per_day: "Trips/day (multiplier)",
};

const METRIC_LABELS: Record<SensMetric, string> = {
  total_thickness_mm: "Pavement thickness",
  cesa: "CESA",
  cost_total: "Annual cost",
};

export function sensitivityParamLabel(variable: string): string {
  return PARAM_LABELS[variable as SensParam] ?? variable;
}

export function sensitivityMetricLabel(metric: string): string {
  return METRIC_LABELS[metric as SensMetric] ?? metric;
}

/** Chart/PDF display Y — matches Sensitivity Analysis page (Imperial thickness conversion). */
export function displaySensitivityMetricY(
  y: number,
  metric: string,
  unitSystem: UnitSystem,
): number {
  const m = metric as SensMetric;
  if (m === "total_thickness_mm" && unitSystem === "Imperial") {
    return convertThickness(y, unitSystem);
  }
  return y;
}

export function formatSensitivityX(
  x: number,
  variable: string,
  _unitSystem: UnitSystem,
): string {
  const param = variable as SensParam;
  if (param === "subgrade_cbr") return `${x.toLocaleString("en-US", { maximumFractionDigits: 1 })} %`;
  if (param === "design_life_years") return `${x.toLocaleString("en-US", { maximumFractionDigits: 0 })} yr`;
  if (param === "trips_per_day") return `${x.toLocaleString("en-US", { maximumFractionDigits: 2 })} x`;
  return x.toLocaleString("en-US", { maximumFractionDigits: 0 });
}

export function formatSensitivityY(
  y: number,
  metric: string,
  unitSystem: UnitSystem,
  currency: DisplayCurrency,
  usdToIdrRate: number,
): string {
  const m = metric as SensMetric;
  if (m === "cost_total") return formatMoneyFromUsd(y, currency, usdToIdrRate);
  if (m === "total_thickness_mm") {
    const display = convertThickness(y, unitSystem);
    const unit = unitLabels[unitSystem].thickness;
    return `${display.toLocaleString("en-US", {
      maximumFractionDigits: unitSystem === "Imperial" ? 1 : 0,
    })} ${unit}`;
  }
  return y.toLocaleString("en-US", { maximumFractionDigits: 0 });
}

export function sensitivityTableHeaders(
  variable: string,
  metric: string,
  unitSystem: UnitSystem,
  currency: DisplayCurrency,
): [string, string] {
  const param = sensitivityParamLabel(variable);
  const metricBase = sensitivityMetricLabel(metric);
  const m = metric as SensMetric;
  if (m === "cost_total") {
    const unit = currency === "IDR" ? "IDR/yr" : "USD/yr";
    return [param, `${metricBase} (${unit})`];
  }
  if (m === "total_thickness_mm") {
    return [param, `${metricBase} (${unitLabels[unitSystem].thickness})`];
  }
  return [param, metricBase];
}

export interface SensitivityReportSnapshot {
  variable: string;
  metric: string;
  minValue: number;
  maxValue: number;
  steps: number;
  perturbations: SensitivityPerturbation[];
  stub: boolean;
  stubMessage?: string;
  confidence?: "high" | "medium" | "low";
}

export function perturbationRowsForPdf(
  perturbations: SensitivityPerturbation[],
  variable: string,
  metric: string,
  unitSystem: UnitSystem,
  currency: DisplayCurrency,
  usdToIdrRate: number,
): string[][] {
  return perturbations.map((p) => [
    formatSensitivityX(p.x, variable, unitSystem),
    p.y == null ? "—" : formatSensitivityY(p.y, metric, unitSystem, currency, usdToIdrRate),
  ]);
}
