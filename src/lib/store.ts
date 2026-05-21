import { create } from "zustand";
import { persist } from "zustand/middleware";
import { temporal } from "zundo";
import type {
  CesaResult,
  CostComparison,
  CostScenario,
  DesignSummary,
  FleetEntry,
  PavementResult,
} from "@/lib/types";
import type { UnitSystem } from "@/lib/unit-convert";

export interface CustomVehicle {
  id: string;
  name: string;
  gvw_kn: number;
  axles: number;
}

export interface LccaScenarioInput {
  _id: string;          // reuses costScenarios[i]._id for linkage
  name: string;         // read from costScenarios
  constructionCostUsd: number;
  resurfacingCostUsd: number;
  resurfacingIntervalYears: number;
}

export interface LccaInputs {
  discountRate: number;        // e.g. 0.10 for 10%
  analysisPeriodYears: number; // e.g. 20
  scenarios: LccaScenarioInput[];
}

export interface LccaScenarioResult {
  _id: string;
  name: string;
  npvUsd: number;
  annualEquivalentCostUsd: number;
  cashflows: { year: number; nominalUsd: number; pv: number }[];
}

export interface LccaResult {
  scenarios: LccaScenarioResult[];
  breakEvenYear: number | null; // null if < 2 scenarios
}

export interface BoqGeometry {
  roadLengthKm: number;
  roadWidthM: number;
  shoulderWidthM: number; // per side
}

interface StubMeta {
  stub: boolean;
  stubMessage?: string;
}

export interface CalcStore {
  // Fleet & Traffic
  fleet: FleetEntry[];
  designLifeYears: number;
  workingDaysPerYear: number;
  cesaResult: (CesaResult & StubMeta) | null;
  cesaDirty: boolean;

  // Pavement Design
  subgradeCbr: number;
  coverages: number;
  trhCategory: "A" | "B" | "C" | "D";
  cbrResult: (PavementResult & StubMeta) | null;
  trhResult: (PavementResult & StubMeta) | null;
  pavementDirty: boolean;

  // Economics
  costScenarios: CostScenario[];
  costResult: (CostComparison & StubMeta) | null;
  economicsDirty: boolean;

  // LCCA
  lccaInputs: LccaInputs;
  lccaResult: LccaResult | null;

  // Reports
  projectName: string;
  authorName: string;
  reportSummary: (DesignSummary & StubMeta) | null;

  // Custom vehicles
  customVehicles: CustomVehicle[];

  // File
  activeFileName: string | null;
  activeFilePath: string | null;
  recentFiles: string[];

  // Theme
  theme: 'light' | 'dark' | 'system';

  // Auto-update
  autoCheckUpdates: boolean;

  // Unit system
  unitSystem: UnitSystem;

  // BoQ road geometry
  boqGeometry: BoqGeometry;
  setBoqGeometry: (geometry: BoqGeometry) => void;

  // Dirty state
  isProjectDirty: boolean;
  setProjectDirty: (dirty: boolean) => void;
  resetProject: () => void;

  // Actions
  setFleet: (fleet: FleetEntry[]) => void;
  addCustomVehicle: (v: Omit<CustomVehicle, "id">) => void;
  removeCustomVehicle: (id: string) => void;
  setDesignLifeYears: (years: number) => void;
  setWorkingDaysPerYear: (days: number) => void;
  setCesaResult: (result: CesaResult, stub: boolean, stubMessage?: string) => void;
  setSubgradeCbr: (cbr: number) => void;
  setCoverages: (coverages: number) => void;
  setTrhCategory: (category: "A" | "B" | "C" | "D") => void;
  setCbrResult: (result: PavementResult, stub: boolean, stubMessage?: string) => void;
  setTrhResult: (result: PavementResult, stub: boolean, stubMessage?: string) => void;
  setCostScenarios: (scenarios: CostScenario[]) => void;
  setCostResult: (result: CostComparison, stub: boolean, stubMessage?: string) => void;
  setLccaInputs: (inputs: LccaInputs) => void;
  setLccaResult: (result: LccaResult) => void;
  setProjectName: (name: string) => void;
  setAuthorName: (name: string) => void;
  setReportSummary: (result: DesignSummary, stub: boolean, stubMessage?: string) => void;
  loadFromSnapshot: (data: Partial<CalcStore>) => void;
  setActiveFileName: (name: string | null) => void;
  setActiveFilePath: (path: string | null) => void;
  pushRecentFile: (filePath: string) => void;
  setTheme: (theme: 'light' | 'dark' | 'system') => void;
  setAutoCheckUpdates: (enabled: boolean) => void;
  setUnitSystem: (system: UnitSystem) => void;
}

const DEFAULT_FLEET: FleetEntry[] = [
  { _id: crypto.randomUUID(), vehicle_id: "cat-797f", count: 8, trips_per_day: 22, payload_kn: 4_000 },
  { _id: crypto.randomUUID(), vehicle_id: "cat-789d", count: 4, trips_per_day: 24, payload_kn: 2_100 },
];

const DEFAULT_SCENARIOS: CostScenario[] = [
  {
    _id: crypto.randomUUID(),
    name: "Asphalt 100 mm",
    surface: "asphalt",
    thickness_mm: 100,
    haul_distance_km: 5,
    trips_per_day: 200,
  },
  {
    _id: crypto.randomUUID(),
    name: "Gravel 250 mm",
    surface: "gravel",
    thickness_mm: 250,
    haul_distance_km: 5,
    trips_per_day: 200,
  },
];

export const useCalcStore = create<CalcStore>()(
  temporal(
    persist(
      (set) => ({
      fleet: DEFAULT_FLEET,
      designLifeYears: 10,
      workingDaysPerYear: 250,
      cesaResult: null,
      cesaDirty: false,

      subgradeCbr: 8,
      coverages: 1_050_000,
      trhCategory: "B",
      cbrResult: null,
      trhResult: null,
      pavementDirty: false,

      costScenarios: DEFAULT_SCENARIOS,
      costResult: null,
      economicsDirty: false,

      lccaInputs: {
        discountRate: 0.10,
        analysisPeriodYears: 20,
        scenarios: [],
      },
      lccaResult: null,

      customVehicles: [],

      projectName: "Pit South — Main Haul",
      authorName: "",
      reportSummary: null,

      activeFileName: null,
      activeFilePath: null,
      recentFiles: [],

      theme: 'system',

      autoCheckUpdates: true,

      unitSystem: 'SI',

      boqGeometry: { roadLengthKm: 1.0, roadWidthM: 8.0, shoulderWidthM: 1.5 },

      isProjectDirty: false,
      setProjectDirty: (isProjectDirty) => set({ isProjectDirty }),
      resetProject: () => set({
        fleet: DEFAULT_FLEET,
        designLifeYears: 10,
        workingDaysPerYear: 250,
        cesaResult: null,
        cesaDirty: false,
        subgradeCbr: 8,
        coverages: 1_050_000,
        trhCategory: "B",
        cbrResult: null,
        trhResult: null,
        pavementDirty: false,
        costScenarios: DEFAULT_SCENARIOS,
        costResult: null,
        economicsDirty: false,
        lccaInputs: { discountRate: 0.10, analysisPeriodYears: 20, scenarios: [] },
        lccaResult: null,
        projectName: "Pit South — Main Haul",
        authorName: "",
        reportSummary: null,
        activeFileName: null,
        activeFilePath: null,
        boqGeometry: { roadLengthKm: 1.0, roadWidthM: 8.0, shoulderWidthM: 1.5 },
        isProjectDirty: false,
        autoCheckUpdates: true,
      }),

      setFleet: (fleet) => set({ fleet, cesaResult: null, cesaDirty: true, reportSummary: null }),
      setWorkingDaysPerYear: (workingDaysPerYear) => set({ workingDaysPerYear, cesaResult: null, cesaDirty: true, reportSummary: null }),
      addCustomVehicle: (v) =>
        set((s) => ({
          customVehicles: [...s.customVehicles, { ...v, id: "custom-" + crypto.randomUUID() }],
        })),
      removeCustomVehicle: (id) =>
        set((s) => ({
          customVehicles: s.customVehicles.filter((c) => c.id !== id),
          fleet: s.fleet.filter((f) => f.vehicle_id !== id),
          cesaResult: null,
          cesaDirty: true,
          reportSummary: null,
        })),
      setDesignLifeYears: (designLifeYears) => set({ designLifeYears, cesaResult: null, cesaDirty: true, reportSummary: null }),
      setCesaResult: (result, stub, stubMessage) =>
        set((s) => ({
          cesaResult: { ...result, stub, stubMessage },
          cesaDirty: false,
          coverages: result.design_coverages,
          cbrResult: s.coverages !== result.design_coverages ? null : s.cbrResult,
          trhResult: s.coverages !== result.design_coverages ? null : s.trhResult,
          pavementDirty: s.coverages !== result.design_coverages ? true : s.pavementDirty,
        })),
      setSubgradeCbr: (subgradeCbr) => set({ subgradeCbr, cbrResult: null, pavementDirty: true, reportSummary: null }),
      setCoverages: (coverages) => set({ coverages, cbrResult: null, trhResult: null, pavementDirty: true, reportSummary: null }),
      setTrhCategory: (trhCategory) => set({ trhCategory, trhResult: null, pavementDirty: true, reportSummary: null }),
      setCbrResult: (result, stub, stubMessage) =>
        set({ cbrResult: { ...result, stub, stubMessage }, pavementDirty: false }),
      setTrhResult: (result, stub, stubMessage) =>
        set({ trhResult: { ...result, stub, stubMessage }, pavementDirty: false }),
      setCostScenarios: (costScenarios) => set({ costScenarios, costResult: null, economicsDirty: true, reportSummary: null }),
      setCostResult: (result, stub, stubMessage) =>
        set({ costResult: { ...result, stub, stubMessage }, economicsDirty: false }),
      setLccaInputs: (lccaInputs) => set({ lccaInputs, lccaResult: null }),
      setLccaResult: (lccaResult) => set({ lccaResult }),
      setProjectName: (projectName) => set({ projectName, reportSummary: null }),
      setAuthorName: (authorName) => set({ authorName, reportSummary: null }),
      setReportSummary: (result, stub, stubMessage) =>
        set({ reportSummary: { ...result, stub, stubMessage } }),
      loadFromSnapshot: (data) => set({ ...data, cesaDirty: false, pavementDirty: false, economicsDirty: false, isProjectDirty: false }),
      setActiveFileName: (activeFileName) => set({ activeFileName }),
      setActiveFilePath: (activeFilePath) => set({ activeFilePath }),
      pushRecentFile: (filePath) =>
        set((s) => ({
          recentFiles: [filePath, ...s.recentFiles.filter((f) => f !== filePath)].slice(0, 5),
        })),
      setTheme: (theme) => set({ theme }),
      setAutoCheckUpdates: (autoCheckUpdates) => set({ autoCheckUpdates }),
      setUnitSystem: (unitSystem) => set({ unitSystem }),
      setBoqGeometry: (boqGeometry) => set({ boqGeometry }),
    }),
    {
      name: "haul-calc-store",
      version: 8,
      migrate: (persisted: unknown, fromVersion: number) => {
        const s = persisted as Record<string, unknown>;
        if (fromVersion < 1 && Array.isArray(s.costScenarios)) {
          s.costScenarios = (s.costScenarios as Record<string, unknown>[]).map((sc) =>
            "_id" in sc ? sc : { ...sc, _id: crypto.randomUUID() },
          );
        }
        if (fromVersion < 2) {
          if (!s.unitSystem) s.unitSystem = 'SI';
        }
        if (fromVersion < 3) {
          if (s.workingDaysPerYear == null) s.workingDaysPerYear = 250;
        }
        if (fromVersion < 4) {
          s.cesaDirty = false;
          s.pavementDirty = false;
          s.economicsDirty = false;
        }
        if (fromVersion < 5) {
          s.recentFiles = [];
        }
        if (fromVersion < 6) {
          s.lccaInputs = { discountRate: 0.10, analysisPeriodYears: 20, scenarios: [] };
          s.lccaResult = null;
          s.boqGeometry = { roadLengthKm: 1.0, roadWidthM: 8.0, shoulderWidthM: 1.5 };
        }
        if (fromVersion < 7) {
          s.isProjectDirty = false;
        }
        if (fromVersion < 8) {
          if (Array.isArray(s.fleet)) {
            s.fleet = (s.fleet as { trips_per_day: number }[]).map((f) => ({
              ...f,
              trips_per_day: Math.max(1, f.trips_per_day ?? 1),
            }));
          }
          if (Array.isArray(s.costScenarios)) {
            s.costScenarios = (s.costScenarios as { trips_per_day: number }[]).map((sc) => ({
              ...sc,
              trips_per_day: Math.max(1, sc.trips_per_day ?? 1),
            }));
          }
        }
        return s;
      },
      partialize: (state) => ({
        fleet: state.fleet,
        designLifeYears: state.designLifeYears,
        workingDaysPerYear: state.workingDaysPerYear,
        cesaResult: state.cesaResult,
        cesaDirty: state.cesaDirty,
        subgradeCbr: state.subgradeCbr,
        coverages: state.coverages,
        trhCategory: state.trhCategory,
        cbrResult: state.cbrResult,
        trhResult: state.trhResult,
        pavementDirty: state.pavementDirty,
        costScenarios: state.costScenarios,
        costResult: state.costResult,
        economicsDirty: state.economicsDirty,
        lccaInputs: state.lccaInputs,
        lccaResult: state.lccaResult,
        customVehicles: state.customVehicles,
        projectName: state.projectName,
        authorName: state.authorName,
        reportSummary: state.reportSummary,
        activeFileName: state.activeFileName,
        activeFilePath: state.activeFilePath,
        recentFiles: state.recentFiles,
        theme: state.theme,
        autoCheckUpdates: state.autoCheckUpdates,
        unitSystem: state.unitSystem,
        boqGeometry: state.boqGeometry,
        isProjectDirty: state.isProjectDirty,
      }),
    },
  ),
    {
      limit: 20,
      partialize: (state) => ({
        fleet: state.fleet,
        designLifeYears: state.designLifeYears,
        workingDaysPerYear: state.workingDaysPerYear,
        subgradeCbr: state.subgradeCbr,
        coverages: state.coverages,
        trhCategory: state.trhCategory,
        costScenarios: state.costScenarios,
        customVehicles: state.customVehicles,
        projectName: state.projectName,
        authorName: state.authorName,
        // Include results + dirty flags so undo restores a consistent snapshot
        cesaResult: state.cesaResult,
        cesaDirty: state.cesaDirty,
        cbrResult: state.cbrResult,
        trhResult: state.trhResult,
        pavementDirty: state.pavementDirty,
        costResult: state.costResult,
        economicsDirty: state.economicsDirty,
        reportSummary: state.reportSummary,
        boqGeometry: state.boqGeometry,
      }),
    },
  ),
);

useCalcStore.subscribe((state, prevState) => {
  if (state.isProjectDirty) return;
  const fields = [
    "fleet",
    "designLifeYears",
    "workingDaysPerYear",
    "subgradeCbr",
    "coverages",
    "trhCategory",
    "costScenarios",
    "projectName",
    "authorName",
    "customVehicles",
    "lccaInputs",
    "boqGeometry",
  ] as const;

  for (const f of fields) {
    if (state[f] !== prevState[f]) {
      useCalcStore.setState({ isProjectDirty: true });
      break;
    }
  }
});
