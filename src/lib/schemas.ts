import { z } from "zod";

export const fleetEntrySchema = z.object({
  _id: z.string(),
  vehicle_id: z.string().min(1, "Vehicle ID required"),
  count: z.number().int().min(1, "Count must be at least 1"),
  trips_per_day: z.number().min(1, "Trips per day must be at least 1"),
  payload_kn: z.number().min(1, "Payload must be > 0 kN"),
});

export const cesaRequestSchema = z.object({
  fleet: z
    .array(fleetEntrySchema)
    .min(1, "Add at least one vehicle to the fleet"),
  design_life_years: z.number().int().min(1, "Design life must be ≥ 1 year").max(50),
  working_days_per_year: z.number().int().min(1).max(365).optional(),
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

const snapshotFleetEntrySchema = z.object({
  _id: z.string(),
  vehicle_id: z.string(),
  count: z.number(),
  trips_per_day: z.number(),
  payload_kn: z.number(),
});

const snapshotCostScenarioSchema = z.object({
  _id: z.string(),
  name: z.string(),
  surface: z.enum(["asphalt", "gravel", "concrete"]),
  thickness_mm: z.number(),
  haul_distance_km: z.number(),
  trips_per_day: z.number(),
});

const snapshotCustomVehicleSchema = z.object({
  id: z.string(),
  name: z.string(),
  gvw_kn: z.number(),
  axles: z.number(),
});

/** Validates `.hcalc` JSON before loading into the store. */
export const snapshotSchema = z.object({
  version: z.number().finite(),
  savedAt: z.string().optional(),
  fleet: z.array(snapshotFleetEntrySchema),
  designLifeYears: z.number().finite(),
  workingDaysPerYear: z.number().finite().optional(),
  customVehicles: z.array(snapshotCustomVehicleSchema).optional(),
  cesaResult: z.unknown().nullable().optional(),
  subgradeCbr: z.number().finite().optional(),
  coverages: z.number().finite().optional(),
  trhCategory: z.enum(["A", "B", "C", "D"]).optional(),
  cbrResult: z.unknown().nullable().optional(),
  trhResult: z.unknown().nullable().optional(),
  costScenarios: z.array(snapshotCostScenarioSchema).optional(),
  costResult: z.unknown().nullable().optional(),
  lccaInputs: z.unknown().optional(),
  lccaResult: z.unknown().nullable().optional(),
  boqGeometry: z.unknown().optional(),
  unitSystem: z.enum(["SI", "Imperial"]).optional(),
  cesaDirty: z.boolean().optional(),
  pavementDirty: z.boolean().optional(),
  economicsDirty: z.boolean().optional(),
  projectName: z.string().optional(),
  authorName: z.string().optional(),
  reportSummary: z.unknown().nullable().optional(),
});
