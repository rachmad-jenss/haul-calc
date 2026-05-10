import { useEffect, useState } from "react";
import { Plus, Trash2, Calculator } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/PageHeader";
import { StubBanner } from "@/components/StubBanner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { haulPave } from "@/lib/haulpave-client";
import { cesaRequestSchema, firstError } from "@/lib/schemas";
import type { CallError, CesaResult, FleetEntry, Vehicle } from "@/lib/types";
import { formatNumber } from "@/lib/utils";

const DEFAULT_FLEET: FleetEntry[] = [
  { vehicle_id: "cat-797f", count: 8, trips_per_day: 22, payload_kn: 4_000 },
  { vehicle_id: "cat-789d", count: 4, trips_per_day: 24, payload_kn: 2_100 },
];

export default function FleetTraffic() {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [fleet, setFleet] = useState<FleetEntry[]>(DEFAULT_FLEET);
  const [designLife, setDesignLife] = useState(10);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<CesaResult | null>(null);
  const [stub, setStub] = useState(false);
  const [stubMessage, setStubMessage] = useState<string>();

  useEffect(() => {
    haulPave
      .listVehicles()
      .then((res) => setVehicles(res.data))
      .catch((err: CallError) => {
        toast.error(`Failed to load vehicles: ${err.message}`);
      });
  }, []);

  const updateRow = (idx: number, patch: Partial<FleetEntry>) => {
    setFleet((prev) => prev.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  };

  const addRow = () => {
    const first = vehicles[0]?.id ?? "cat-797f";
    setFleet((prev) => [
      ...prev,
      { vehicle_id: first, count: 1, trips_per_day: 20, payload_kn: 3_000 },
    ]);
  };

  const removeRow = (idx: number) => {
    setFleet((prev) => prev.filter((_, i) => i !== idx));
  };

  const compute = async () => {
    const parsed = cesaRequestSchema.safeParse({ fleet, design_life_years: designLife });
    if (!parsed.success) {
      toast.error(firstError(parsed.error));
      return;
    }
    setRunning(true);
    try {
      const res = await haulPave.computeCesa(parsed.data);
      setResult(res.data);
      setStub(res.stub);
      setStubMessage(res.stubMessage);
    } catch (err) {
      const e = err as CallError;
      toast.error(`compute_cesa failed: ${e.message}`);
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        title="Fleet & Traffic"
        description="Define mining fleet composition and compute CESA + design coverages."
        actions={
          <Button onClick={compute} disabled={running}>
            <Calculator className="h-4 w-4" />
            {running ? "Computing..." : "Compute CESA"}
          </Button>
        }
      />

      <div className="grid flex-1 gap-4 overflow-auto p-6 lg:grid-cols-[1fr,360px]">
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle>Fleet composition</CardTitle>
            <Button variant="outline" size="sm" onClick={addRow}>
              <Plus className="h-4 w-4" />
              Add row
            </Button>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-2 py-2 font-medium">Vehicle</th>
                    <th className="px-2 py-2 font-medium">Count</th>
                    <th className="px-2 py-2 font-medium">Trips/day</th>
                    <th className="px-2 py-2 font-medium">Payload (kN)</th>
                    <th className="w-10" />
                  </tr>
                </thead>
                <tbody>
                  {fleet.map((row, idx) => (
                    <tr key={idx} className="border-b last:border-0">
                      <td className="px-2 py-2">
                        <select
                          value={row.vehicle_id}
                          onChange={(e) =>
                            updateRow(idx, { vehicle_id: e.target.value })
                          }
                          className="h-8 w-full rounded border border-input bg-background px-2 text-sm"
                        >
                          {vehicles.length === 0 ? (
                            <option value={row.vehicle_id}>{row.vehicle_id}</option>
                          ) : (
                            vehicles.map((v) => (
                              <option key={v.id} value={v.id}>
                                {v.name}
                              </option>
                            ))
                          )}
                        </select>
                      </td>
                      <td className="px-2 py-2">
                        <Input
                          type="number"
                          min={1}
                          value={row.count}
                          onChange={(e) =>
                            updateRow(idx, { count: Number(e.target.value) })
                          }
                        />
                      </td>
                      <td className="px-2 py-2">
                        <Input
                          type="number"
                          min={0}
                          value={row.trips_per_day}
                          onChange={(e) =>
                            updateRow(idx, {
                              trips_per_day: Number(e.target.value),
                            })
                          }
                        />
                      </td>
                      <td className="px-2 py-2">
                        <Input
                          type="number"
                          min={0}
                          value={row.payload_kn}
                          onChange={(e) =>
                            updateRow(idx, { payload_kn: Number(e.target.value) })
                          }
                        />
                      </td>
                      <td className="px-2 py-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => removeRow(idx)}
                          aria-label="Remove row"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-4 flex items-end gap-3">
              <div className="space-y-1">
                <Label htmlFor="design-life">Design life (years)</Label>
                <Input
                  id="design-life"
                  type="number"
                  min={1}
                  max={50}
                  value={designLife}
                  onChange={(e) => setDesignLife(Number(e.target.value))}
                  className="w-32"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>CESA result</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {stub ? <StubBanner message={stubMessage} /> : null}
              {result ? (
                <>
                  <Metric label="CESA" value={formatNumber(result.cesa, 0)} />
                  <Metric
                    label="Design coverages"
                    value={formatNumber(result.design_coverages, 0)}
                  />
                  <Metric
                    label="Design life"
                    value={`${result.design_life_years} yr`}
                  />
                </>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Run "Compute CESA" to see results here.
                </p>
              )}
            </CardContent>
          </Card>

          {result?.axle_load_distribution.length ? (
            <Card>
              <CardHeader>
                <CardTitle>Axle load distribution</CardTitle>
              </CardHeader>
              <CardContent>
                <table className="w-full text-sm">
                  <thead className="text-xs uppercase text-muted-foreground">
                    <tr>
                      <th className="px-2 py-1 text-left font-medium">Axle (kN)</th>
                      <th className="px-2 py-1 text-right font-medium">Passes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.axle_load_distribution.map((a, i) => (
                      <tr key={i} className="border-t">
                        <td className="px-2 py-1">{formatNumber(a.axle_kn, 0)}</td>
                        <td className="px-2 py-1 text-right">
                          {formatNumber(a.passes, 0)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between border-b pb-2 last:border-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="font-mono text-base font-semibold">{value}</span>
    </div>
  );
}
