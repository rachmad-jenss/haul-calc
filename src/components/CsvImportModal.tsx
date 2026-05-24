import { useEffect, useRef, useState } from "react";
import {
  IconCircleInfoOutline18,
  IconCircleHalfDottedCheckOutline18,
  IconInboxArrowDownOutline18,
} from "nucleo-ui-essential-outline-18";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { nucleoIconProps } from "@/lib/icons";
import { parseFleetCsv, type FleetCsvParseResult } from "@/lib/fleet-csv";
import type { FleetEntry } from "@/lib/types";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImport: (entries: FleetEntry[]) => void;
}

export function CsvImportModal({ open, onOpenChange, onImport }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [parseResult, setParseResult] = useState<FleetCsvParseResult | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setParseResult(null);
      setFileName(null);
      return;
    }
    const t = window.setTimeout(() => {
      contentRef.current?.querySelector<HTMLElement>("button")?.focus();
    }, 0);
    return () => window.clearTimeout(t);
  }, [open]);

  const handleClose = () => {
    setParseResult(null);
    setFileName(null);
    onOpenChange(false);
  };

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      setParseResult(parseFleetCsv(text));
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const handleImport = () => {
    if (!parseResult || parseResult.rows.length === 0) return;
    const entries: FleetEntry[] = parseResult.rows.map((r) => ({
      _id: crypto.randomUUID(),
      vehicle_id: r.vehicle_id,
      count: r.count,
      trips_per_day: r.trips_per_day,
      payload_kn: r.payload_kn,
    }));
    onImport(entries);
    handleClose();
  };

  const hasRows = (parseResult?.rows.length ?? 0) > 0;
  const hasErrors = (parseResult?.errors.length ?? 0) > 0;

  return (
    <Dialog open={open} onOpenChange={(next) => (next ? onOpenChange(true) : handleClose())}>
      <DialogContent ref={contentRef} className="max-w-lg" aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle id="csv-import-title">Import fleet from CSV</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <p className="text-md text-subtle">
            CSV must include a header row with columns:{" "}
            <code className="rounded bg-muted px-1 text-2xs">
              vehicle_id, count, trips_per_day, payload_kn
            </code>
          </p>

          <div className="flex items-center gap-3">
            <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
              <IconInboxArrowDownOutline18 {...nucleoIconProps({ size: 16 })} aria-hidden />
              Choose CSV file
            </Button>
            {fileName && (
              <span className="truncate text-md text-subtle">{fileName}</span>
            )}
            <input
              ref={fileRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={handleFile}
            />
          </div>

          {parseResult && (
            <div className="space-y-2">
              {hasErrors && (
                <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-md">
                  <div className="mb-1 flex items-center gap-1.5 font-medium text-destructive">
                    <IconCircleInfoOutline18 {...nucleoIconProps({ size: 16 })} aria-hidden />
                    {parseResult.errors.length} error{parseResult.errors.length > 1 ? "s" : ""}
                  </div>
                  <ul className="list-inside list-disc space-y-0.5 text-md text-destructive">
                    {parseResult.errors.map((err, i) => (
                      <li key={i}>{err}</li>
                    ))}
                  </ul>
                </div>
              )}

              {hasRows && (
                <div className="rounded-md border bg-muted/30 p-3">
                  <div className="mb-2 flex items-center gap-1.5 text-md font-medium text-strong">
                    <IconCircleHalfDottedCheckOutline18
                      {...nucleoIconProps({ size: 16, className: "text-primary" })}
                      aria-hidden
                    />
                    {parseResult.rows.length} row{parseResult.rows.length > 1 ? "s" : ""} ready to import
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-2xs">
                      <thead className="text-left text-subtle">
                        <tr>
                          <th className="pr-3 py-1 font-medium">Vehicle ID</th>
                          <th className="pr-3 py-1 font-medium">Count</th>
                          <th className="pr-3 py-1 font-medium">Trips/day</th>
                          <th className="py-1 font-medium">Payload (kN)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {parseResult.rows.map((r, i) => (
                          <tr key={i} className="border-t">
                            <td className="pr-3 py-1 font-mono">{r.vehicle_id}</td>
                            <td className="pr-3 py-1">{r.count}</td>
                            <td className="pr-3 py-1">{r.trips_per_day}</td>
                            <td className="py-1">{r.payload_kn}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button onClick={handleImport} disabled={!hasRows}>
            {hasRows
              ? `Import ${parseResult!.rows.length} row${parseResult!.rows.length > 1 ? "s" : ""}`
              : "Import"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
