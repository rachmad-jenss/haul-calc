import { useRef, useState } from "react";
import { Upload, AlertCircle, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { FleetEntry } from "@/lib/types";

interface ParsedRow {
  vehicle_id: string;
  count: number;
  trips_per_day: number;
  payload_kn: number;
}

interface ParseResult {
  rows: ParsedRow[];
  errors: string[];
}

function parseCsv(text: string): ParseResult {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) {
    return { rows: [], errors: ["CSV must have a header row and at least one data row."] };
  }

  const header = lines[0].split(",").map((h) => h.trim().toLowerCase());
  const required = ["vehicle_id", "count", "trips_per_day", "payload_kn"];
  const missing = required.filter((r) => !header.includes(r));
  if (missing.length > 0) {
    return { rows: [], errors: [`Missing required columns: ${missing.join(", ")}`] };
  }

  const idx = {
    vehicle_id: header.indexOf("vehicle_id"),
    count: header.indexOf("count"),
    trips_per_day: header.indexOf("trips_per_day"),
    payload_kn: header.indexOf("payload_kn"),
  };

  const rows: ParsedRow[] = [];
  const errors: string[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const cols = line.split(",").map((c) => c.trim());

    const vehicle_id = cols[idx.vehicle_id] ?? "";
    const count = Number(cols[idx.count]);
    const trips_per_day = Number(cols[idx.trips_per_day]);
    const payload_kn = Number(cols[idx.payload_kn]);

    if (!vehicle_id) {
      errors.push(`Row ${i}: vehicle_id is empty.`);
      continue;
    }
    if (!Number.isInteger(count) || count < 1) {
      errors.push(`Row ${i}: count must be a positive integer (got "${cols[idx.count]}").`);
      continue;
    }
    if (!Number.isFinite(trips_per_day) || trips_per_day < 0) {
      errors.push(`Row ${i}: trips_per_day must be a non-negative number.`);
      continue;
    }
    if (!Number.isFinite(payload_kn) || payload_kn <= 0) {
      errors.push(`Row ${i}: payload_kn must be a positive number.`);
      continue;
    }

    rows.push({ vehicle_id, count, trips_per_day, payload_kn });
  }

  return { rows, errors };
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImport: (entries: FleetEntry[]) => void;
}

export function CsvImportModal({ open, onOpenChange, onImport }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [parseResult, setParseResult] = useState<ParseResult | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);

  if (!open) return null;

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
      setParseResult(parseCsv(text));
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
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      role="dialog"
      aria-modal="true"
      aria-labelledby="csv-import-title"
      tabIndex={-1}
      onKeyDown={(e) => { if (e.key === "Escape") handleClose(); }}
      onClick={(e) => { if (e.target === e.currentTarget) handleClose(); }}
    >
      <div className="w-full max-w-lg rounded-lg border bg-background p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 id="csv-import-title" className="text-lg font-semibold">Import fleet from CSV</h2>
          <button
            type="button"
            onClick={handleClose}
            className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            CSV must include a header row with columns:{" "}
            <code className="rounded bg-muted px-1 text-xs">
              vehicle_id, count, trips_per_day, payload_kn
            </code>
          </p>

          <div className="flex items-center gap-3">
            <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
              <Upload className="h-4 w-4" />
              Choose CSV file
            </Button>
            {fileName && (
              <span className="truncate text-sm text-muted-foreground">{fileName}</span>
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
                <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm">
                  <div className="mb-1 flex items-center gap-1.5 font-medium text-destructive">
                    <AlertCircle className="h-4 w-4" />
                    {parseResult.errors.length} error{parseResult.errors.length > 1 ? "s" : ""}
                  </div>
                  <ul className="list-inside list-disc space-y-0.5 text-xs text-destructive">
                    {parseResult.errors.map((err, i) => (
                      <li key={i}>{err}</li>
                    ))}
                  </ul>
                </div>
              )}

              {hasRows && (
                <div className="rounded-md border bg-muted/30 p-3">
                  <div className="mb-2 flex items-center gap-1.5 text-sm font-medium text-foreground">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                    {parseResult.rows.length} row{parseResult.rows.length > 1 ? "s" : ""} ready to import
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead className="text-left text-muted-foreground">
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

        <div className="mt-6 flex justify-end gap-2">
          <Button variant="outline" onClick={handleClose}>Cancel</Button>
          <Button onClick={handleImport} disabled={!hasRows}>
            {hasRows
              ? `Import ${parseResult!.rows.length} row${parseResult!.rows.length > 1 ? "s" : ""}`
              : "Import"}
          </Button>
        </div>
      </div>
    </div>
  );
}
