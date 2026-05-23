import { save, open } from "@tauri-apps/plugin-dialog";
import { writeTextFile, readTextFile } from "@tauri-apps/plugin-fs";
import { toast } from "sonner";
import { basenameFromPath, resolveActiveFilePath } from "@/lib/file-binding";
import { firstError, snapshotSchema } from "@/lib/schemas";
import type { CalcStore } from "@/lib/store";
import { useCalcStore } from "@/lib/store";

export const SNAPSHOT_VERSION = 2;

export type Snapshot = {
  version: number;
  savedAt: string;
  fleet: CalcStore["fleet"];
  designLifeYears: CalcStore["designLifeYears"];
  workingDaysPerYear?: CalcStore["workingDaysPerYear"];
  customVehicles?: CalcStore["customVehicles"];
  cesaResult: CalcStore["cesaResult"];
  subgradeCbr: CalcStore["subgradeCbr"];
  coverages: CalcStore["coverages"];
  trhCategory: CalcStore["trhCategory"];
  cbrResult: CalcStore["cbrResult"];
  trhResult: CalcStore["trhResult"];
  costScenarios: CalcStore["costScenarios"];
  costResult: CalcStore["costResult"];
  lccaInputs?: CalcStore["lccaInputs"];
  lccaResult?: CalcStore["lccaResult"];
  boqGeometry?: CalcStore["boqGeometry"];
  unitSystem?: CalcStore["unitSystem"];
  cesaDirty?: CalcStore["cesaDirty"];
  pavementDirty?: CalcStore["pavementDirty"];
  economicsDirty?: CalcStore["economicsDirty"];
  projectName: CalcStore["projectName"];
  authorName: CalcStore["authorName"];
  reportSummary: CalcStore["reportSummary"];
};

type OpenStore = Pick<CalcStore, "loadFromSnapshot" | "pushRecentFile" | "setActiveFilePath">;

export function snapshotFromStore(store: CalcStore): Snapshot {
  return {
    version: SNAPSHOT_VERSION,
    savedAt: new Date().toISOString(),
    fleet: store.fleet,
    designLifeYears: store.designLifeYears,
    workingDaysPerYear: store.workingDaysPerYear,
    customVehicles: store.customVehicles,
    cesaResult: store.cesaResult,
    subgradeCbr: store.subgradeCbr,
    coverages: store.coverages,
    trhCategory: store.trhCategory,
    cbrResult: store.cbrResult,
    trhResult: store.trhResult,
    costScenarios: store.costScenarios,
    costResult: store.costResult,
    lccaInputs: store.lccaInputs,
    lccaResult: store.lccaResult,
    boqGeometry: store.boqGeometry,
    unitSystem: store.unitSystem,
    cesaDirty: store.cesaDirty,
    pavementDirty: store.pavementDirty,
    economicsDirty: store.economicsDirty,
    projectName: store.projectName,
    authorName: store.authorName,
    reportSummary: store.reportSummary,
  };
}

export function storePatchFromSnapshot(snap: Snapshot): Partial<CalcStore> {
  const version = snap.version ?? 1;
  const base: Partial<CalcStore> = {
    fleet: snap.fleet,
    designLifeYears: snap.designLifeYears,
    cesaResult: snap.cesaResult ?? null,
    subgradeCbr: snap.subgradeCbr ?? 8,
    coverages: snap.coverages ?? 1_050_000,
    trhCategory: snap.trhCategory ?? "B",
    cbrResult: snap.cbrResult ?? null,
    trhResult: snap.trhResult ?? null,
    costScenarios: snap.costScenarios ?? [],
    costResult: snap.costResult ?? null,
    projectName: snap.projectName ?? "",
    authorName: snap.authorName ?? "",
    reportSummary: snap.reportSummary ?? null,
  };
  if (version >= 2) {
    return {
      ...base,
      workingDaysPerYear: snap.workingDaysPerYear ?? 250,
      customVehicles: snap.customVehicles ?? [],
      lccaInputs: snap.lccaInputs ?? {
        discountRate: 0.1,
        analysisPeriodYears: 20,
        scenarios: [],
      },
      lccaResult: snap.lccaResult ?? null,
      boqGeometry: snap.boqGeometry ?? {
        roadLengthKm: 1.0,
        roadWidthM: 8.0,
        shoulderWidthM: 1.5,
      },
      unitSystem: snap.unitSystem ?? "SI",
      cesaDirty: snap.cesaDirty ?? false,
      pavementDirty: snap.pavementDirty ?? false,
      economicsDirty: snap.economicsDirty ?? false,
    };
  }
  return {
    ...base,
    workingDaysPerYear: 250,
    customVehicles: [],
    lccaInputs: { discountRate: 0.1, analysisPeriodYears: 20, scenarios: [] },
    lccaResult: null,
    boqGeometry: { roadLengthKm: 1.0, roadWidthM: 8.0, shoulderWidthM: 1.5 },
    unitSystem: "SI",
    cesaDirty: false,
    pavementDirty: false,
    economicsDirty: false,
  };
}

function loadSnapshot(snap: Snapshot, filePath: string, store: OpenStore): void {
  const parts = filePath.replace(/\\/g, "/").split("/");
  const fileName = parts[parts.length - 1];
  store.loadFromSnapshot({
    ...storePatchFromSnapshot(snap),
    activeFileName: fileName,
    activeFilePath: filePath,
  });
  store.pushRecentFile(filePath);
  useCalcStore.temporal.getState().clear();
}

export function parseSnapshot(text: string | Snapshot): Snapshot {
  let parsed: unknown;
  if (typeof text === "object" && text !== null && "version" in text) {
    parsed = text;
  } else {
    try {
      parsed = JSON.parse(text as string);
    } catch {
      throw new Error("File tidak valid atau corrupt.");
    }
  }
  const result = snapshotSchema.safeParse(parsed);
  if (!result.success) {
    throw new Error(`File tidak valid: ${firstError(result.error)}`);
  }
  return result.data as Snapshot;
}

export async function saveProject(store: CalcStore): Promise<void> {
  const existingPath = resolveActiveFilePath(store);
  if (existingPath) {
    if (!store.activeFilePath?.trim()) {
      store.setActiveFilePath(existingPath);
    }
    await writeTextFile(
      existingPath,
      JSON.stringify(snapshotFromStore(store), null, 2),
    );
    store.setProjectDirty(false);
    toast.success(`Saved to ${store.activeFileName ?? basenameFromPath(existingPath)}`);
    return;
  }

  await saveAsProject(store);
}

export async function saveAsProject(store: CalcStore): Promise<void> {
  const filePath = await save({
    filters: [{ name: "HaulCalc Project", extensions: ["hcalc"] }],
    defaultPath: `${store.projectName || "project"}.hcalc`,
  });

  if (!filePath) return;

  await writeTextFile(filePath, JSON.stringify(snapshotFromStore(store), null, 2));

  const parts = filePath.replace(/\\/g, "/").split("/");
  const fileName = parts[parts.length - 1];
  store.setActiveFileName(fileName);
  store.setActiveFilePath(filePath);
  store.pushRecentFile(filePath);
  store.setProjectDirty(false);
  toast.success(`Saved as ${fileName}`);
}

export async function openProject(store: OpenStore): Promise<void> {
  const filePath = await open({
    filters: [{ name: "HaulCalc Project", extensions: ["hcalc"] }],
    multiple: false,
  });

  if (!filePath || Array.isArray(filePath)) return;

  const snap = parseSnapshot(await readTextFile(filePath));
  loadSnapshot(snap, filePath, store);
}

export async function openProjectFromPath(filePath: string, store: OpenStore): Promise<void> {
  const snap = parseSnapshot(await readTextFile(filePath));
  loadSnapshot(snap, filePath, store);
}
