import { create } from "zustand";
import { persist } from "zustand/middleware";
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

  // Reports
  projectName: string;
  authorName: string;
  reportSummary: (DesignSummary & StubMeta) | null;

  // Custom vehicles
  customVehicles: CustomVehicle[];

  // File
  activeFileName: string | null;

  // Theme
  theme: 'light' | 'dark' | 'system';

  // Unit system
  unitSystem: UnitSystem;

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
  setProjectName: (name: string) => void;
  setAuthorName: (name: string) => void;
  setReportSummary: (result: DesignSummary, stub: boolean, stubMessage?: string) => void;
  loadFromSnapshot: (data: Partial<CalcStore>) => void;
  setTheme: (theme: 'light' | 'dark' | 'system') => void;
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

      customVehicles: [],

      projectName: "Pit South — Main Haul",
      authorName: "",
      reportSummary: null,

      activeFileName: null,

      theme: 'system',

      unitSystem: 'SI',

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
        set({ cesaResult: { ...result, stub, stubMessage }, cesaDirty: false }),
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
      setProjectName: (projectName) => set({ projectName, reportSummary: null }),
      setAuthorName: (authorName) => set({ authorName, reportSummary: null }),
      setReportSummary: (result, stub, stubMessage) =>
        set({ reportSummary: { ...result, stub, stubMessage } }),
      loadFromSnapshot: (data) => set({ ...data, cesaDirty: false, pavementDirty: false, economicsDirty: false }),
      setTheme: (theme) => set({ theme }),
      setUnitSystem: (unitSystem) => set({ unitSystem }),
    }),
    {
      name: "haul-calc-store",
      version: 4,
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
        customVehicles: state.customVehicles,
        projectName: state.projectName,
        authorName: state.authorName,
        reportSummary: state.reportSummary,
        activeFileName: state.activeFileName,
        theme: state.theme,
        unitSystem: state.unitSystem,
      }),
    },
  ),
);
