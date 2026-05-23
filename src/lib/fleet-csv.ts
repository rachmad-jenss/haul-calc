/** Parse fleet CSV for import modal (vehicle_id, count, trips_per_day, payload_kn). */

export interface ParsedFleetRow {
  vehicle_id: string;
  count: number;
  trips_per_day: number;
  payload_kn: number;
}

export interface FleetCsvParseResult {
  rows: ParsedFleetRow[];
  errors: string[];
}

export function parseFleetCsv(text: string): FleetCsvParseResult {
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

  const rows: ParsedFleetRow[] = [];
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
    if (!Number.isFinite(trips_per_day) || trips_per_day < 1) {
      errors.push(
        `Row ${i}: trips_per_day must be at least 1 (same as Compute CESA; got "${cols[idx.trips_per_day]}").`,
      );
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
