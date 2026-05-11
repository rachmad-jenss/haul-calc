import { create } from "zustand";
import { persist } from "zustand/middleware";
import type {
  CesaResult,
  CostComparison,
  CostScenario,
  FleetEntry,
  PavementResult,
} from "@/lib/types";

interface StubMeta {
  stub: boolean;
  stubMessage?: string;
}

interface CalcStore {
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
}

const DEFAULT_FLEET: FleetEntry[] = [
  { _id: crypto.randomUUID(), vehicle_id: "cat-797f", count: 8, trips_per_day: 22, payload_kn: 4_000 },
  { _id: crypto.randomUUID(), vehicle_id: "cat-789d", count: 4, trips_per_day: 24, payload_kn: 2_100 },
];

const DEFAULT_SCENARIOS: CostScenario[] = [
  {
    name: "Asphalt 100 mm",
    surface: "asphalt",
    thickness_mm: 100,
    haul_distance_km: 5,
    trips_per_day: 200,
  },
  {
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

      setFleet: (fleet) => set({ fleet }),
      setDesignLifeYears: (designLifeYears) => set({ designLifeYears }),
      setCesaResult: (result, stub, stubMessage) =>
        set({ cesaResult: { ...result, stub, stubMessage } }),
      setSubgradeCbr: (subgradeCbr) => set({ subgradeCbr }),
      setCoverages: (coverages) => set({ coverages }),
      setTrhCategory: (trhCategory) => set({ trhCategory }),
      setCbrResult: (result, stub, stubMessage) =>
        set({ cbrResult: { ...result, stub, stubMessage } }),
      setTrhResult: (result, stub, stubMessage) =>
        set({ trhResult: { ...result, stub, stubMessage } }),
      setCostScenarios: (costScenarios) => set({ costScenarios }),
      setCostResult: (result, stub, stubMessage) =>
        set({ costResult: { ...result, stub, stubMessage } }),
      setProjectName: (projectName) => set({ projectName }),
      setAuthorName: (authorName) => set({ authorName }),
    }),
    {
      name: "haul-calc-store",
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
      }),
    },
  ),
);
