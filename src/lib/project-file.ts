import { save, open } from "@tauri-apps/plugin-dialog";
import { writeTextFile, readTextFile } from "@tauri-apps/plugin-fs";
import { toast } from "sonner";
import { basenameFromPath, resolveActiveFilePath } from "@/lib/file-binding";
import type { CalcStore } from "@/lib/store";

export type Snapshot = {
  version: number;
  savedAt: string;
  fleet: CalcStore["fleet"];
  designLifeYears: CalcStore["designLifeYears"];
  cesaResult: CalcStore["cesaResult"];
  subgradeCbr: CalcStore["subgradeCbr"];
  coverages: CalcStore["coverages"];
  trhCategory: CalcStore["trhCategory"];
  cbrResult: CalcStore["cbrResult"];
  trhResult: CalcStore["trhResult"];
  costScenarios: CalcStore["costScenarios"];
  costResult: CalcStore["costResult"];
  projectName: CalcStore["projectName"];
  authorName: CalcStore["authorName"];
  reportSummary: CalcStore["reportSummary"];
};

type OpenStore = Pick<CalcStore, "loadFromSnapshot" | "pushRecentFile" | "setActiveFilePath">;

function loadSnapshot(snap: Snapshot, filePath: string, store: OpenStore): void {
  const parts = filePath.replace(/\\/g, "/").split("/");
  const fileName = parts[parts.length - 1];
  store.loadFromSnapshot({
    fleet: snap.fleet,
    designLifeYears: snap.designLifeYears,
    cesaResult: snap.cesaResult,
    subgradeCbr: snap.subgradeCbr,
    coverages: snap.coverages,
    trhCategory: snap.trhCategory,
    cbrResult: snap.cbrResult,
    trhResult: snap.trhResult,
    costScenarios: snap.costScenarios,
    costResult: snap.costResult,
    projectName: snap.projectName,
    authorName: snap.authorName,
    reportSummary: snap.reportSummary,
    activeFileName: fileName,
    activeFilePath: filePath,
  });
  store.pushRecentFile(filePath);
}

export function parseSnapshot(text: string): Snapshot {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("File tidak valid atau corrupt.");
  }
  if (typeof parsed !== "object" || parsed === null || !("version" in parsed)) {
    throw new Error("File tidak valid atau corrupt.");
  }
  return parsed as Snapshot;
}

export async function saveProject(store: CalcStore): Promise<void> {
  const existingPath = resolveActiveFilePath(store);
  if (existingPath) {
    if (!store.activeFilePath?.trim()) {
      store.setActiveFilePath(existingPath);
    }
    // Overwrite existing file directly (no dialog)
    const snapshot: Snapshot = {
      version: 1,
      savedAt: new Date().toISOString(),
      fleet: store.fleet,
      designLifeYears: store.designLifeYears,
      cesaResult: store.cesaResult,
      subgradeCbr: store.subgradeCbr,
      coverages: store.coverages,
      trhCategory: store.trhCategory,
      cbrResult: store.cbrResult,
      trhResult: store.trhResult,
      costScenarios: store.costScenarios,
      costResult: store.costResult,
      projectName: store.projectName,
      authorName: store.authorName,
      reportSummary: store.reportSummary,
    };
    await writeTextFile(existingPath, JSON.stringify(snapshot, null, 2));
    store.setProjectDirty(false);
    toast.success(`Saved to ${store.activeFileName ?? basenameFromPath(existingPath)}`);
    return;
  }

  // No existing path — fall back to Save As
  await saveAsProject(store);
}

export async function saveAsProject(store: CalcStore): Promise<void> {
  const filePath = await save({
    filters: [{ name: "HaulCalc Project", extensions: ["hcalc"] }],
    defaultPath: `${store.projectName || "project"}.hcalc`,
  });

  if (!filePath) return;

  const snapshot: Snapshot = {
    version: 1,
    savedAt: new Date().toISOString(),
    fleet: store.fleet,
    designLifeYears: store.designLifeYears,
    cesaResult: store.cesaResult,
    subgradeCbr: store.subgradeCbr,
    coverages: store.coverages,
    trhCategory: store.trhCategory,
    cbrResult: store.cbrResult,
    trhResult: store.trhResult,
    costScenarios: store.costScenarios,
    costResult: store.costResult,
    projectName: store.projectName,
    authorName: store.authorName,
    reportSummary: store.reportSummary,
  };

  await writeTextFile(filePath, JSON.stringify(snapshot, null, 2));

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
