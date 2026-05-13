// Mirrors the pydantic schemas in haul-pave. Hand-written for now; once
// haul-pave Phase 1 lands we can codegen this from `pydantic.json_schema()`
// via json-schema-to-typescript.

export interface Vehicle {
  id: string;
  name: string;
  gvw_kn: number;
  axles: number;
}

export interface FleetEntry {
  _id: string;
  vehicle_id: string;
  count: number;
  trips_per_day: number;
  payload_kn: number;
}

export interface CesaRequest {
  fleet: FleetEntry[];
  design_life_years: number;
}

export interface CesaResult {
  cesa: number;
  design_coverages: number;
  design_life_years: number;
  axle_load_distribution: { axle_kn: number; passes: number }[];
}

export interface CbrRequest {
  subgrade_cbr: number;
  design_coverages: number;
  climate_zone?: "tropical" | "arid" | "temperate";
}

export interface Trh14Request {
  category: "A" | "B" | "C" | "D";
  design_coverages: number;
}

export interface PavementLayer {
  name: string;
  thickness_mm: number;
  cbr: number | null;
}

export interface PavementResult {
  method: string;
  subgrade_cbr?: number;
  category?: string;
  layers: PavementLayer[];
  total_thickness_mm: number;
}

export interface CostScenario {
  _id: string;
  name: string;
  surface: "asphalt" | "gravel" | "concrete";
  thickness_mm: number;
  haul_distance_km: number;
  trips_per_day: number;
}

export interface ScenarioComparison {
  name: string;
  tire_cost_usd_per_year: number;
  fuel_cost_usd_per_year: number;
  maintenance_cost_usd_per_year: number;
}

export interface CostComparison {
  scenarios: ScenarioComparison[];
}

export interface DesignSummary {
  title: string;
  generated_at: string;
  inputs: Record<string, unknown>;
  results: Record<string, unknown>;
}

export interface MethodResult {
  method: string;
  total_thickness_mm: number;
  total_coverages: number;
  total_cesa?: number;
  confidence: "high" | "medium" | "low";
  material_class?: string;
}

export interface CompareMethodsResult {
  usace: MethodResult;
  trh14: MethodResult;
  delta_mm: number;
  subgrade_cbr: number;
  confidence: "high" | "medium" | "low";
}

export interface PavementLayerFull {
  name: string;
  thickness_mm: number;
  material_class?: string;
  cbr?: number | null;
}

export interface DesignPavementResult {
  method: string;
  total_thickness_mm: number;
  layers: PavementLayerFull[];
  subgrade_cbr: number;
  confidence: "high" | "medium" | "low";
}

export interface CallError {
  code: string;
  message: string;
  stub: boolean;
}

export interface CallResult<T> {
  data: T;
  stub: boolean;
  stubMessage?: string;
}
