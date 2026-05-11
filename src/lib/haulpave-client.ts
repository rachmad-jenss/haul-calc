import { invoke } from "@tauri-apps/api/core";
import type {
  CallError,
  CallResult,
  CesaRequest,
  CesaResult,
  CbrRequest,
  CostComparison,
  CostScenario,
  DesignSummary,
  PavementResult,
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

export type SidecarStatus = "running" | "crashed" | "restarting";

export const haulPave = {
  computeCesa: (req: CesaRequest) => call<CesaResult>("compute_cesa", req),
  cbrThickness: (req: CbrRequest) => call<PavementResult>("cbr_thickness", req),
  trh14Thickness: (req: Trh14Request) => call<PavementResult>("trh14_thickness", req),
  compareScenarios: (scenarios: CostScenario[]) =>
    call<CostComparison>("compare_scenarios", { scenarios }),
  buildSummary: (inputs: Record<string, unknown>) =>
    call<DesignSummary>("build_summary", inputs),
  listVehicles: () => call<Vehicle[]>("list_vehicles", {}),
  getVersion: () => call<{ haulpave: string | null; bridge: string }>("get_version", {}),
  healthCheck: () => call<{ ok: boolean; haulpave_loaded: boolean }>("health_check", {}),
  getSidecarStatus: () => invoke<SidecarStatus>("get_sidecar_status"),
  restartSidecar: () => invoke<void>("restart_sidecar"),
};

export type { CallResult, CallError } from "@/lib/types";
