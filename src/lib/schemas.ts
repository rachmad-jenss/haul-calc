import { z } from "zod";

export const fleetEntrySchema = z.object({
  vehicle_id: z.string().min(1, "Vehicle ID required"),
  count: z.number().int().min(1, "Count must be at least 1"),
  trips_per_day: z.number().min(0.1, "Trips per day must be > 0"),
  payload_kn: z.number().min(1, "Payload must be > 0 kN"),
});

export const cesaRequestSchema = z.object({
  fleet: z
    .array(fleetEntrySchema)
    .min(1, "Add at least one vehicle to the fleet"),
  design_life_years: z.number().int().min(1, "Design life must be ≥ 1 year").max(50),
});

export const cbrRequestSchema = z.object({
  subgrade_cbr: z
    .number()
    .min(1, "Subgrade CBR must be ≥ 1%")
    .max(100, "Subgrade CBR must be ≤ 100%"),
  design_coverages: z.number().min(1, "Design coverages must be > 0"),
});

export const trh14RequestSchema = z.object({
  category: z.enum(["A", "B", "C", "D"]),
  design_coverages: z.number().min(1, "Design coverages must be > 0"),
});

export const costScenarioSchema = z.object({
  name: z.string().min(1, "Scenario name required"),
  surface: z.enum(["asphalt", "gravel", "concrete"]),
  thickness_mm: z.number().min(1, "Thickness must be > 0 mm"),
  haul_distance_km: z.number().min(0.1, "Haul distance must be > 0 km"),
  trips_per_day: z.number().min(1, "Trips per day must be ≥ 1"),
});

export const compareRequestSchema = z
  .array(costScenarioSchema)
  .min(2, "Add at least 2 scenarios to compare");

export function firstError(err: z.ZodError): string {
  return err.errors[0]?.message ?? "Validation error";
}
