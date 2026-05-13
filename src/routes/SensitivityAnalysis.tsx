import { useState } from "react";
import { TrendingUp } from "lucide-react";
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
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { haulPave } from "@/lib/haulpave-client";
import { useCalcStore } from "@/lib/store";

type SensParam = "subgrade_cbr" | "design_coverages" | "design_life_years";

interface ParamConfig {
  label: string;
  defaultMin: number;
  defaultMax: number;
  unit: string;
}

const PARAM_CONFIG: Record<SensParam, ParamConfig> = {
  subgrade_cbr: {
    label: "Subgrade CBR (%)",
    defaultMin: 2,
    defaultMax: 20,
    unit: "%",
  },
  design_coverages: {
    label: "Design coverages",
    defaultMin: 100_000,
    defaultMax: 2_000_000,
    unit: "",
  },
  design_life_years: {
    label: "Design life (years)",
    defaultMin: 5,
    defaultMax: 25,
    unit: "yr",
  },
};

interface ChartPoint {
  x: number;
  thickness_mm: number | null;
}

function linspace(min: number, max: number, n: number): number[] {
  if (n <= 1) return [min];
  const step = (max - min) / (n - 1);
  return Array.from({ length: n }, (_, i) => min + i * step);
}

export default function SensitivityAnalysis() {
  const { subgradeCbr, coverages, fleet } = useCalcStore();

  const [param, setParam] = useState<SensParam>("subgrade_cbr");
  const [minVal, setMinVal] = useState<number>(PARAM_CONFIG.subgrade_cbr.defaultMin);
  const [maxVal, setMaxVal] = useState<number>(PARAM_CONFIG.subgrade_cbr.defaultMax);
  const [steps, setSteps] = useState<number>(10);
  const [running, setRunning] = useState(false);
  const [chartData, setChartData] = useState<ChartPoint[]>([]);

  const handleParamChange = (newParam: SensParam) => {
    setParam(newParam);
    setMinVal(PARAM_CONFIG[newParam].defaultMin);
    setMaxVal(PARAM_CONFIG[newParam].defaultMax);
    setChartData([]);
  };

  const runAnalysis = async () => {
    if (minVal >= maxVal) {
      toast.error("Min must be less than Max.");
      return;
    }
    const clampedSteps = Math.max(3, Math.min(20, steps));

    setRunning(true);
    setChartData([]);

    try {
      const values = linspace(minVal, maxVal, clampedSteps);

      const promises: Promise<ChartPoint>[] = values.map(async (v): Promise<ChartPoint> => {
        try {
          if (param === "subgrade_cbr") {
            const res = await haulPave.cbrThickness({
              subgrade_cbr: v,
              design_coverages: coverages,
            });
            return { x: v, thickness_mm: res.data.total_thickness_mm };
          } else if (param === "design_coverages") {
            const res = await haulPave.cbrThickness({
              subgrade_cbr: subgradeCbr,
              design_coverages: v,
            });
            return { x: v, thickness_mm: res.data.total_thickness_mm };
          } else {
            // design_life_years: compute CESA first, then CBR thickness
            const cesaRes = await haulPave.computeCesa({
              fleet,
              design_life_years: v,
            });
            const cbrRes = await haulPave.cbrThickness({
              subgrade_cbr: subgradeCbr,
              design_coverages: cesaRes.data.design_coverages,
            });
            return { x: v, thickness_mm: cbrRes.data.total_thickness_mm };
          }
        } catch {
          // Skip failed points — do not abort the whole run
          return { x: v, thickness_mm: null };
        }
      });

      const results = await Promise.all(promises);
      setChartData(results);
    } catch (err) {
      toast.error(`Analysis failed: ${String(err)}`);
    } finally {
      setRunning(false);
    }
  };

  const cfg = PARAM_CONFIG[param];
  const hasData = chartData.length > 0;
  const validPoints = chartData.filter((p) => p.thickness_mm !== null).length;

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        title="Sensitivity Analysis"
        description="See how pavement thickness changes as a single input parameter varies across a range."
        actions={
          <Button onClick={runAnalysis} disabled={running}>
            <TrendingUp className="h-4 w-4" />
            {running ? "Running..." : "Run analysis"}
          </Button>
        }
      />

      <div className="grid flex-1 gap-4 overflow-auto p-6 lg:grid-cols-[320px,1fr]">
        {/* Left card: inputs */}
        <Card>
          <CardHeader>
            <CardTitle>Inputs</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1">
              <Label htmlFor="sens-param">Parameter</Label>
              <select
                id="sens-param"
                value={param}
                onChange={(e) => handleParamChange(e.target.value as SensParam)}
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                {(Object.entries(PARAM_CONFIG) as [SensParam, ParamConfig][]).map(
                  ([key, c]) => (
                    <option key={key} value={key}>
                      {c.label}
                    </option>
                  ),
                )}
              </select>
            </div>

            <div className="space-y-1">
              <Label htmlFor="sens-min">
                Min{cfg.unit ? ` (${cfg.unit})` : ""}
              </Label>
              <Input
                id="sens-min"
                type="number"
                value={minVal}
                onChange={(e) => setMinVal(Number(e.target.value))}
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="sens-max">
                Max{cfg.unit ? ` (${cfg.unit})` : ""}
              </Label>
              <Input
                id="sens-max"
                type="number"
                value={maxVal}
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
                onChange={(e) =>
                  setSteps(Math.max(3, Math.min(20, Number(e.target.value))))
                }
              />
            </div>

            <div className="rounded-md border bg-muted/40 px-3 py-2 text-xs text-muted-foreground space-y-1">
              <p className="font-medium text-foreground">Fixed inputs</p>
              {param !== "subgrade_cbr" && (
                <p>Subgrade CBR: {subgradeCbr}%</p>
              )}
              {param !== "design_coverages" && param !== "design_life_years" && (
                <p>Design coverages: {coverages.toLocaleString()}</p>
              )}
              {param === "design_life_years" && (
                <p>Fleet: {fleet.length} vehicle type(s)</p>
              )}
              {param === "design_coverages" && (
                <p>Design coverages varied directly</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Right card: chart */}
        <Card>
          <CardHeader>
            <CardTitle>Results</CardTitle>
          </CardHeader>
          <CardContent className="flex h-[calc(100%-4rem)] flex-col">
            {!hasData ? (
              <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
                Configure inputs and click "Run analysis" to see the sensitivity curve.
              </div>
            ) : (
              <div className="flex flex-col gap-2 flex-1">
                {validPoints < chartData.length && (
                  <p className="text-xs text-amber-600">
                    {chartData.length - validPoints} point(s) failed and were skipped.
                  </p>
                )}
                <div className="flex-1 min-h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart
                      data={chartData.filter((p) => p.thickness_mm !== null)}
                      margin={{ top: 10, right: 20, left: 0, bottom: 20 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                      <XAxis
                        dataKey="x"
                        type="number"
                        domain={["dataMin", "dataMax"]}
                        tickCount={6}
                        label={{
                          value: cfg.label,
                          position: "insideBottom",
                          offset: -12,
                          fontSize: 12,
                        }}
                        tick={{ fontSize: 11 }}
                      />
                      <YAxis
                        dataKey="thickness_mm"
                        tickCount={6}
                        label={{
                          value: "Total thickness (mm)",
                          angle: -90,
                          position: "insideLeft",
                          offset: 10,
                          fontSize: 12,
                        }}
                        tick={{ fontSize: 11 }}
                      />
                      <Tooltip
                        formatter={(value: number) => [`${value} mm`, "Thickness"]}
                        labelFormatter={(label: number) =>
                          `${cfg.label}: ${typeof label === "number" ? label.toLocaleString(undefined, { maximumFractionDigits: 2 }) : label}`
                        }
                      />
                      <Line
                        type="monotone"
                        dataKey="thickness_mm"
                        stroke="hsl(var(--primary))"
                        strokeWidth={2}
                        dot={{ r: 4 }}
                        activeDot={{ r: 6 }}
                        connectNulls={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
