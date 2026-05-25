import { create } from "zustand";
import { persist } from "zustand/middleware";
import { temporal } from "zundo";
import { normalizePersistedFileBinding } from "@/lib/file-binding";
import type { CompareReportSnapshot } from "@/lib/compare-report";
import type { SensitivityReportSnapshot } from "@/lib/sensitivity-report";
import type {
  CesaResult,
  CostComparison,
  CostScenario,
  CustomMaterialEntry,
  CustomMaterialRequest,
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

export type DisplayCurrency = "USD" | "IDR";

export const DEFAULT_USD_TO_IDR_RATE = 16_000;

/** Fields restored across app restarts (preferences only — not project data). */
export const PERSISTED_PREFERENCE_KEYS = [
  "theme",
  "autoCheckUpdates",
  "unitSystem",
  "recentFiles",
  "currency",
  "usdToIdrRate",
] as const;

export type PersistedPreferenceKey = (typeof PERSISTED_PREFERENCE_KEYS)[number];

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
  sensitivitySnapshot: SensitivityReportSnapshot | null;
  /** Session compare workspace (Compare tab); not saved in .hcalc. */
  compareSnapshot: CompareReportSnapshot | null;

  // Custom vehicles
  customVehicles: CustomVehicle[];

  // Custom pavement materials
  customMaterials: CustomMaterialEntry[];

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

  // Display currency (engine remains USD)
  currency: DisplayCurrency;
  usdToIdrRate: number;

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
  addCustomMaterial: (m: CustomMaterialRequest) => void;
  removeCustomMaterial: (id: string) => void;
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
  setSensitivitySnapshot: (snapshot: SensitivityReportSnapshot | null) => void;
  setCompareSnapshot: (snapshot: CompareReportSnapshot | null) => void;
  loadFromSnapshot: (data: Partial<CalcStore>) => void;
  setActiveFileName: (name: string | null) => void;
  setActiveFilePath: (path: string | null) => void;
  pushRecentFile: (filePath: string) => void;
  setTheme: (theme: 'light' | 'dark' | 'system') => void;
  setAutoCheckUpdates: (enabled: boolean) => void;
  setUnitSystem: (system: UnitSystem) => void;
  setCurrency: (currency: DisplayCurrency) => void;
  setUsdToIdrRate: (rate: number) => void;
}

export type PersistedPreferences = Pick<CalcStore, PersistedPreferenceKey>;

function pickPersistedPreferences(state: CalcStore): PersistedPreferences {
  return {
    theme: state.theme,
    autoCheckUpdates: state.autoCheckUpdates,
    unitSystem: state.unitSystem,
    recentFiles: state.recentFiles,
    currency: state.currency,
    usdToIdrRate: state.usdToIdrRate,
  };
}

function mergePersistedPreferences(
  persisted: unknown,
  _current: CalcStore,
): Partial<CalcStore> {
  if (!persisted || typeof persisted !== "object") return {};
  const p = persisted as Partial<PersistedPreferences>;
  const patch: Partial<CalcStore> = {};
  for (const key of PERSISTED_PREFERENCE_KEYS) {
    if (p[key] !== undefined) {
      (patch as Record<string, unknown>)[key] = p[key];
    }
  }
  return patch;
}

function stripNonPreferencePersistedFields(s: Record<string, unknown>): void {
  for (const key of Object.keys(s)) {
    if (!(PERSISTED_PREFERENCE_KEYS as readonly string[]).includes(key)) {
      delete s[key];
    }
  }
}

const DEFAULT_FLEET: FleetEntry[] = [
  { _id: crypto.randomUUID(), vehicle_id: "cat-797f", count: 8, trips_per_day: 22, payload_kn: 4_000 },
  { _id: crypto.randomUUID(), vehicle_id: "cat-789d", count: 4, trips_per_day: 24, payload_kn: 2_100 },
];

let suppressProjectDirtyTracking = false;

function withoutProjectDirtyTracking<T>(fn: () => T): T {
  suppressProjectDirtyTracking = true;
  try {
    return fn();
  } finally {
    suppressProjectDirtyTracking = false;
  }
}

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
      customMaterials: [],

      projectName: "Pit South — Main Haul",
      authorName: "",
      reportSummary: null,
      sensitivitySnapshot: null,
      compareSnapshot: null,

      activeFileName: null,
      activeFilePath: null,
      recentFiles: [],

      theme: 'system',

      autoCheckUpdates: true,

      unitSystem: 'SI',

      currency: 'USD',
      usdToIdrRate: DEFAULT_USD_TO_IDR_RATE,

      boqGeometry: { roadLengthKm: 1.0, roadWidthM: 8.0, shoulderWidthM: 1.5 },

      isProjectDirty: false,
      setProjectDirty: (isProjectDirty) => set({ isProjectDirty }),
      resetProject: () =>
        withoutProjectDirtyTracking(() =>
          set({
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
            customVehicles: [],
            customMaterials: [],
            projectName: "Pit South — Main Haul",
            authorName: "",
            reportSummary: null,
            sensitivitySnapshot: null,
            compareSnapshot: null,
            activeFileName: null,
            activeFilePath: null,
            boqGeometry: { roadLengthKm: 1.0, roadWidthM: 8.0, shoulderWidthM: 1.5 },
            isProjectDirty: false,
            autoCheckUpdates: true,
          }),
        ),

      setFleet: (fleet) => set({ fleet, cesaDirty: true, reportSummary: null, isProjectDirty: true }),
      setWorkingDaysPerYear: (workingDaysPerYear) =>
        set({ workingDaysPerYear, cesaDirty: true, reportSummary: null, isProjectDirty: true }),
      addCustomVehicle: (v) =>
        set((s) => ({
          customVehicles: [...s.customVehicles, { ...v, id: "custom-" + crypto.randomUUID() }],
          isProjectDirty: true,
        })),
      removeCustomVehicle: (id) =>
        set((s) => ({
          customVehicles: s.customVehicles.filter((c) => c.id !== id),
          fleet: s.fleet.filter((f) => f.vehicle_id !== id),
          cesaDirty: true,
          reportSummary: null,
          isProjectDirty: true,
        })),
      addCustomMaterial: (m) =>
        set((s) => ({
          customMaterials: [
            ...s.customMaterials,
            {
              ...m,
              id: "mat-" + crypto.randomUUID(),
              cbr_percent: m.cbr_percent ?? null,
              poisson_ratio: m.poisson_ratio ?? 0.35,
              layer_coefficient: m.layer_coefficient ?? null,
              thickness_mm: m.thickness_mm ?? null,
              description: m.description ?? "",
            },
          ],
          pavementDirty: true,
          reportSummary: null,
          isProjectDirty: true,
        })),
      removeCustomMaterial: (id) =>
        set((s) => ({
          customMaterials: s.customMaterials.filter((c) => c.id !== id),
          pavementDirty: true,
          reportSummary: null,
          isProjectDirty: true,
        })),
      setDesignLifeYears: (designLifeYears) =>
        set({ designLifeYears, cesaDirty: true, reportSummary: null, isProjectDirty: true }),
      setCesaResult: (result, stub, stubMessage) =>
        withoutProjectDirtyTracking(() =>
          set((s) => ({
            cesaResult: { ...result, stub, stubMessage },
            cesaDirty: false,
            coverages: result.design_coverages,
            cbrResult: s.coverages !== result.design_coverages ? null : s.cbrResult,
            trhResult: s.coverages !== result.design_coverages ? null : s.trhResult,
            pavementDirty: s.coverages !== result.design_coverages ? true : s.pavementDirty,
          })),
        ),
      setSubgradeCbr: (subgradeCbr) =>
        set({ subgradeCbr, pavementDirty: true, reportSummary: null, isProjectDirty: true }),
      setCoverages: (coverages) =>
        set({ coverages, pavementDirty: true, reportSummary: null, isProjectDirty: true }),
      setTrhCategory: (trhCategory) =>
        set({ trhCategory, pavementDirty: true, reportSummary: null, isProjectDirty: true }),
      setCbrResult: (result, stub, stubMessage) =>
        withoutProjectDirtyTracking(() =>
          set({ cbrResult: { ...result, stub, stubMessage }, pavementDirty: false }),
        ),
      setTrhResult: (result, stub, stubMessage) =>
        withoutProjectDirtyTracking(() =>
          set({ trhResult: { ...result, stub, stubMessage }, pavementDirty: false }),
        ),
      setCostScenarios: (costScenarios) =>
        set({ costScenarios, economicsDirty: true, reportSummary: null, isProjectDirty: true }),
      setCostResult: (result, stub, stubMessage) =>
        withoutProjectDirtyTracking(() =>
          set({ costResult: { ...result, stub, stubMessage }, economicsDirty: false }),
        ),
      setLccaInputs: (lccaInputs) => set({ lccaInputs, lccaResult: null, isProjectDirty: true }),
      setLccaResult: (lccaResult) =>
        withoutProjectDirtyTracking(() => set({ lccaResult })),
      setProjectName: (projectName) => set({ projectName, reportSummary: null, isProjectDirty: true }),
      setAuthorName: (authorName) => set({ authorName, reportSummary: null, isProjectDirty: true }),
      setReportSummary: (result, stub, stubMessage) =>
        withoutProjectDirtyTracking(() =>
          set({ reportSummary: { ...result, stub, stubMessage } }),
        ),
      setSensitivitySnapshot: (sensitivitySnapshot) =>
        withoutProjectDirtyTracking(() => set({ sensitivitySnapshot, isProjectDirty: true })),
      setCompareSnapshot: (compareSnapshot) =>
        withoutProjectDirtyTracking(() => set({ compareSnapshot })),
      loadFromSnapshot: (data) =>
        withoutProjectDirtyTracking(() =>
          set({ ...data, cesaDirty: false, pavementDirty: false, economicsDirty: false, isProjectDirty: false }),
        ),
      setActiveFileName: (activeFileName) => set({ activeFileName }),
      setActiveFilePath: (activeFilePath) => set({ activeFilePath }),
      pushRecentFile: (filePath) =>
        set((s) => ({
          recentFiles: [filePath, ...s.recentFiles.filter((f) => f !== filePath)].slice(0, 5),
        })),
      setTheme: (theme) => set({ theme }),
      setAutoCheckUpdates: (autoCheckUpdates) => set({ autoCheckUpdates }),
      setUnitSystem: (unitSystem) => set({ unitSystem }),
      setCurrency: (currency) => set({ currency }),
      setUsdToIdrRate: (usdToIdrRate) => {
        if (!Number.isFinite(usdToIdrRate) || usdToIdrRate <= 0) return;
        set({ usdToIdrRate });
      },
      setBoqGeometry: (boqGeometry) => set({ boqGeometry, isProjectDirty: true }),
    }),
    {
      name: "haul-calc-store",
      version: 11,
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
        if (fromVersion < 9) {
          s.isProjectDirty = false;
        }
        if (fromVersion < 10) {
          stripNonPreferencePersistedFields(s);
        }
        if (fromVersion < 11) {
          if (s.currency !== "USD" && s.currency !== "IDR") s.currency = "USD";
          const rate = s.usdToIdrRate;
          if (typeof rate !== "number" || !Number.isFinite(rate) || rate <= 0) {
            s.usdToIdrRate = DEFAULT_USD_TO_IDR_RATE;
          }
        }
        delete s.isProjectDirty;
        return s;
      },
      merge: (persisted, current) => ({
        ...current,
        ...mergePersistedPreferences(persisted, current),
        // Never clobber edits that marked the project dirty before rehydrate finishes.
        isProjectDirty: current.isProjectDirty,
      }),
      partialize: (state) => pickPersistedPreferences(state),
      onRehydrateStorage: () => (_state, error) => {
        const apply = () => {
          if (!error) {
            withoutProjectDirtyTracking(() => {
              const state = useCalcStore.getState();
              const patch = normalizePersistedFileBinding(state);
              useCalcStore.setState({
                ...(patch ?? {}),
                // Preserve edits made before persist rehydrate finishes.
                isProjectDirty: state.isProjectDirty,
              });
            });
          }
          trackProjectDirty = true;
        };
        queueMicrotask(apply);
      },
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
        customMaterials: state.customMaterials,
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
        sensitivitySnapshot: state.sensitivitySnapshot,
        isProjectDirty: state.isProjectDirty,
      }),
    },
  ),
);

// persist is inner to temporal(zundo) — useCalcStore.persist is undefined at runtime.
// Enable tracking after rehydrate in onRehydrateStorage below.
let trackProjectDirty = false;

// Undo/redo restores tracked fields without calling setters — subscribe marks dirty for those paths only.
useCalcStore.subscribe((state, prevState) => {
  if (!trackProjectDirty || suppressProjectDirtyTracking) return;
  // Respect undo/redo/save snapshots that explicitly set isProjectDirty.
  if (state.isProjectDirty !== prevState.isProjectDirty) return;
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
    "customMaterials",
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
