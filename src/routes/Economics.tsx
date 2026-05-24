import { useRef, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  IconDesktopArrowDownOutline18,
  IconGauge3Outline18,
  IconPlusOutline18,
  IconTrashOutline18,
} from "nucleo-ui-essential-outline-18";
import { nucleoIconProps } from "@/lib/icons";
import { toast } from "sonner";
import { save } from "@tauri-apps/plugin-dialog";
import { writeTextFile } from "@tauri-apps/plugin-fs";
import { ChartAccessibleView } from "@/components/ChartAccessibleView";
import { PageHeader } from "@/components/PageHeader";
import { ResultStaleBadge } from "@/components/ResultStaleBadge";
import { StubBanner } from "@/components/StubBanner";
import { FieldError, NumField } from "@/components/FormFields";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { exportChartToPng } from "@/lib/chart-export";
import { haulPave } from "@/lib/haulpave-client";
import { computeLcca } from "@/lib/lcca";
import { compareRequestSchema, fieldErrorsFromZod, firstError } from "@/lib/schemas";
import { cn } from "@/lib/utils";
import { useCalcStore } from "@/lib/store";
import type { LccaScenarioInput } from "@/lib/store";
import type { CallError, CostScenario, ScenarioComparison } from "@/lib/types";
import { labelWithUnit } from "@/lib/unit-convert";
import { formatCurrency, toSafeCsvCell } from "@/lib/utils";

const OPEX_STACKED_LEGEND: Record<string, string> = {
  Tires: "Tires — annual cost (USD)",
  Fuel: "Fuel — annual cost (USD)",
  Maintenance: "Maintenance — annual cost (USD)",
};

const LCCA_NPV_LEGEND: Record<string, string> = {
  "NPV (USD)": "Net present value (USD)",
  "AEC (USD/yr)": "Annual equivalent cost (USD/yr)",
};

function formatChartLegend(value: string, map: Record<string, string>) {
  return map[value] ?? value;
}

// ---------------------------------------------------------------------------
// Economics page — two tabs: Operating Cost and LCCA
// ---------------------------------------------------------------------------

export default function Economics() {
  return (
    <div className="flex h-full flex-col">
      <PageHeader
        title="Economics"
        description="Compare operating cost and life-cycle cost across pavement scenarios."
      />
      <Tabs defaultValue="opex" className="flex flex-1 flex-col overflow-auto p-6">
        <TabsList className="mb-4 w-fit">
          <TabsTrigger value="opex">Operating Cost</TabsTrigger>
          <TabsTrigger value="lcca">LCCA</TabsTrigger>
        </TabsList>
        <TabsContent value="opex" className="flex-1">
          <OpexTab />
        </TabsContent>
        <TabsContent value="lcca" className="flex-1">
          <LccaTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Operating Cost (original content, now a sub-component)
// ---------------------------------------------------------------------------

function OpexTab() {
  const { costScenarios, costResult, economicsDirty, setCostScenarios, setCostResult, unitSystem } =
    useCalcStore();
  const [running, setRunning] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [showData, setShowData] = useState(true);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const chartRef = useRef<HTMLDivElement>(null);

  const scenarioIndex = (id: string) => costScenarios.findIndex((s) => s._id === id);
  const scenarioFieldError = (id: string, field: string) => {
    const idx = scenarioIndex(id);
    return idx >= 0 ? fieldErrors[`${idx}.${field}`] : undefined;
  };

  const update = (id: string, patch: Partial<CostScenario>) => {
    const idx = scenarioIndex(id);
    if (idx >= 0) {
      const keys = Object.keys(patch).map((f) => `${idx}.${f}`);
      setFieldErrors((prev) => {
        const next = { ...prev };
        let changed = false;
        for (const key of keys) {
          if (key in next) {
            delete next[key];
            changed = true;
          }
        }
        return changed ? next : prev;
      });
    }
    setCostScenarios(costScenarios.map((s) => (s._id === id ? { ...s, ...patch } : s)));
  };

  const add = () =>
    setCostScenarios([
      ...costScenarios,
      {
        _id: crypto.randomUUID(),
        name: `Scenario ${costScenarios.length + 1}`,
        surface: "asphalt",
        thickness_mm: 100,
        haul_distance_km: 5,
        trips_per_day: 200,
      },
    ]);

  const remove = (id: string) => setCostScenarios(costScenarios.filter((s) => s._id !== id));

  const compute = async () => {
    const parsed = compareRequestSchema.safeParse(costScenarios);
    if (!parsed.success) {
      setFieldErrors(fieldErrorsFromZod(parsed.error));
      toast.error(firstError(parsed.error));
      return;
    }
    setFieldErrors({});
    setRunning(true);
    try {
      const res = await haulPave.compareScenarios(parsed.data);
      setCostResult(res.data, res.stub, res.stubMessage);
    } catch (err) {
      const e = err as CallError;
      toast.error(`compare_scenarios failed: ${e.message}`);
    } finally {
      setRunning(false);
    }
  };

  const handleExport = async () => {
    if (!chartRef.current) return;
    setExporting(true);
    try {
      await exportChartToPng(chartRef.current, "haul-calc-economics-comparison");
    } catch (err) {
      toast.error(`Export failed: ${String(err)}`);
    } finally {
      setExporting(false);
    }
  };

  const handleExportCsv = async () => {
    if (!costResult?.scenarios?.length) return;
    try {
      const path = await save({
        defaultPath: "opex_comparison.csv",
        filters: [{ name: "CSV", extensions: ["csv"] }],
      });
      if (!path) return;
      
      const header = ["Scenario", "Tires (USD/yr)", "Fuel (USD/yr)", "Maintenance (USD/yr)", "Total (USD/yr)"];
      const lines = [header.join(",")];
      for (const s of costResult.scenarios) {
        const total = s.tire_cost_usd_per_year + s.fuel_cost_usd_per_year + s.maintenance_cost_usd_per_year;
        lines.push([
          toSafeCsvCell(s.name),
          s.tire_cost_usd_per_year.toFixed(2),
          s.fuel_cost_usd_per_year.toFixed(2),
          s.maintenance_cost_usd_per_year.toFixed(2),
          total.toFixed(2),
        ].join(","));
      }
      await writeTextFile(path, lines.join("\n"));
      toast.success(`Saved to ${path}`);
    } catch (err) {
      toast.error(`Export failed: ${String(err)}`);
    }
  };

  const handleExportExcel = async () => {
    if (!costResult?.scenarios?.length || !costScenarios.length) return;
    try {
      const path = await save({
        defaultPath: "opex_comparison.xlsx",
        filters: [{ name: "Excel Workbook", extensions: ["xlsx"] }],
      });
      if (!path) return;

      const res = await haulPave.exportComparisonToExcel(
        costScenarios.map(({ _id: _unused, ...s }) => s),
        path,
      );
      toast.success(`Excel saved to ${res.data.file_path || path}`);
    } catch (err) {
      toast.error(`Excel export failed: ${String(err)}`);
    }
  };

  const chartData =
    costResult?.scenarios.map((s) => ({
      name: s.name,
      Tires: s.tire_cost_usd_per_year,
      Fuel: s.fuel_cost_usd_per_year,
      Maintenance: s.maintenance_cost_usd_per_year,
    })) ?? [];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col items-end gap-1">
        <Button onClick={compute} disabled={running || costScenarios.length < 2}>
          <IconGauge3Outline18 {...nucleoIconProps({ size: 16 })} aria-hidden />
          {running ? "Computing..." : "Compare scenarios"}
        </Button>
        {costScenarios.length < 2 && (
          <p className="text-base text-subtle">
            Add at least two scenarios to compare operating costs.
          </p>
        )}
      </div>
      <div className="grid gap-4 lg:grid-cols-[1fr,1fr]">
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle className="text-md font-medium">Scenarios</CardTitle>
            <Button variant="outline" size="sm" onClick={add}>
              <IconPlusOutline18 {...nucleoIconProps({ size: 16 })} aria-hidden />
              Add scenario
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            {costScenarios.map((s) => (
              <div key={s._id} className="rounded border p-3">
                <div className="mb-2 flex items-center justify-between">
                  <div className="max-w-[240px] space-y-1">
                    <Input
                      value={s.name}
                      aria-invalid={scenarioFieldError(s._id, "name") ? true : undefined}
                      className={cn(scenarioFieldError(s._id, "name") && "border-destructive")}
                      onChange={(e) => update(s._id, { name: e.target.value })}
                    />
                    <FieldError message={scenarioFieldError(s._id, "name")} />
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => remove(s._id)}
                    aria-label="Remove scenario"
                  >
                    <IconTrashOutline18 {...nucleoIconProps({ size: 16 })} aria-hidden />
                  </Button>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label>Surface</Label>
                    <Select
                      value={s.surface}
                      onValueChange={(surface) =>
                        update(s._id, { surface: surface as CostScenario["surface"] })
                      }
                    >
                      <SelectTrigger
                        className={cn(
                          scenarioFieldError(s._id, "surface") && "border-destructive",
                        )}
                        aria-invalid={scenarioFieldError(s._id, "surface") ? true : undefined}
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="asphalt">Asphalt</SelectItem>
                        <SelectItem value="gravel">Gravel</SelectItem>
                        <SelectItem value="concrete">Concrete</SelectItem>
                      </SelectContent>
                    </Select>
                    <FieldError message={scenarioFieldError(s._id, "surface")} />
                  </div>
                  <NumField
                    label={labelWithUnit("Thickness", unitSystem, "thickness")}
                    value={s.thickness_mm}
                    error={scenarioFieldError(s._id, "thickness_mm")}
                    description={
                      unitSystem === "Imperial"
                        ? "Enter value in millimeters (stored in SI)."
                        : undefined
                    }
                    onChange={(v) => update(s._id, { thickness_mm: v })}
                  />
                  <NumField
                    label={labelWithUnit("Haul distance", unitSystem, "distance")}
                    value={s.haul_distance_km}
                    error={scenarioFieldError(s._id, "haul_distance_km")}
                    description={
                      unitSystem === "Imperial"
                        ? "Enter value in kilometers (stored in SI)."
                        : undefined
                    }
                    onChange={(v) => update(s._id, { haul_distance_km: v })}
                  />
                  <NumField
                    label="Trips/day"
                    value={s.trips_per_day}
                    error={scenarioFieldError(s._id, "trips_per_day")}
                    onChange={(v) => update(s._id, { trips_per_day: v })}
                  />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center gap-2">
            <CardTitle className="text-md font-medium">Comparison</CardTitle>
            {costResult && economicsDirty && (
              <ResultStaleBadge onRecalculate={compute} recalculating={running} />
            )}
          </CardHeader>
          <CardContent className="space-y-3">
            {costResult?.stub ? <StubBanner message={costResult.stubMessage} /> : null}
            {chartData.length === 0 ? (
              <p className="text-base text-subtle">
                Run "Compare scenarios" to see operating cost breakdown.
              </p>
            ) : (
              <ChartAccessibleView
                id="opex-comparison-chart"
                showData={showData}
                onShowDataChange={setShowData}
                seriesDescription="Stacked bars: Tires (red), Fuel (amber), Maintenance (blue) per scenario."
                toolbar={
                  <>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 gap-1 px-2 text-2xs"
                      onClick={handleExportCsv}
                    >
                      <IconDesktopArrowDownOutline18 {...nucleoIconProps({ size: 12 })} aria-hidden />
                      Export CSV
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 gap-1 px-2 text-2xs"
                      onClick={handleExportExcel}
                    >
                      <IconDesktopArrowDownOutline18 {...nucleoIconProps({ size: 12 })} aria-hidden />
                      Export Excel
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 gap-1 px-2 text-2xs"
                      onClick={handleExport}
                      disabled={exporting}
                    >
                      <IconDesktopArrowDownOutline18 {...nucleoIconProps({ size: 12 })} aria-hidden />
                      {exporting ? "Exporting…" : "Export PNG"}
                    </Button>
                  </>
                }
                chart={
                  <div className="h-[400px] w-full" ref={chartRef}>
                    <ResponsiveContainer>
                      <BarChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="name" />
                        <YAxis tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                        <Tooltip formatter={(value: number) => formatCurrency(value)} />
                        <Legend formatter={(value) => formatChartLegend(String(value), OPEX_STACKED_LEGEND)} />
                        <Bar dataKey="Tires" stackId="a" fill="#ef4444" name="Tires" />
                        <Bar dataKey="Fuel" stackId="a" fill="#f59e0b" name="Fuel" />
                        <Bar dataKey="Maintenance" stackId="a" fill="#3b82f6" name="Maintenance" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                }
                table={<SummaryTable rows={costResult?.scenarios ?? []} />}
              />
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function SummaryTable({ rows }: { rows: ScenarioComparison[] }) {
  if (!rows.length) return null;
  return (
    <table className="w-full text-base">
      <caption className="sr-only">
        Operating cost breakdown by scenario — same values as the stacked bar chart
      </caption>
      <thead className="text-2xs uppercase text-subtle">
        <tr>
          <th className="px-2 py-1 text-left font-medium">Scenario</th>
          <th className="px-2 py-1 text-right font-medium">Tires</th>
          <th className="px-2 py-1 text-right font-medium">Fuel</th>
          <th className="px-2 py-1 text-right font-medium">Maint.</th>
          <th className="px-2 py-1 text-right font-medium">Total/yr</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((s, i) => {
          const total =
            s.tire_cost_usd_per_year +
            s.fuel_cost_usd_per_year +
            s.maintenance_cost_usd_per_year;
          return (
            <tr key={i} className="border-t">
              <td className="px-2 py-1">{s.name}</td>
              <td className="px-2 py-1 text-right font-mono">
                {formatCurrency(s.tire_cost_usd_per_year)}
              </td>
              <td className="px-2 py-1 text-right font-mono">
                {formatCurrency(s.fuel_cost_usd_per_year)}
              </td>
              <td className="px-2 py-1 text-right font-mono">
                {formatCurrency(s.maintenance_cost_usd_per_year)}
              </td>
              <td className="px-2 py-1 text-right font-mono font-semibold">
                {formatCurrency(total)}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

// ---------------------------------------------------------------------------
// LCCA Tab
// ---------------------------------------------------------------------------

const SCENARIO_COLORS = ["#3b82f6", "#ef4444", "#10b981", "#f59e0b", "#8b5cf6"];

function LccaTab() {
  const { costScenarios, lccaInputs, lccaResult, setLccaInputs, setLccaResult } = useCalcStore();
  const [exporting, setExporting] = useState(false);
  const [showSummaryData, setShowSummaryData] = useState(true);
  const [showNpvData, setShowNpvData] = useState(true);
  const [showCumulativeData, setShowCumulativeData] = useState(true);
  const npvChartRef = useRef<HTMLDivElement>(null);

  // Sync scenario list from costScenarios whenever we need it
  const syncedScenarios: LccaScenarioInput[] = costScenarios.map((cs) => {
    const existing = lccaInputs.scenarios.find((s) => s._id === cs._id);
    return (
      existing ?? {
        _id: cs._id,
        name: cs.name,
        constructionCostUsd: 500_000,
        resurfacingCostUsd: 150_000,
        resurfacingIntervalYears: 5,
      }
    );
  });

  const updateScenario = (id: string, patch: Partial<LccaScenarioInput>) => {
    const updated = syncedScenarios.map((s) => (s._id === id ? { ...s, ...patch } : s));
    setLccaInputs({ ...lccaInputs, scenarios: updated });
  };

  const compute = () => {
    if (syncedScenarios.length < 1) {
      toast.error("Add at least one scenario in the Operating Cost tab first.");
      return;
    }
    const inputs = { ...lccaInputs, scenarios: syncedScenarios };
    setLccaInputs(inputs);
    const result = computeLcca(inputs);
    setLccaResult(result);
  };

  const handleExport = async () => {
    if (!npvChartRef.current) return;
    setExporting(true);
    try {
      await exportChartToPng(npvChartRef.current, "haul-calc-lcca");
    } catch (err) {
      toast.error(`Export failed: ${String(err)}`);
    } finally {
      setExporting(false);
    }
  };

  const handleExportCsv = async () => {
    if (!lccaResult?.scenarios?.length) return;
    try {
      const path = await save({
        defaultPath: "lcca_summary.csv",
        filters: [{ name: "CSV", extensions: ["csv"] }],
      });
      if (!path) return;
      
      const header = ["Scenario", "NPV (USD)", "Annual Equivalent Cost (USD/yr)"];
      const lines = [header.join(",")];
      for (const s of lccaResult.scenarios) {
        lines.push([
          toSafeCsvCell(s.name),
          s.npvUsd.toFixed(2),
          s.annualEquivalentCostUsd.toFixed(2),
        ].join(","));
      }
      await writeTextFile(path, lines.join("\n"));
      toast.success(`Saved to ${path}`);
    } catch (err) {
      toast.error(`Export failed: ${String(err)}`);
    }
  };

  // Build NPV bar chart data
  const npvChartData = lccaResult?.scenarios.map((s) => ({
    name: s.name,
    "NPV (USD)": Math.round(s.npvUsd),
    "AEC (USD/yr)": Math.round(s.annualEquivalentCostUsd),
  })) ?? [];

  // Build cumulative PV line chart data (all scenarios by year)
  const cumulativeData: Record<string, number | string>[] = [];
  if (lccaResult) {
    const years = lccaInputs.analysisPeriodYears;
    for (let y = 0; y <= years; y++) {
      const point: Record<string, number | string> = { year: y };
      for (const sc of lccaResult.scenarios) {
        let cum = 0;
        for (const cf of sc.cashflows) {
          if (cf.year <= y) cum += cf.pv;
        }
        point[sc.name] = Math.round(cum);
      }
      cumulativeData.push(point);
    }
  }

  const hasTwoScenarios = costScenarios.length >= 2;

  return (
    <div className="flex flex-col gap-4">
      {/* Global LCCA parameters */}
      <Card>
        <CardHeader>
          <CardTitle className="text-md font-medium">LCCA Parameters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2">
            <NumField
              label="Discount rate (%)"
              value={lccaInputs.discountRate * 100}
              onChange={(v) => setLccaInputs({ ...lccaInputs, scenarios: syncedScenarios, discountRate: v / 100 })}
              min={0}
              max={50}
            />
            <NumField
              label="Analysis period (years)"
              value={lccaInputs.analysisPeriodYears}
              onChange={(v) => setLccaInputs({ ...lccaInputs, scenarios: syncedScenarios, analysisPeriodYears: Math.round(v) })}
              min={1}
              max={50}
            />
          </div>
        </CardContent>
      </Card>

      {/* Per-scenario cost inputs */}
      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle className="text-md font-medium">Scenario Costs</CardTitle>
          <Button onClick={compute} size="sm">
            <IconGauge3Outline18 {...nucleoIconProps({ size: 16 })} aria-hidden />
            Compute LCCA
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {costScenarios.length === 0 ? (
            <p className="text-base text-subtle">
              Add scenarios in the Operating Cost tab first.
            </p>
          ) : (
            syncedScenarios.map((s) => (
              <div key={s._id} className="rounded border p-3">
                <p className="mb-2 text-md font-medium text-strong">{s.name}</p>
                <div className="grid grid-cols-3 gap-2">
                  <NumField
                    label="Construction cost (USD)"
                    value={s.constructionCostUsd}
                    onChange={(v) => updateScenario(s._id, { constructionCostUsd: v })}
                    min={0}
                  />
                  <NumField
                    label="Resurfacing cost (USD)"
                    value={s.resurfacingCostUsd}
                    onChange={(v) => updateScenario(s._id, { resurfacingCostUsd: v })}
                    min={0}
                  />
                  <NumField
                    label="Resurfacing interval (yr)"
                    value={s.resurfacingIntervalYears}
                    onChange={(v) => updateScenario(s._id, { resurfacingIntervalYears: Math.round(v) })}
                    min={1}
                    max={50}
                  />
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {/* Results */}
      {lccaResult && (
        <>
          {/* Summary table */}
          <Card>
            <CardHeader className="flex-row items-center gap-2">
              <CardTitle className="text-md font-medium">LCCA Results</CardTitle>
              {lccaResult.breakEvenYear !== null && hasTwoScenarios && (
                <span className="text-base text-subtle">
                  Break-even at year {lccaResult.breakEvenYear}
                </span>
              )}
              <div className="ml-auto flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 gap-1 px-2 text-2xs"
                  onClick={handleExportCsv}
                >
                  <IconDesktopArrowDownOutline18 {...nucleoIconProps({ size: 12 })} aria-hidden />
                  Export CSV
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-2xs text-subtle">
                Summary metrics per scenario (no chart — table is the primary view).
              </p>
              <Button
                type="button"
                variant={showSummaryData ? "secondary" : "outline"}
                size="sm"
                className="h-8 gap-1.5 text-2xs"
                aria-pressed={showSummaryData}
                aria-controls="lcca-summary-data-table"
                aria-expanded={showSummaryData}
                onClick={() => setShowSummaryData(!showSummaryData)}
              >
                {showSummaryData ? "Hide data table" : "Show data table"}
              </Button>
              {showSummaryData ? (
                <div
                  id="lcca-summary-data-table"
                  className="overflow-x-auto rounded-md border focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  tabIndex={0}
                  role="region"
                  aria-label="LCCA summary data table"
                >
                  <LccaSummaryTable rows={lccaResult.scenarios} />
                </div>
              ) : null}
            </CardContent>
          </Card>

          {/* NPV bar chart */}
          <Card>
            <CardHeader>
              <CardTitle className="text-md font-medium">NPV Comparison</CardTitle>
            </CardHeader>
            <CardContent>
              <ChartAccessibleView
                id="lcca-npv-chart"
                showData={showNpvData}
                onShowDataChange={setShowNpvData}
                seriesDescription="Bars: NPV (blue) and annual equivalent cost (green) per scenario."
                toolbar={
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 gap-1 px-2 text-2xs"
                    onClick={handleExport}
                    disabled={exporting}
                  >
                    <IconDesktopArrowDownOutline18 {...nucleoIconProps({ size: 12 })} aria-hidden />
                    {exporting ? "Exporting…" : "Export PNG"}
                  </Button>
                }
                chart={
                  <div className="h-[400px] w-full" ref={npvChartRef}>
                    <ResponsiveContainer>
                      <BarChart data={npvChartData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="name" />
                        <YAxis tickFormatter={(v) => `$${(v / 1_000_000).toFixed(1)}M`} />
                        <Tooltip formatter={(value: number) => formatCurrency(value)} />
                        <Legend formatter={(value) => formatChartLegend(String(value), LCCA_NPV_LEGEND)} />
                        <Bar dataKey="NPV (USD)" fill="#3b82f6" name="NPV (USD)" />
                        <Bar dataKey="AEC (USD/yr)" fill="#10b981" name="AEC (USD/yr)" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                }
                table={<NpvComparisonTable rows={npvChartData} />}
              />
            </CardContent>
          </Card>

          {/* Cumulative PV line chart */}
          <Card>
            <CardHeader>
              <CardTitle className="text-md font-medium">Cumulative Present Value over Time</CardTitle>
            </CardHeader>
            <CardContent>
              <ChartAccessibleView
                id="lcca-cumulative-chart"
                showData={showCumulativeData}
                onShowDataChange={setShowCumulativeData}
                seriesDescription={`Lines by scenario (${lccaResult.scenarios.map((s) => s.name).join(", ")}).`}
                chart={
                  <div className="h-[400px] w-full">
                    <ResponsiveContainer>
                      <LineChart data={cumulativeData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="year" label={{ value: "Year", position: "insideBottom", offset: -5 }} />
                        <YAxis tickFormatter={(v) => `$${(v / 1_000_000).toFixed(1)}M`} />
                        <Tooltip formatter={(value: number) => formatCurrency(value)} />
                        <Legend
                          formatter={(value) => `${value} — cumulative PV (USD)`}
                        />
                        {lccaResult.scenarios.map((s, i) => (
                          <Line
                            key={s._id}
                            type="monotone"
                            dataKey={s.name}
                            name={s.name}
                            stroke={SCENARIO_COLORS[i % SCENARIO_COLORS.length]}
                            dot={false}
                            strokeWidth={2}
                          />
                        ))}
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                }
                table={<CumulativePvTable rows={cumulativeData} />}
              />
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

function NpvComparisonTable({
  rows,
}: {
  rows: { name: string; "NPV (USD)": number; "AEC (USD/yr)": number }[];
}) {
  if (!rows.length) return null;
  return (
    <table className="w-full text-base">
      <caption className="sr-only">NPV and annual equivalent cost — same series as the bar chart</caption>
      <thead className="text-2xs uppercase text-subtle">
        <tr>
          <th className="px-2 py-1 text-left font-medium">Scenario</th>
          <th className="px-2 py-1 text-right font-medium">NPV (USD)</th>
          <th className="px-2 py-1 text-right font-medium">AEC (USD/yr)</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.name} className="border-t">
            <td className="px-2 py-1">{row.name}</td>
            <td className="px-2 py-1 text-right font-mono">{formatCurrency(row["NPV (USD)"])}</td>
            <td className="px-2 py-1 text-right font-mono">
              {formatCurrency(row["AEC (USD/yr)"])}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function CumulativePvTable({ rows }: { rows: Record<string, number | string>[] }) {
  if (!rows.length) return null;
  const scenarioKeys = Object.keys(rows[0]).filter((k) => k !== "year");
  return (
    <table className="w-full text-base">
      <caption className="sr-only">
        Cumulative present value by year and scenario — same series as the line chart
      </caption>
      <thead className="text-2xs uppercase text-subtle">
        <tr>
          <th className="px-2 py-1 text-left font-medium">Year</th>
          {scenarioKeys.map((key) => (
            <th key={key} className="px-2 py-1 text-right font-medium">
              {key}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={String(row.year)} className="border-t">
            <td className="px-2 py-1 font-mono">{row.year}</td>
            {scenarioKeys.map((key) => (
              <td key={key} className="px-2 py-1 text-right font-mono">
                {formatCurrency(Number(row[key]))}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function LccaSummaryTable({
  rows,
}: {
  rows: { _id: string; name: string; npvUsd: number; annualEquivalentCostUsd: number }[];
}) {
  if (!rows.length) return null;
  const best = rows.reduce((a, b) => (a.npvUsd < b.npvUsd ? a : b));
  return (
    <table className="w-full text-base">
      <caption className="sr-only">LCCA summary — NPV and annual equivalent cost by scenario</caption>
      <thead className="text-2xs uppercase text-subtle">
        <tr>
          <th className="px-2 py-1 text-left font-medium">Scenario</th>
          <th className="px-2 py-1 text-right font-medium">NPV</th>
          <th className="px-2 py-1 text-right font-medium">Annual Equiv. Cost</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((s) => (
          <tr key={s._id} className="border-t">
            <td className="px-2 py-1">
              <span className="inline-flex items-center gap-1">
                {s.name}
                {s._id === best._id && rows.length > 1 && (
                  <span className="rounded bg-green-100 px-1 py-0.5 text-2xs font-medium text-green-700 dark:bg-green-900/40 dark:text-green-400">
                    lowest NPV
                  </span>
                )}
              </span>
            </td>
            <td className="px-2 py-1 text-right font-mono">{formatCurrency(s.npvUsd)}</td>
            <td className="px-2 py-1 text-right font-mono">
              {formatCurrency(s.annualEquivalentCostUsd)}/yr
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
