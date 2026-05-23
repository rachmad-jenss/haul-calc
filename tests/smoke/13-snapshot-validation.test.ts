import { test, expect } from "../fixtures";
import { parseSnapshot } from "../../src/lib/project-file";

test.describe("DAS-139 parseSnapshot validation", () => {
  test("rejects JSON missing required fleet shape", () => {
    const bad = JSON.stringify({ version: 2, designLifeYears: 10, fleet: [{ count: 1 }] });
    expect(() => parseSnapshot(bad)).toThrow(/File tidak valid/i);
  });

  test("rejects non-object payload", () => {
    expect(() => parseSnapshot("not json")).toThrow(/File tidak valid|corrupt/i);
  });

  test("accepts minimal valid v1-shaped snapshot", () => {
    const snap = parseSnapshot(
      JSON.stringify({
        version: 1,
        fleet: [
          {
            _id: "f1",
            vehicle_id: "cat-797f",
            count: 1,
            trips_per_day: 10,
            payload_kn: 4000,
          },
        ],
        designLifeYears: 10,
      }),
    );
    expect(snap.version).toBe(1);
    expect(snap.fleet).toHaveLength(1);
  });
});
