import { useEffect, useState } from "react";
import { ChevronDown, ChevronUp, Download, Plus, Trash2, Calculator, UserPlus, FileUp, FileJson, AlertTriangle, Copy, Truck } from "lucide-react";
import { toast } from "sonner";
import { CsvImportModal } from "@/components/CsvImportModal";
import { CustomVehicleModal } from "@/components/CustomVehicleModal";
import { PageHeader } from "@/components/PageHeader";
import { StubBanner } from "@/components/StubBanner";
import { Metric } from "@/components/FormFields";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { save } from "@tauri-apps/plugin-dialog";
import { writeTextFile } from "@tauri-apps/plugin-fs";
import { haulPave } from "@/lib/haulpave-client";
import { cesaRequestSchema, firstError } from "@/lib/schemas";
import { useCalcStore } from "@/lib/store";
import type { CallError, FleetEntry, Vehicle } from "@/lib/types";
import { convertPayload, unitLabels } from "@/lib/unit-convert";
import { formatNumber, parseNumericInput, toSafeCsvCell } from "@/lib/utils";

export default function FleetTraffic() {
  const {
    fleet,
    designLifeYears,
    workingDaysPerYear,
    cesaResult,
    cesaDirty,
    customVehicles,
    unitSystem,
    setFleet,
    setDesignLifeYears,
    setWorkingDaysPerYear,
    setCesaResult,
  } = useCalcStore();

  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [running, setRunning] = useState(false);
  const [showCustomModal, setShowCustomModal] = useState(false);
  const [showCsvModal, setShowCsvModal] = useState(false);

  useEffect(() => {
    haulPave
      .listVehicles()
      .then((res) => setVehicles(res.data))
      .catch((err: CallError) => {
        toast.error(`Failed to load vehicles: ${err.message}`);
      });
  }, []);

  const updateRow = (idx: number, patch: Partial<FleetEntry>) => {
    setFleet(fleet.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  };

  const allVehicles: Vehicle[] = [
    ...vehicles,
    ...customVehicles.map((cv) => ({
      id: cv.id,
      name: cv.name + " (custom)",
      gvw_kn: cv.gvw_kn,
      axles: cv.axles,
    })),
  ];

  const addRow = () => {
    const first = allVehicles[0]?.id ?? "cat-797f";
    setFleet([
      ...fleet,
      { _id: crypto.randomUUID(), vehicle_id: first, count: 1, trips_per_day: 20, payload_kn: 3_000 },
    ]);
  };

  const removeRow = (idx: number) => {
    setFleet(fleet.filter((_, i) => i !== idx));
  };

  const duplicateRow = (idx: number) => {
    const row = fleet[idx];
    if (!row) return;
    const newFleet = [...fleet];
    newFleet.splice(idx + 1, 0, { ...row, _id: crypto.randomUUID() });
    setFleet(newFleet);
  };

  const moveRow = (idx: number, direction: -1 | 1) => {
    const target = idx + direction;
    if (target < 0 || target >= fleet.length) return;
    const newFleet = [...fleet];
    [newFleet[idx], newFleet[target]] = [newFleet[target], newFleet[idx]];
    setFleet(newFleet);
  };

  const handleLoadSample = async () => {
    try {
      const res = await fetch("/sample_fleet.json");
      if (!res.ok) { toast.error("Failed to load sample fleet."); return; }
      const data = await res.json();
      if (!data.fleet || !Array.isArray(data.fleet)) { toast.error("Invalid sample data."); return; }
      const entries: FleetEntry[] = [];
      for (const f of data.fleet) {
        if (typeof f.vehicle_id !== "string" || f.vehicle_id.length === 0 ||
            !Number.isFinite(f.count) || f.count < 1 ||
            !Number.isFinite(f.trips_per_day) || f.trips_per_day < 1 ||
            !Number.isFinite(f.payload_kn) || f.payload_kn <= 0) {
          toast.error("Sample data contains invalid entries.");
          return;
        }
        entries.push({
          _id: crypto.randomUUID(),
          vehicle_id: f.vehicle_id,
          count: f.count,
          trips_per_day: f.trips_per_day,
          payload_kn: f.payload_kn,
        });
      }
      setFleet(entries);
      if (typeof data.design_life_years === "number") {
        setDesignLifeYears(data.design_life_years);
        toast.info(`Design life set to ${data.design_life_years} years.`);
      }
      toast.success(`Loaded ${entries.length} sample vehicles.`);
    } catch (err) {
      toast.error("Failed to load sample fleet. Check console for details.");
      console.error(err);
    }
  };

  const handleExportCsv = async () => {
    if (fleet.length === 0) {
      toast.error("No fleet data to export.");
      return;
    }
    try {
      const path = await save({
        defaultPath: "fleet_data.csv",
        filters: [{ name: "CSV", extensions: ["csv"] }],
      });
      if (!path) return;

      const vehicleMap = new Map(allVehicles.map((v) => [v.id, v.name]));
      const header = ["Vehicle", "Count", "Trips/day", "Payload (kN)"];
      const lines = [header.join(",")];
      for (const row of fleet) {
        const name = vehicleMap.get(row.vehicle_id) ?? row.vehicle_id;
        lines.push(
          [toSafeCsvCell(name), row.count, row.trips_per_day, row.payload_kn].join(",")
        );
      }
      await writeTextFile(path, lines.join("\n"));
      toast.success(`Saved to ${path}`);
    } catch (err) {
      toast.error(`Export failed: ${String(err)}`);
    }
  };

  const compute = async () => {
    if (fleet.length === 0) {
      toast.error("Fleet is empty. Add at least one vehicle row.");
      return;
    }
    if (fleet.some((e) => e.trips_per_day < 1)) {
      toast.error("All vehicles must have at least 1 trip per day.");
      return;
    }
    const parsed = cesaRequestSchema.safeParse({
      fleet,
      design_life_years: designLifeYears,
      working_days_per_year: workingDaysPerYear,
    });
    if (!parsed.success) {
      toast.error(firstError(parsed.error));
      return;
    }
    setRunning(true);
    try {
      const res = await haulPave.computeCesa(parsed.data);
      setCesaResult(res.data, res.stub, res.stubMessage);
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
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setShowCustomModal(true)}>
                <UserPlus className="h-4 w-4" />
                Custom vehicles
              </Button>
              {fleet.length > 0 ? (
                <>
                  <Button variant="outline" size="sm" onClick={handleLoadSample}>
                    <FileJson className="h-4 w-4" />
                    Sample Fleet
                  </Button>
                  <Button variant="outline" size="sm" onClick={handleExportCsv}>
                    <Download className="h-4 w-4" />
                    Export CSV
                  </Button>
                  <Button variant="outline" size="sm" onClick={addRow}>
                    <Plus className="h-4 w-4" />
                    Add row
                  </Button>
                </>
              ) : null}
              <Button variant="outline" size="sm" onClick={() => setShowCsvModal(true)}>
                <FileUp className="h-4 w-4" />
                Import CSV
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {fleet.length === 0 ? (
              <div
                className="flex flex-col items-center justify-center gap-4 rounded-md border border-dashed py-12 text-center"
                data-testid="fleet-empty-state"
              >
                <Truck className="h-10 w-10 text-muted-foreground" aria-hidden />
                <div className="space-y-1">
                  <p className="font-medium">No vehicles in fleet</p>
                  <p className="max-w-sm text-sm text-muted-foreground">
                    Add a row or load the sample fleet to start CESA and coverages.
                  </p>
                </div>
                <div className="flex flex-wrap justify-center gap-2">
                  <Button onClick={addRow}>
                    <Plus className="h-4 w-4" />
                    Add row
                  </Button>
                  <Button variant="outline" onClick={handleLoadSample}>
                    <FileJson className="h-4 w-4" />
                    Sample fleet
                  </Button>
                </div>
              </div>
            ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-2 py-2 font-medium">Vehicle</th>
                    <th className="px-2 py-2 font-medium">Count</th>
                    <th className="px-2 py-2 font-medium">Trips/day</th>
                    <th className="px-2 py-2 font-medium">Payload ({unitLabels[unitSystem].payload})</th>
                    <th className="w-16" />
                  </tr>
                </thead>
                <tbody>
                  {fleet.map((row, idx) => (
                    <tr key={row._id} className="border-b last:border-0">
                      <td className="px-2 py-2">
                        <select
                          value={row.vehicle_id}
                          onChange={(e) => updateRow(idx, { vehicle_id: e.target.value })}
                          className="h-8 w-full rounded border border-input bg-background px-2 text-sm"
                        >
                          {allVehicles.length === 0 ? (
                            <option value={row.vehicle_id}>{row.vehicle_id}</option>
                          ) : (
                            allVehicles.map((v) => (
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
                            updateRow(idx, { count: parseNumericInput(e.target.value, row.count) })
                          }
                        />
                      </td>
                      <td className="px-2 py-2">
                        <Input
                          type="number"
                          min={1}
                          value={row.trips_per_day}
                          onChange={(e) =>
                            updateRow(idx, {
                              trips_per_day: parseNumericInput(e.target.value, row.trips_per_day),
                            })
                          }
                        />
                        {row.trips_per_day > 100 && (
                          <p className="mt-0.5 flex items-center gap-1 text-[11px] text-amber-600 dark:text-amber-400">
                            <AlertTriangle className="h-3 w-3 shrink-0" />
                            High — verify trip count
                          </p>
                        )}
                      </td>
                      <td className="px-2 py-2">
                        <div className="flex items-center gap-1.5">
                          <Input
                            type="number"
                            min={0}
                            value={row.payload_kn}
                            onChange={(e) =>
                              updateRow(idx, {
                                payload_kn: parseNumericInput(e.target.value, row.payload_kn),
                              })
                            }
                          />
                          {unitSystem === 'Imperial' && (
                            <span className="shrink-0 text-xs text-muted-foreground">
                              {formatNumber(convertPayload(row.payload_kn, unitSystem), 1)} kips
                            </span>
                          )}
                        </div>
                        {row.payload_kn > 5_000 && (
                          <p className="mt-0.5 flex items-center gap-1 text-[11px] text-amber-600 dark:text-amber-400">
                            <AlertTriangle className="h-3 w-3 shrink-0" />
                            Exceeds typical max (~5 000 kN)
                          </p>
                        )}
                        {unitSystem !== 'Imperial' && row.payload_kn > 0 && row.payload_kn < 200 && (
                          <p className="mt-0.5 flex items-center gap-1 text-[11px] text-amber-600 dark:text-amber-400">
                            <AlertTriangle className="h-3 w-3 shrink-0" />
                            Very low — verify units (kN)
                          </p>
                        )}
                      </td>
                      <td className="px-2 py-2 flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          disabled={idx === 0}
                          onClick={() => moveRow(idx, -1)}
                          aria-label="Move row up"
                        >
                          <ChevronUp className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          disabled={idx === fleet.length - 1}
                          onClick={() => moveRow(idx, 1)}
                          aria-label="Move row down"
                        >
                          <ChevronDown className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => duplicateRow(idx)}
                          aria-label="Duplicate row"
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
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
            )}

            <div className="mt-4 flex items-end gap-3">
              <div className="space-y-1">
                <Label htmlFor="design-life">Design life (years)</Label>
                <Input
                  id="design-life"
                  type="number"
                  min={1}
                  max={50}
                  value={designLifeYears}
                  onChange={(e) =>
                    setDesignLifeYears(parseNumericInput(e.target.value, designLifeYears))
                  }
                  className="w-32"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="working-days">Working days/year</Label>
                <Input
                  id="working-days"
                  type="number"
                  min={1}
                  max={365}
                  value={workingDaysPerYear}
                  onChange={(e) =>
                    setWorkingDaysPerYear(parseNumericInput(e.target.value, workingDaysPerYear))
                  }
                  className="w-32"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader className="flex-row items-center gap-2">
              <CardTitle>CESA result</CardTitle>
              {cesaResult && cesaDirty && (
                <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium uppercase text-amber-700 dark:bg-amber-900/40 dark:text-amber-400">
                  Stale
                </span>
              )}
            </CardHeader>
            <CardContent className="space-y-3">
              {cesaResult?.stub ? <StubBanner message={cesaResult.stubMessage} /> : null}
              {cesaResult ? (
                <>
                  <Metric label="CESA" value={formatNumber(cesaResult.cesa, 0)} />
                  <Metric
                    label="Design coverages"
                    value={formatNumber(cesaResult.design_coverages, 0)}
                  />
                  <Metric label="Design life" value={`${cesaResult.design_life_years} yr`} />
                </>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Run "Compute CESA" to see results here.
                </p>
              )}
            </CardContent>
          </Card>

          {cesaResult?.axle_load_distribution?.length ? (
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
                    {cesaResult.axle_load_distribution.map((a, i) => (
                      <tr key={i} className="border-t">
                        <td className="px-2 py-1">{formatNumber(a.axle_kn, 0)}</td>
                        <td className="px-2 py-1 text-right">{formatNumber(a.passes, 0)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          ) : null}
        </div>
      </div>
      <CustomVehicleModal open={showCustomModal} onOpenChange={setShowCustomModal} />
      <CsvImportModal
        open={showCsvModal}
        onOpenChange={setShowCsvModal}
        onImport={(entries) => {
          setFleet(entries);
          toast.success(`Imported ${entries.length} fleet row${entries.length > 1 ? "s" : ""}.`);
        }}
      />
    </div>
  );
}
