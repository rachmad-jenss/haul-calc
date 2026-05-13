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

interface StubMeta {
  stub: boolean;
  stubMessage?: string;
}

export interface CalcStore {
  // Fleet & Traffic
  fleet: FleetEntry[];
  designLifeYears: number;
  cesaResult: (CesaResult & StubMeta) | null;

  // Pavement Design
  subgradeCbr: number;
  coverages: number;
  trhCategory: "A" | "B" | "C" | "D";
  cbrResult: (PavementResult & StubMeta) | null;
  trhResult: (PavementResult & StubMeta) | null;

  // Economics
  costScenarios: CostScenario[];
  costResult: (CostComparison & StubMeta) | null;

  // Reports
  projectName: string;
  authorName: string;
  reportSummary: (DesignSummary & StubMeta) | null;

  // File
  activeFileName: string | null;

  // Theme
  theme: 'light' | 'dark' | 'system';

  // Actions
  setFleet: (fleet: FleetEntry[]) => void;
  setDesignLifeYears: (years: number) => void;
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
      cesaResult: null,

      subgradeCbr: 8,
      coverages: 1_050_000,
      trhCategory: "B",
      cbrResult: null,
      trhResult: null,

      costScenarios: DEFAULT_SCENARIOS,
      costResult: null,

      projectName: "Pit South — Main Haul",
      authorName: "",
      reportSummary: null,

      activeFileName: null,

      theme: 'system',

      setFleet: (fleet) => set({ fleet, cesaResult: null, reportSummary: null }),
      setDesignLifeYears: (designLifeYears) => set({ designLifeYears, cesaResult: null, reportSummary: null }),
      setCesaResult: (result, stub, stubMessage) =>
        set({ cesaResult: { ...result, stub, stubMessage } }),
      setSubgradeCbr: (subgradeCbr) => set({ subgradeCbr, cbrResult: null, reportSummary: null }),
      setCoverages: (coverages) => set({ coverages, cbrResult: null, trhResult: null, reportSummary: null }),
      setTrhCategory: (trhCategory) => set({ trhCategory, trhResult: null, reportSummary: null }),
      setCbrResult: (result, stub, stubMessage) =>
        set({ cbrResult: { ...result, stub, stubMessage } }),
      setTrhResult: (result, stub, stubMessage) =>
        set({ trhResult: { ...result, stub, stubMessage } }),
      setCostScenarios: (costScenarios) => set({ costScenarios, costResult: null, reportSummary: null }),
      setCostResult: (result, stub, stubMessage) =>
        set({ costResult: { ...result, stub, stubMessage } }),
      setProjectName: (projectName) => set({ projectName, reportSummary: null }),
      setAuthorName: (authorName) => set({ authorName, reportSummary: null }),
      setReportSummary: (result, stub, stubMessage) =>
        set({ reportSummary: { ...result, stub, stubMessage } }),
      loadFromSnapshot: (data) => set({ ...data }),
      setTheme: (theme) => set({ theme }),
    }),
    {
      name: "haul-calc-store",
      version: 1,
      migrate: (persisted: unknown, fromVersion: number) => {
        const s = persisted as Record<string, unknown>;
        if (fromVersion < 1 && Array.isArray(s.costScenarios)) {
          s.costScenarios = (s.costScenarios as Record<string, unknown>[]).map((sc) =>
            "_id" in sc ? sc : { ...sc, _id: crypto.randomUUID() },
          );
        }
        return s;
      },
      partialize: (state) => ({
        fleet: state.fleet,
        designLifeYears: state.designLifeYears,
        cesaResult: state.cesaResult,
        subgradeCbr: state.subgradeCbr,
        coverages: state.coverages,
        trhCategory: state.trhCategory,
        cbrResult: state.cbrResult,
        trhResult: state.trhResult,
        costScenarios: state.costScenarios,
        costResult: state.costResult,
        projectName: state.projectName,
        authorName: state.authorName,
        reportSummary: state.reportSummary,
        activeFileName: state.activeFileName,
        theme: state.theme,
      }),
    },
  ),
);
