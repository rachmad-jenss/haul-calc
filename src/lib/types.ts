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
  working_days_per_year?: number;
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
  custom_materials?: CustomMaterialRequest[];
}

export interface Trh14Request {
  category: "A" | "B" | "C" | "D";
  design_coverages: number;
  custom_materials?: CustomMaterialRequest[];
}

export interface CompareMethodsRequest extends CesaRequest {
  subgrade_cbr: number;
  custom_materials?: CustomMaterialRequest[];
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
  material_class?: string;
  layers: PavementLayer[];
  total_thickness_mm: number;
  confidence: "high" | "medium" | "low";
  warning?: string;
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
  warning?: string;
}

export interface CompareMethodsResult {
  usace: MethodResult;
  trh14: MethodResult;
  delta_mm: number;
  subgrade_cbr: number;
  confidence: "high" | "medium" | "low";
  /** Library UserWarnings surfaced from compare_methods (not suppressed). */
  warnings?: string[];
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

// ---------------------------------------------------------------------------
// haul-pave v0.5.0 new types
// ---------------------------------------------------------------------------

export interface SensitivityPerturbation {
  x: number;
  y: number | null;
}

export interface SensitivityBaseline {
  subgrade_cbr: number;
  design_coverages: number;
  design_life_years: number;
  trips_per_day: number;
}

export interface SensitivityResult {
  variable: string;
  baseline: SensitivityBaseline;
  perturbations: SensitivityPerturbation[];
  confidence: "high" | "medium" | "low";
}

export interface SensitivityRequest {
  variable: string;
  min_value: number;
  max_value: number;
  steps: number;
  metric: string;
  fleet: FleetEntry[];
  design_life_years: number;
  working_days_per_year?: number;
  subgrade_cbr: number;
  design_coverages: number;
  cost_scenarios?: Omit<CostScenario, "_id">[];
}

/** TRH / USACE catalog entry from haul-pave `material_library.list_all`. */
export interface MaterialTemplate {
  name: string;
  material_class: string;
  cbr_range: [number, number | null];
  typical_modulus_mpa: number;
  source: string;
}

export interface LayerCoefficientResult {
  coefficient: number;
}

export type MaterialType = "granular" | "stabilized" | "asphalt" | "concrete";

/** User-defined material — mirrors haul-pave `CustomMaterial` dataclass. */
export interface CustomMaterial {
  name: string;
  material_type: MaterialType;
  elastic_modulus_mpa: number;
  cbr_percent: number | null;
  poisson_ratio: number;
  layer_coefficient: number | null;
  thickness_mm: number | null;
  description: string;
}

/** Client-side custom material with stable id for store/UI (DAS-160+). */
export interface CustomMaterialEntry extends CustomMaterial {
  id: string;
}

export interface CustomMaterialRequest {
  name: string;
  material_type: MaterialType;
  elastic_modulus_mpa: number;
  cbr_percent?: number | null;
  poisson_ratio?: number;
  layer_coefficient?: number | null;
  thickness_mm?: number | null;
  description?: string;
}

export interface CesaDetailScenario {
  name: string;
  cesa: number;
  fuel_cost_usd_per_year: number;
  tire_cost_usd_per_year: number;
  maintenance_cost_usd_per_year: number;
  total_cost_usd_per_year: number;
  npv_usd: number;
  annual_equivalent_cost_usd: number;
  cashflows: { year: number; value: number }[];
}

export interface CesaDetailResult {
  scenarios: CesaDetailScenario[];
  design_life_years: number;
  discount_rate: number;
}

export interface EconomicsDetailRequest {
  scenarios: Omit<CostScenario, "_id">[];
  design_life_years: number;
  discount_rate: number;
}

export interface ExcelExportResult {
  bytes_written: number;
  file_path?: string;
}
