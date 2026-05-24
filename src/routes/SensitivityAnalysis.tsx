import { useMemo, useRef, useState } from "react";
import { TrendingUp, Download } from "lucide-react";
import { toast } from "sonner";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { PageHeader } from "@/components/PageHeader";
import { StubBanner } from "@/components/StubBanner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { exportChartToPng } from "@/lib/chart-export";
import { haulPave } from "@/lib/haulpave-client";
import { useCalcStore } from "@/lib/store";
import type { SensitivityRequest } from "@/lib/types";
import {
  convertThickness,
  type UnitSystem,
  unitLabels,
} from "@/lib/unit-convert";

type SensParam = "subgrade_cbr" | "design_coverages" | "design_life_years" | "trips_per_day";
type SensMetric = "total_thickness_mm" | "cesa" | "cost_total";

interface ParamConfig {
  label: string;
  defaultMin: number;
  defaultMax: number;
  unit: string;
}

interface MetricConfig {
  label: string;
  yAxisLabel: string;
  unit: string;
  decimals: number;
}

const PARAM_CONFIG: Record<SensParam, ParamConfig> = {
  subgrade_cbr: { label: "Subgrade CBR", defaultMin: 2, defaultMax: 20, unit: "%" },
  design_coverages: { label: "Design coverages", defaultMin: 100_000, defaultMax: 2_000_000, unit: "" },
  design_life_years: { label: "Design life", defaultMin: 5, defaultMax: 25, unit: "yr" },
  trips_per_day: { label: "Trips/day (multiplier)", defaultMin: 0.5, defaultMax: 2.0, unit: "×" },
};

function getMetricConfig(system: UnitSystem): Record<SensMetric, MetricConfig> {
  const thickUnit = unitLabels[system].thickness;
  return {
    total_thickness_mm: {
      label: "Pavement thickness",
      yAxisLabel: `Thickness (${thickUnit})`,
      unit: thickUnit,
      decimals: system === "Imperial" ? 1 : 0,
    },
    cesa: { label: "CESA", yAxisLabel: "CESA", unit: "", decimals: 0 },
    cost_total: {
      label: "Annual cost (USD/yr)",
      yAxisLabel: "Cost (USD/yr)",
      unit: "USD/yr",
      decimals: 0,
    },
  };
}

function displayMetricY(
  y: number,
  metric: SensMetric,
  system: UnitSystem,
): number {
  if (metric === "total_thickness_mm" && system === "Imperial") {
    return convertThickness(y, system);
  }
  return y;
}

interface ChartPoint {
  x: number;
  y: number | null;
}

export default function SensitivityAnalysis() {
  const {
    subgradeCbr,
    coverages,
    designLifeYears,
    workingDaysPerYear,
    fleet,
    costScenarios,
    unitSystem,
  } = useCalcStore();
  const runIdRef = useRef(0);

  const chartContainerRef = useRef<HTMLDivElement>(null);
  const [param, setParam] = useState<SensParam>("subgrade_cbr");
  const [metric, setMetric] = useState<SensMetric>("total_thickness_mm");
  const [minVal, setMinVal] = useState<number>(PARAM_CONFIG.subgrade_cbr.defaultMin);
  const [maxVal, setMaxVal] = useState<number>(PARAM_CONFIG.subgrade_cbr.defaultMax);
  const [steps, setSteps] = useState<number>(10);
  const [running, setRunning] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [showData, setShowData] = useState(true);
  const [chartData, setChartData] = useState<ChartPoint[]>([]);
  const [stubInfo, setStubInfo] = useState<{ stub: boolean; message?: string }>({ stub: false });

  const handleParamChange = (newParam: SensParam) => {
    setParam(newParam);
    setMinVal(PARAM_CONFIG[newParam].defaultMin);
    setMaxVal(PARAM_CONFIG[newParam].defaultMax);
    setChartData([]);
  };

  const handleMetricChange = (newMetric: SensMetric) => {
    setMetric(newMetric);
    setChartData([]);
  };

  const runAnalysis = async () => {
    if (![minVal, maxVal, steps].every(Number.isFinite)) {
      toast.error("Please enter valid numeric values.");
      return;
    }
    if (minVal >= maxVal) {
      toast.error("Min must be less than Max.");
      return;
    }
    if (metric === "cost_total" && costScenarios.length === 0) {
      toast.error("At least one cost scenario is required to sweep cost.");
      return;
    }
    if (metric === "cost_total" && param !== "trips_per_day") {
      toast.error(
        "Annual cost sensitivity only supports trips/day multiplier — use Economics scenarios for other drivers.",
      );
      return;
    }
    if (metric === "cesa" && (param === "subgrade_cbr" || param === "design_coverages")) {
      toast.error("CESA is not affected by subgrade CBR or design coverages — choose design life or trips/day.");
      return;
    }
    const clampedSteps = Math.max(3, Math.min(20, steps));
    if (clampedSteps !== steps) {
      toast.info(`Steps clamped to ${clampedSteps} (range 3–20).`);
    }
    const runId = ++runIdRef.current;

    setRunning(true);
    setChartData([]);
    setStubInfo({ stub: false });

    try {
      const req: SensitivityRequest = {
        variable: param,
        min_value: minVal,
        max_value: maxVal,
        steps: clampedSteps,
        metric,
        fleet,
        design_life_years: designLifeYears,
        working_days_per_year: workingDaysPerYear,
        subgrade_cbr: subgradeCbr,
        design_coverages: coverages,
        cost_scenarios: costScenarios.map(({ _id: _unused, ...s }) => s),
      };

      const res = await haulPave.analyzeSensitivity(req);
      const results: ChartPoint[] = res.data.perturbations.map((p) => ({
        x: p.x,
        y: p.y,
      }));

      if (runId === runIdRef.current) {
        setChartData(results);
        setStubInfo({ stub: res.stub, message: res.stubMessage });
      }
    } catch (err) {
      toast.error(`Analysis failed: ${String(err)}`);
    } finally {
      if (runId === runIdRef.current) {
        setRunning(false);
      }
    }
  };

  const handleExport = async () => {
    if (!chartContainerRef.current) return;
    setExporting(true);
    try {
      await exportChartToPng(
        chartContainerRef.current,
        `haul-calc-sensitivity-${param}-vs-${metric}`,
      );
    } catch (err) {
      toast.error(`Export failed: ${String(err)}`);
    } finally {
      setExporting(false);
    }
  };

  const paramCfg = PARAM_CONFIG[param];
  const metricCfg = getMetricConfig(unitSystem)[metric];
  const displayChartData = useMemo(
    () =>
      chartData.map((p) =>
        p.y === null
          ? p
          : { ...p, y: displayMetricY(p.y, metric, unitSystem) },
      ),
    [chartData, metric, unitSystem],
  );
  const hasData = displayChartData.length > 0;
  const validPoints = displayChartData.filter((p) => p.y !== null).length;

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        title="Sensitivity Analysis"
        description="See how an output metric changes as a single input parameter varies across a range."
        actions={
          <Button onClick={runAnalysis} disabled={running}>
            <TrendingUp className="h-4 w-4" />
            {running ? "Running..." : "Run analysis"}
          </Button>
        }
      />

      <div className="grid flex-1 gap-4 overflow-auto p-6 lg:grid-cols-[320px,1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Inputs</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1">
              <Label htmlFor="sens-param">Sweep parameter</Label>
              <Select value={param} disabled={running} onValueChange={(v) => handleParamChange(v as SensParam)}>
                <SelectTrigger id="sens-param">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.entries(PARAM_CONFIG) as [SensParam, ParamConfig][]).map(([key, c]) => (
                    <SelectItem key={key} value={key}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label htmlFor="sens-metric">Y-axis metric</Label>
              <Select value={metric} disabled={running} onValueChange={(v) => handleMetricChange(v as SensMetric)}>
                <SelectTrigger id="sens-metric">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.entries(getMetricConfig(unitSystem)) as [SensMetric, MetricConfig][]).map(
                    ([key, c]) => (
                    <SelectItem key={key} value={key}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label htmlFor="sens-min">
                Min{paramCfg.unit ? ` (${paramCfg.unit})` : ""}
              </Label>
              <Input
                id="sens-min"
                type="number"
                value={minVal}
                disabled={running}
                onChange={(e) => setMinVal(Number(e.target.value))}
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="sens-max">
                Max{paramCfg.unit ? ` (${paramCfg.unit})` : ""}
              </Label>
              <Input
                id="sens-max"
                type="number"
                value={maxVal}
                disabled={running}
                onChange={(e) => setMaxVal(Number(e.target.value))}
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="sens-steps">Steps (3–20)</Label>
              <Input
                id="sens-steps"
                type="number"
                min={3}
                max={20}
                value={steps}
                disabled={running}
                onChange={(e) => setSteps(Math.max(3, Math.min(20, Number(e.target.value))))}
              />
            </div>

            <div className="rounded-md border bg-muted/40 px-3 py-2 text-xs text-muted-foreground space-y-1">
              <p className="font-medium text-foreground">Fixed inputs</p>
              {param !== "subgrade_cbr" && <p>Subgrade CBR: {subgradeCbr}%</p>}
              {param !== "design_coverages" && param !== "design_life_years" && param !== "trips_per_day" && (
                <p>Design coverages: {coverages.toLocaleString()}</p>
              )}
              {param !== "design_life_years" && <p>Design life: {designLifeYears} yr</p>}
              {param !== "trips_per_day" && <p>Fleet: {fleet.length} vehicle type(s)</p>}
              {param === "trips_per_day" && (
                <p>Fleet trips scaled by multiplier × current trips/day</p>
              )}
              {metric === "cost_total" && (
                <p>Cost: first scenario — {costScenarios[0]?.name ?? "none"}</p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center gap-2">
            <CardTitle>Results — {metricCfg.label}</CardTitle>
            {hasData && (
              <div className="ml-auto flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 gap-1 px-2 text-xs"
                  onClick={() => setShowData(!showData)}
                >
                  {showData ? "Hide Data" : "Show Data"}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 gap-1 px-2 text-xs"
                  onClick={handleExport}
                  disabled={exporting}
                >
                  <Download className="h-3 w-3" />
                  {exporting ? "Exporting…" : "Export PNG"}
                </Button>
              </div>
            )}
          </CardHeader>
          <CardContent>
            {!hasData ? (
              <div className="flex h-[400px] items-center justify-center text-sm text-muted-foreground">
                Configure inputs and click "Run analysis" to see the sensitivity curve.
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {stubInfo.stub ? <StubBanner message={stubInfo.message} /> : null}
                {validPoints < chartData.length && (
                  <p className="text-xs text-amber-600">
                    {chartData.length - validPoints} point(s) failed and were skipped.
                  </p>
                )}
                <div className="h-[400px]" ref={chartContainerRef}>
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart
                      data={displayChartData.filter((p) => p.y !== null)}
                      margin={{ top: 10, right: 20, left: 10, bottom: 20 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                      <XAxis
                        dataKey="x"
                        type="number"
                        domain={["dataMin", "dataMax"]}
                        tickCount={6}
                        label={{
                          value: paramCfg.unit
                            ? `${paramCfg.label} (${paramCfg.unit})`
                            : paramCfg.label,
                          position: "insideBottom",
                          offset: -12,
                          fontSize: 12,
                        }}
                        tick={{ fontSize: 11 }}
                      />
                      <YAxis
                        dataKey="y"
                        tickCount={6}
                        tickFormatter={(v: number) =>
                          v >= 1_000_000
                            ? `${(v / 1_000_000).toFixed(1)}M`
                            : v >= 1_000
                            ? `${(v / 1_000).toFixed(0)}k`
                            : v.toFixed(metricCfg.decimals)
                        }
                        label={{
                          value: metricCfg.yAxisLabel,
                          angle: -90,
                          position: "insideLeft",
                          offset: 10,
                          fontSize: 12,
                        }}
                        tick={{ fontSize: 11 }}
                      />
                      <Tooltip
                        formatter={(value: number) => [
                          metricCfg.unit
                            ? `${value.toLocaleString(undefined, { maximumFractionDigits: metricCfg.decimals })} ${metricCfg.unit}`
                            : value.toLocaleString(undefined, { maximumFractionDigits: metricCfg.decimals }),
                          metricCfg.label,
                        ]}
                        labelFormatter={(label: number) =>
                          `${paramCfg.label}: ${typeof label === "number"
                            ? label.toLocaleString(undefined, { maximumFractionDigits: 3 })
                            : label}`
                        }
                      />
                      <Line
                        type="monotone"
                        dataKey="y"
                        stroke="hsl(var(--primary))"
                        strokeWidth={2}
                        dot={{ r: 4 }}
                        activeDot={{ r: 6 }}
                        connectNulls={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
                {showData && (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="text-xs uppercase text-muted-foreground">
                        <tr>
                          <th className="px-2 py-1 text-left font-medium">
                            {paramCfg.label}{paramCfg.unit ? ` (${paramCfg.unit})` : ""}
                          </th>
                          <th className="px-2 py-1 text-right font-medium">
                            {metricCfg.label}{metricCfg.unit ? ` (${metricCfg.unit})` : ""}
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {displayChartData.map((p) => (
                          <tr key={p.x} className="border-t">
                            <td className="px-2 py-1 font-mono">
                              {p.x.toLocaleString(undefined, { maximumFractionDigits: 3 })}
                            </td>
                            <td className="px-2 py-1 text-right font-mono">
                              {p.y !== null
                                ? p.y.toLocaleString(undefined, {
                                    maximumFractionDigits: metricCfg.decimals,
                                  })
                                : "—"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
