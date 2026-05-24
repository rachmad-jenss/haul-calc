import { useEffect, useState } from "react";
import {
  IconChevronDownOutline18,
  IconChevronUpOutline18,
  IconDesktopArrowDownOutline18,
  IconFacePlusOutline18,
  IconFileContentOutline18,
  IconFiles2Outline18,
  IconForkliftOutline18,
  IconGauge3Outline18,
  IconInboxArrowDownOutline18,
  IconPlusOutline18,
  IconTrashOutline18,
  IconTriangleWarningOutline18,
} from "nucleo-ui-essential-outline-18";
import { nucleoIconProps } from "@/lib/icons";
import { toast } from "sonner";
import { CsvImportModal } from "@/components/CsvImportModal";
import { CustomVehicleModal } from "@/components/CustomVehicleModal";
import { PageHeader } from "@/components/PageHeader";
import { ResultStaleBadge } from "@/components/ResultStaleBadge";
import { StubBanner } from "@/components/StubBanner";
import { FieldError, Metric } from "@/components/FormFields";
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
import { save } from "@tauri-apps/plugin-dialog";
import { writeTextFile } from "@tauri-apps/plugin-fs";
import { haulPave } from "@/lib/haulpave-client";
import { cesaRequestSchema, fieldErrorsFromZod, firstError } from "@/lib/schemas";
import { useCalcStore } from "@/lib/store";
import type { CallError, FleetEntry, Vehicle } from "@/lib/types";
import {
  convertPayload,
  formatForceKn,
  labelWithUnit,
  PAYLOAD_TYPICAL_LOW_KN,
  PAYLOAD_TYPICAL_MAX_KN,
  unitLabels,
} from "@/lib/unit-convert";
import { cn, formatNumber, parseNumericInput, toSafeCsvCell } from "@/lib/utils";

const ICON_16 = nucleoIconProps({ size: 16 });
const ICON_12 = nucleoIconProps({ size: 12 });
const ICON_40_MUTED = nucleoIconProps({ size: 40, className: "text-muted-foreground" });

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
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const rowFieldError = (idx: number, field: string) => fieldErrors[`fleet.${idx}.${field}`];
  const clearFieldErrors = (...keys: string[]) => {
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
  };

  useEffect(() => {
    haulPave
      .listVehicles()
      .then((res) => setVehicles(res.data))
      .catch((err: CallError) => {
        toast.error(`Failed to load vehicles: ${err.message}`);
      });
  }, []);

  const updateRow = (idx: number, patch: Partial<FleetEntry>) => {
    const keys = Object.keys(patch).map((f) => `fleet.${idx}.${f}`);
    clearFieldErrors(...keys, "fleet");
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
    const parsed = cesaRequestSchema.safeParse({
      fleet,
      design_life_years: designLifeYears,
      working_days_per_year: workingDaysPerYear,
    });
    if (!parsed.success) {
      setFieldErrors(fieldErrorsFromZod(parsed.error));
      toast.error(firstError(parsed.error));
      return;
    }
    setFieldErrors({});
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
            <IconGauge3Outline18 {...ICON_16} aria-hidden />
            {running ? "Computing..." : "Compute CESA"}
          </Button>
        }
      />

      <div className="grid min-h-0 flex-1 gap-4 p-6 lg:grid-cols-[1fr,360px]">
        <Card className="flex min-h-0 flex-col">
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle className="text-md">Fleet composition</CardTitle>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setShowCustomModal(true)}>
                <IconFacePlusOutline18 {...ICON_16} aria-hidden />
                Custom vehicles
              </Button>
              {fleet.length > 0 ? (
                <>
                  <Button variant="outline" size="sm" onClick={handleLoadSample}>
                    <IconFileContentOutline18 {...ICON_16} aria-hidden />
                    Sample Fleet
                  </Button>
                  <Button variant="outline" size="sm" onClick={handleExportCsv}>
                    <IconDesktopArrowDownOutline18 {...ICON_16} aria-hidden />
                    Export CSV
                  </Button>
                  <Button variant="outline" size="sm" onClick={addRow}>
                    <IconPlusOutline18 {...ICON_16} aria-hidden />
                    Add row
                  </Button>
                </>
              ) : null}
              <Button variant="outline" size="sm" onClick={() => setShowCsvModal(true)}>
                <IconInboxArrowDownOutline18 {...ICON_16} aria-hidden />
                Import CSV
              </Button>
            </div>
          </CardHeader>
          <CardContent className="flex min-h-0 flex-1 flex-col">
            {fleet.length === 0 ? (
              <div
                className="flex flex-col items-center justify-center gap-4 rounded-md border border-dashed py-12 text-center"
                data-testid="fleet-empty-state"
              >
                {fieldErrors.fleet ? (
                  <FieldError message={fieldErrors.fleet} />
                ) : null}
                <IconForkliftOutline18 {...ICON_40_MUTED} aria-hidden />
                <div className="space-y-1">
                  <p className="font-medium">No vehicles in fleet</p>
                  <p className="max-w-sm text-base text-subtle">
                    Add a row or load the sample fleet to start CESA and coverages.
                  </p>
                </div>
                <div className="flex flex-wrap justify-center gap-2">
                  <Button onClick={addRow}>
                    <IconPlusOutline18 {...ICON_16} aria-hidden />
                    Add row
                  </Button>
                  <Button variant="outline" onClick={handleLoadSample}>
                    <IconFileContentOutline18 {...ICON_16} aria-hidden />
                    Sample fleet
                  </Button>
                </div>
              </div>
            ) : (
            <div className="min-h-0 flex-1 overflow-auto rounded-md border">
              <table className="w-full text-base">
                <thead className="border-b text-left text-2xs uppercase tracking-wide text-subtle">
                  <tr>
                    <th className="px-2 py-2 font-medium">Vehicle</th>
                    <th className="px-2 py-2 font-medium">Count</th>
                    <th className="px-2 py-2 font-medium">Trips/day</th>
                    <th className="px-2 py-2 font-medium">Payload ({unitLabels.SI.payload})</th>
                    <th className="w-16" />
                  </tr>
                </thead>
                <tbody>
                  {fleet.map((row, idx) => (
                    <tr key={row._id} className="border-b last:border-0">
                      <td className="px-2 py-2">
                        <Select
                          value={row.vehicle_id}
                          onValueChange={(vehicle_id) => updateRow(idx, { vehicle_id })}
                        >
                          <SelectTrigger
                            className={cn(
                              "h-8",
                              rowFieldError(idx, "vehicle_id") && "border-destructive",
                            )}
                            aria-invalid={rowFieldError(idx, "vehicle_id") ? true : undefined}
                          >
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {allVehicles.length === 0 ? (
                              <SelectItem value={row.vehicle_id}>{row.vehicle_id}</SelectItem>
                            ) : (
                              allVehicles.map((v) => (
                                <SelectItem key={v.id} value={v.id}>
                                  {v.name}
                                </SelectItem>
                              ))
                            )}
                          </SelectContent>
                        </Select>
                        <FieldError message={rowFieldError(idx, "vehicle_id")} />
                      </td>
                      <td className="px-2 py-2">
                        <Input
                          type="number"
                          min={1}
                          value={row.count}
                          aria-invalid={rowFieldError(idx, "count") ? true : undefined}
                          className={cn(rowFieldError(idx, "count") && "border-destructive")}
                          onChange={(e) =>
                            updateRow(idx, { count: parseNumericInput(e.target.value, row.count) })
                          }
                        />
                        <FieldError message={rowFieldError(idx, "count")} />
                      </td>
                      <td className="px-2 py-2">
                        <Input
                          type="number"
                          min={1}
                          value={row.trips_per_day}
                          aria-invalid={rowFieldError(idx, "trips_per_day") ? true : undefined}
                          className={cn(rowFieldError(idx, "trips_per_day") && "border-destructive")}
                          onChange={(e) =>
                            updateRow(idx, {
                              trips_per_day: parseNumericInput(e.target.value, row.trips_per_day),
                            })
                          }
                        />
                        <FieldError message={rowFieldError(idx, "trips_per_day")} />
                        {row.trips_per_day > 100 && (
                          <p className="mt-0.5 flex items-center gap-1 text-2xs text-amber-600 dark:text-amber-400">
                            <IconTriangleWarningOutline18 {...ICON_12} aria-hidden />
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
                            aria-invalid={rowFieldError(idx, "payload_kn") ? true : undefined}
                            className={cn(rowFieldError(idx, "payload_kn") && "border-destructive")}
                            onChange={(e) =>
                              updateRow(idx, {
                                payload_kn: parseNumericInput(e.target.value, row.payload_kn),
                              })
                            }
                          />
                          {unitSystem === "Imperial" && (
                            <span className="shrink-0 text-2xs text-subtle">
                              {formatNumber(convertPayload(row.payload_kn, unitSystem), 1)}{" "}
                              {unitLabels.Imperial.payload}
                            </span>
                          )}
                        </div>
                        {row.payload_kn > PAYLOAD_TYPICAL_MAX_KN && (
                          <p className="mt-0.5 flex items-center gap-1 text-2xs text-amber-600 dark:text-amber-400">
                            <IconTriangleWarningOutline18 {...ICON_12} aria-hidden />
                            Exceeds typical max (~{formatForceKn(PAYLOAD_TYPICAL_MAX_KN, unitSystem)})
                          </p>
                        )}
                        {unitSystem === "SI" &&
                          row.payload_kn > 0 &&
                          row.payload_kn < PAYLOAD_TYPICAL_LOW_KN && (
                          <p className="mt-0.5 flex items-center gap-1 text-2xs text-amber-600 dark:text-amber-400">
                            <IconTriangleWarningOutline18 {...ICON_12} aria-hidden />
                            Very low — verify units (kN)
                          </p>
                        )}
                        <FieldError message={rowFieldError(idx, "payload_kn")} />
                      </td>
                      <td className="px-2 py-2 flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          disabled={idx === 0}
                          onClick={() => moveRow(idx, -1)}
                          aria-label="Move row up"
                        >
                          <IconChevronUpOutline18 {...ICON_16} aria-hidden />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          disabled={idx === fleet.length - 1}
                          onClick={() => moveRow(idx, 1)}
                          aria-label="Move row down"
                        >
                          <IconChevronDownOutline18 {...ICON_16} aria-hidden />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => duplicateRow(idx)}
                          aria-label="Duplicate row"
                        >
                          <IconFiles2Outline18 {...ICON_16} aria-hidden />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => removeRow(idx)}
                          aria-label="Remove row"
                        >
                          <IconTrashOutline18 {...ICON_16} aria-hidden />
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
                  aria-invalid={fieldErrors.design_life_years ? true : undefined}
                  className={cn("w-32", fieldErrors.design_life_years && "border-destructive")}
                  onChange={(e) => {
                    clearFieldErrors("design_life_years");
                    setDesignLifeYears(parseNumericInput(e.target.value, designLifeYears));
                  }}
                />
                <FieldError message={fieldErrors.design_life_years} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="working-days">Working days/year</Label>
                <Input
                  id="working-days"
                  type="number"
                  min={1}
                  max={365}
                  value={workingDaysPerYear}
                  aria-invalid={fieldErrors.working_days_per_year ? true : undefined}
                  className={cn("w-32", fieldErrors.working_days_per_year && "border-destructive")}
                  onChange={(e) => {
                    clearFieldErrors("working_days_per_year");
                    setWorkingDaysPerYear(parseNumericInput(e.target.value, workingDaysPerYear));
                  }}
                />
                <FieldError message={fieldErrors.working_days_per_year} />
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader className="flex-row items-center gap-2">
              <CardTitle className="text-md">CESA result</CardTitle>
              {cesaResult && cesaDirty && (
                <ResultStaleBadge onRecalculate={compute} recalculating={running} />
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
                <p className="text-base text-subtle">
                  Run "Compute CESA" to see results here.
                </p>
              )}
            </CardContent>
          </Card>

          {cesaResult?.axle_load_distribution?.length ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-md">Axle load distribution</CardTitle>
              </CardHeader>
              <CardContent>
                <table className="w-full text-base">
                  <thead className="text-2xs uppercase tracking-wide text-subtle">
                    <tr>
                      <th className="px-2 py-1 text-left font-medium">
                        {labelWithUnit("Axle", unitSystem, "force")}
                      </th>
                      <th className="px-2 py-1 text-right font-medium">Passes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cesaResult.axle_load_distribution.map((a, i) => (
                      <tr key={i} className="border-t">
                        <td className="px-2 py-1">
                          {formatNumber(convertPayload(a.axle_kn, unitSystem), unitSystem === "Imperial" ? 1 : 0)}
                        </td>
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
