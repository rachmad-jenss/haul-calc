import type { Snapshot } from "@/lib/project-file";
import type { DisplayCurrency } from "@/lib/store";
import { currencyUnitSuffix, formatMoneyFromUsd } from "@/lib/utils";

export interface CompareReportProject {
  fileName: string;
  projectName: string;
  snapshot: Snapshot;
}

export interface CompareReportSnapshot {
  projects: CompareReportProject[];
  capturedAt: string;
}

export interface CompareTableRow {
  label: string;
  cells: string[];
}

export interface CompareTableSection {
  title: string;
  rows: CompareTableRow[];
}

export function buildCompareReportSnapshot(
  loaded: { fileName: string; snapshot: Snapshot }[],
): CompareReportSnapshot | null {
  if (loaded.length < 2) return null;
  return {
    projects: loaded.map((p) => ({
      fileName: p.fileName,
      projectName: p.snapshot.projectName || p.fileName,
      snapshot: p.snapshot,
    })),
    capturedAt: new Date().toISOString(),
  };
}

function fmtNum(n: number | null | undefined, decimals = 0): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return n.toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

function fmtMoney(
  usd: number | null | undefined,
  currency: DisplayCurrency,
  usdToIdrRate: number,
): string {
  if (usd == null || !Number.isFinite(usd)) return "—";
  return formatMoneyFromUsd(usd, currency, usdToIdrRate);
}

/** Table sections mirroring the Compare Projects page. */
export function compareTableSections(
  snap: CompareReportSnapshot,
  currency: DisplayCurrency,
  usdToIdrRate: number,
): CompareTableSection[] {
  const projs = snap.projects;
  const sections: CompareTableSection[] = [];

  sections.push({
    title: "Design Parameters",
    rows: [
      {
        label: "Design life (years)",
        cells: projs.map((p) => fmtNum(p.snapshot.designLifeYears)),
      },
      {
        label: "Subgrade CBR",
        cells: projs.map((p) => fmtNum(p.snapshot.subgradeCbr, 1)),
      },
      {
        label: "Coverages",
        cells: projs.map((p) => fmtNum(p.snapshot.coverages)),
      },
      {
        label: "Fleet size",
        cells: projs.map((p) => fmtNum(p.snapshot.fleet?.length ?? null)),
      },
    ],
  });

  sections.push({
    title: "CESA",
    rows: [
      {
        label: "CESA",
        cells: projs.map((p) => fmtNum(p.snapshot.cesaResult?.cesa ?? null)),
      },
      {
        label: "Design coverages",
        cells: projs.map((p) => fmtNum(p.snapshot.cesaResult?.design_coverages ?? null)),
      },
    ],
  });

  sections.push({
    title: "Pavement Thickness",
    rows: [
      {
        label: "USACE total (mm)",
        cells: projs.map((p) => fmtNum(p.snapshot.cbrResult?.total_thickness_mm ?? null)),
      },
      {
        label: "TRH 14 total (mm)",
        cells: projs.map((p) => fmtNum(p.snapshot.trhResult?.total_thickness_mm ?? null)),
      },
      {
        label: "TRH 14 category",
        cells: projs.map((p) => p.snapshot.trhCategory ?? "—"),
      },
    ],
  });

  const costUnit = currencyUnitSuffix(currency);
  const costRows: CompareTableRow[] = [];
  const maxScenarios = Math.max(
    ...projs.map((p) => p.snapshot.costResult?.scenarios?.length ?? 0),
  );

  if (maxScenarios === 0) {
    costRows.push({
      label: "Cost data",
      cells: projs.map(() => "—"),
    });
  } else {
    for (let i = 0; i < maxScenarios; i++) {
      const scenarioNames = projs.map(
        (p) => p.snapshot.costResult?.scenarios?.[i]?.name ?? null,
      );
      const label = scenarioNames.find((n) => n != null) ?? `Scenario ${i + 1}`;

      const tire = projs.map(
        (p) => p.snapshot.costResult?.scenarios?.[i]?.tire_cost_usd_per_year ?? null,
      );
      const fuel = projs.map(
        (p) => p.snapshot.costResult?.scenarios?.[i]?.fuel_cost_usd_per_year ?? null,
      );
      const maint = projs.map(
        (p) => p.snapshot.costResult?.scenarios?.[i]?.maintenance_cost_usd_per_year ?? null,
      );
      const total = projs.map((_, j) => {
        const t = tire[j];
        const f = fuel[j];
        const m = maint[j];
        if (t == null && f == null && m == null) return null;
        return (t ?? 0) + (f ?? 0) + (m ?? 0);
      });

      costRows.push(
        {
          label: `${label} — Tire`,
          cells: tire.map((v) => fmtMoney(v, currency, usdToIdrRate)),
        },
        {
          label: `${label} — Fuel`,
          cells: fuel.map((v) => fmtMoney(v, currency, usdToIdrRate)),
        },
        {
          label: `${label} — Maintenance`,
          cells: maint.map((v) => fmtMoney(v, currency, usdToIdrRate)),
        },
        {
          label: `${label} — Total`,
          cells: total.map((v) => fmtMoney(v, currency, usdToIdrRate)),
        },
      );
    }
  }

  sections.push({
    title: `Operating Costs (${costUnit}/yr)`,
    rows: costRows,
  });

  return sections;
}

export function compareProjectsToJson(snap: CompareReportSnapshot): Record<string, unknown> {
  return {
    captured_at: snap.capturedAt,
    project_count: snap.projects.length,
    projects: snap.projects.map((p) => ({
      file_name: p.fileName,
      project_name: p.projectName,
      design_life_years: p.snapshot.designLifeYears,
      subgrade_cbr: p.snapshot.subgradeCbr,
      coverages: p.snapshot.coverages,
      fleet_size: p.snapshot.fleet?.length ?? null,
      cesa: p.snapshot.cesaResult?.cesa ?? null,
      design_coverages: p.snapshot.cesaResult?.design_coverages ?? null,
      cbr_thickness_mm: p.snapshot.cbrResult?.total_thickness_mm ?? null,
      trh_thickness_mm: p.snapshot.trhResult?.total_thickness_mm ?? null,
      trh_category: p.snapshot.trhCategory ?? null,
      cost_scenarios: p.snapshot.costResult?.scenarios?.map((s) => ({
        name: s.name,
        tire_cost_usd_per_year: s.tire_cost_usd_per_year,
        fuel_cost_usd_per_year: s.fuel_cost_usd_per_year,
        maintenance_cost_usd_per_year: s.maintenance_cost_usd_per_year,
      })),
    })),
  };
}
