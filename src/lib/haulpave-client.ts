import { invoke } from "@tauri-apps/api/core";
import type {
  CallError,
  CallResult,
  CbrRequest,
  CesaRequest,
  CesaResult,
  CesaDetailResult,
  CompareMethodsResult,
  CostComparison,
  CostScenario,
  CustomMaterial,
  CustomMaterialRequest,
  DesignPavementResult,
  DesignSummary,
  EconomicsDetailRequest,
  ExcelExportResult,
  LayerCoefficientResult,
  MaterialTemplate,
  PavementResult,
  SensitivityRequest,
  SensitivityResult,
  Trh14Request,
  Vehicle,
} from "@/lib/types";

interface CallEnvelope<T> {
  data: T;
  stub: boolean;
  stub_message?: string;
}

async function call<T>(method: string, params: unknown = {}): Promise<CallResult<T>> {
  try {
    const env = await invoke<CallEnvelope<T>>("haul_pave_call", { method, params });
    return { data: env.data, stub: env.stub, stubMessage: env.stub_message };
  } catch (raw) {
    throw raw as CallError;
  }
}

export type SidecarStatus = "running" | "crashed" | "restarting" | "killed";

export const haulPave = {
  computeCesa: (req: CesaRequest) => call<CesaResult>("compute_cesa", req),
  cbrThickness: (req: CbrRequest) => call<PavementResult>("cbr_thickness", req),
  trh14Thickness: (req: Trh14Request) => call<PavementResult>("trh14_thickness", req),
  compareScenarios: (scenarios: Omit<CostScenario, "_id">[]) =>
    call<CostComparison>("compare_scenarios", { scenarios }),
  compareMethods: (req: CesaRequest & Pick<CbrRequest, "subgrade_cbr">) =>
    call<CompareMethodsResult>("compare_methods", req),
  designPavement: (req: CesaRequest & Pick<CbrRequest, "subgrade_cbr">) =>
    call<DesignPavementResult>("design_pavement", req),
  buildSummary: (inputs: Record<string, unknown>) =>
    call<DesignSummary>("build_summary", inputs),
  listVehicles: () => call<Vehicle[]>("list_vehicles", {}),
  getVersion: () => call<{ haulpave: string | null; bridge: string }>("get_version", {}),
  healthCheck: () => call<{ ok: boolean; haulpave_loaded: boolean }>("health_check", {}),
  analyzeSensitivity: (req: SensitivityRequest) =>
    call<SensitivityResult>("analyze_sensitivity", req),
  materialLibrary: () => call<MaterialTemplate[]>("material_library", {}),
  materialToLayerCoefficient: (req: CustomMaterialRequest) =>
    call<LayerCoefficientResult>("material_to_layer_coefficient", req),
  customMaterial: (req: CustomMaterialRequest) =>
    call<CustomMaterial>("custom_material", req),
  computeEconomicsDetail: (req: EconomicsDetailRequest) =>
    call<CesaDetailResult>("compute_economics_detail", req),
  exportComparisonToExcel: (scenarios: Omit<CostScenario, "_id">[], filePath?: string) =>
    call<ExcelExportResult>("export_comparison_to_excel", { scenarios, file_path: filePath }),
  getSidecarStatus: () => invoke<SidecarStatus>("get_sidecar_status"),
  restartSidecar: () => invoke<void>("restart_sidecar"),
};

export type { CallResult, CallError } from "@/lib/types";
