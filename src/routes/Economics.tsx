import { useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Plus, Trash2, Calculator } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/PageHeader";
import { StubBanner } from "@/components/StubBanner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { haulPave } from "@/lib/haulpave-client";
import { compareRequestSchema, firstError } from "@/lib/schemas";
import type {
  CallError,
  CostComparison,
  CostScenario,
  ScenarioComparison,
} from "@/lib/types";
import { formatCurrency } from "@/lib/utils";

const DEFAULT_SCENARIOS: CostScenario[] = [
  {
    name: "Asphalt 100 mm",
    surface: "asphalt",
    thickness_mm: 100,
    haul_distance_km: 5,
    trips_per_day: 200,
  },
  {
    name: "Gravel 250 mm",
    surface: "gravel",
    thickness_mm: 250,
    haul_distance_km: 5,
    trips_per_day: 200,
  },
];

export default function Economics() {
  const [scenarios, setScenarios] = useState<CostScenario[]>(DEFAULT_SCENARIOS);
  const [result, setResult] = useState<CostComparison | null>(null);
  const [stub, setStub] = useState(false);
  const [stubMessage, setStubMessage] = useState<string>();
  const [running, setRunning] = useState(false);

  const update = (idx: number, patch: Partial<CostScenario>) =>
    setScenarios((prev) =>
      prev.map((s, i) => (i === idx ? { ...s, ...patch } : s)),
    );

  const add = () =>
    setScenarios((prev) => [
      ...prev,
      {
        name: `Scenario ${prev.length + 1}`,
        surface: "asphalt",
        thickness_mm: 100,
        haul_distance_km: 5,
        trips_per_day: 200,
      },
    ]);

  const remove = (idx: number) =>
    setScenarios((prev) => prev.filter((_, i) => i !== idx));

  const compute = async () => {
    const parsed = compareRequestSchema.safeParse(scenarios);
    if (!parsed.success) {
      toast.error(firstError(parsed.error));
      return;
    }
    setRunning(true);
    try {
      const res = await haulPave.compareScenarios(parsed.data);
      setResult(res.data);
      setStub(res.stub);
      setStubMessage(res.stubMessage);
    } catch (err) {
      const e = err as CallError;
      toast.error(`compare_scenarios failed: ${e.message}`);
    } finally {
      setRunning(false);
    }
  };

  const chartData =
    result?.scenarios.map((s) => ({
      name: s.name,
      Tires: s.tire_cost_usd_per_year,
      Fuel: s.fuel_cost_usd_per_year,
      Maintenance: s.maintenance_cost_usd_per_year,
    })) ?? [];

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        title="Economics"
        description="Compare operating cost (tires, fuel, maintenance) across pavement scenarios."
        actions={
          <Button onClick={compute} disabled={running || scenarios.length < 2}>
            <Calculator className="h-4 w-4" />
            {running ? "Computing..." : "Compare scenarios"}
          </Button>
        }
      />

      <div className="grid flex-1 gap-4 overflow-auto p-6 lg:grid-cols-[1fr,1fr]">
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle>Scenarios</CardTitle>
            <Button variant="outline" size="sm" onClick={add}>
              <Plus className="h-4 w-4" />
              Add scenario
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            {scenarios.map((s, idx) => (
              <div key={idx} className="rounded border p-3">
                <div className="mb-2 flex items-center justify-between">
                  <Input
                    value={s.name}
                    onChange={(e) => update(idx, { name: e.target.value })}
                    className="max-w-[240px]"
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => remove(idx)}
                    aria-label="Remove scenario"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label>Surface</Label>
                    <select
                      value={s.surface}
                      onChange={(e) =>
                        update(idx, {
                          surface: e.target.value as CostScenario["surface"],
                        })
                      }
                      className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                    >
                      <option value="asphalt">Asphalt</option>
                      <option value="gravel">Gravel</option>
                      <option value="concrete">Concrete</option>
                    </select>
                  </div>
                  <NumField
                    label="Thickness (mm)"
                    value={s.thickness_mm}
                    onChange={(v) => update(idx, { thickness_mm: v })}
                  />
                  <NumField
                    label="Haul distance (km)"
                    value={s.haul_distance_km}
                    onChange={(v) => update(idx, { haul_distance_km: v })}
                  />
                  <NumField
                    label="Trips/day"
                    value={s.trips_per_day}
                    onChange={(v) => update(idx, { trips_per_day: v })}
                  />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Comparison</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {stub ? <StubBanner message={stubMessage} /> : null}
            {chartData.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Run "Compare scenarios" to see operating cost breakdown.
              </p>
            ) : (
              <>
                <div className="h-72 w-full">
                  <ResponsiveContainer>
                    <BarChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" />
                      <YAxis tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                      <Tooltip
                        formatter={(value: number) => formatCurrency(value)}
                      />
                      <Legend />
                      <Bar dataKey="Tires" stackId="a" fill="#ef4444" />
                      <Bar dataKey="Fuel" stackId="a" fill="#f59e0b" />
                      <Bar dataKey="Maintenance" stackId="a" fill="#3b82f6" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <SummaryTable rows={result?.scenarios ?? []} />
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function NumField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="space-y-1">
      <Label>{label}</Label>
      <Input
        type="number"
        min={0}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </div>
  );
}

function SummaryTable({ rows }: { rows: ScenarioComparison[] }) {
  if (!rows.length) return null;
  return (
    <table className="w-full text-sm">
      <thead className="text-xs uppercase text-muted-foreground">
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
