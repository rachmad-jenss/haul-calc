import { test as base, expect, type Page } from "@playwright/test";
import { mkdirSync } from "fs";
import { join } from "path";

mkdirSync(join("tests", "screenshots"), { recursive: true });

export const SS = (name: string) => join("tests", "screenshots", `${name}.png`);

export const STORE_KEY = "haul-calc-store";

/** Persist v10 — app preferences only (matches production partialize). */
export function preferencesPersistPayload(overrides: Record<string, unknown> = {}) {
  return {
    version: 10,
    state: {
      theme: "system",
      autoCheckUpdates: true,
      unitSystem: "SI",
      recentFiles: [],
      ...overrides,
    },
  };
}

/** Seed in-memory project state in dev/E2E without persisting across restarts. */
export async function seedStoreState(page: Page, partial: Record<string, unknown>) {
  await page.evaluate((patch) => {
    window.__haulCalcSeedStore?.(patch);
  }, partial);
}

export async function navigate(page: Page, route: string) {
  await page.goto(`/#${route}`);
  await page.waitForTimeout(400);
}

/**
 * Injected before app scripts run. Mocks window.__TAURI_INTERNALS__.invoke
 * so @tauri-apps/api/core's `invoke` works in a plain browser context.
 */
const TAURI_MOCK = `(function () {
  var VEHICLES = [
    { id: "cat-797f", name: "CAT 797F", gvw_kn: 6000, axles: 4 },
    { id: "cat-789d", name: "CAT 789D", gvw_kn: 3200, axles: 4 },
  ];
  // Derived from fleet: 8×797F (22 trips/d) + 4×789D (24 trips/d), 10yr
  //   Total vehicle passes: 8×22 + 4×24 = 272/d × 365 × 10 = 992,800
  //   Design coverages: 992,800 × avg_coverage_factor(~0.072) ≈ 72,000
  //   CESA: 992,800 × EDF(~12.6 for mixed heavy fleet) ≈ 12,500,000
  //   Axle passes: 992,800 vehicles × 4 axles ≈ 3,971,000 total axle passes
  var CESA = {
    cesa: 12480000, design_coverages: 72000, design_life_years: 10,
    axle_load_distribution: [
      // Per-wheel loads; passes scale with wheel positions (DAS-142)
      { axle_kn: 763,  passes: 642400   },
      { axle_kn: 286,  passes: 5139200  },
      { axle_kn: 400,  passes: 350400   },
      { axle_kn: 800,  passes: 2803200  },
    ],
  };
  // CBR method (USACE): CBR=8%, 72,000 design coverages, ultra-heavy vehicles
  //   Total structure: ~750mm — typical for low-CBR + heavy mining traffic
  function layersFromCustomMaterials(mats, totalMm) {
    var n = mats.length;
    var each = Math.floor(totalMm / n);
    var rem = totalMm - each * n;
    return mats.map(function (m, i) {
      return {
        name: m.name || "Custom layer",
        thickness_mm: each + (i < rem ? 1 : 0),
        cbr: m.cbr_percent != null ? m.cbr_percent : null,
        material_type: m.material_type || "granular",
      };
    });
  }
  function cbrResponse(params) {
    var cov = params && params.design_coverages;
    var mats = (params && params.custom_materials) || [];
    var total = 750;
    var base = {
      method: "USACE TM 5-822-12 CBR design curves", subgrade_cbr: 8,
      confidence: "high",
      layers: mats.length
        ? layersFromCustomMaterials(mats, total)
        : [
            { name: "Surface (asphalt)", thickness_mm: 105, cbr: null },
            { name: "Base course",       thickness_mm: 345, cbr: 80  },
            { name: "Sub-base",          thickness_mm: 300, cbr: 30  },
          ],
      total_thickness_mm: total,
    };
    if (cov > 1000000) {
      base.confidence = "medium";
      base.warning =
        "Design coverages (" + cov.toLocaleString() + ") exceed the USACE CBR curve maximum " +
        "(1,000,000). Thickness has been clamped to the curve boundary.";
    } else if (cov > 100000) {
      base.confidence = "medium";
      base.warning =
        "Design coverages (" + cov.toLocaleString() + ") are in the extrapolated zone " +
        "(beyond 100,000). Result carries medium confidence.";
    }
    return base;
  }
  // TRH14 Category B: 1,000,000–30,000,000 design passes — 72,000 coverages
  //   Typical B structure: 100mm WC + 300-400mm base + 250-350mm sub-base
  var TRH14 = {
    method: "TRH 14 (CSRA 1985) design catalog", category: "B",
    confidence: "medium",
    layers: [
      { name: "Wearing course", thickness_mm: 100, cbr: null },
      { name: "Base",           thickness_mm: 380, cbr: 80  },
      { name: "Sub-base",       thickness_mm: 320, cbr: 25  },
    ],
    total_thickness_mm: 800,
  };
  function trhResponse(params) {
    var cov = params && params.design_coverages;
    var mats = (params && params.custom_materials) || [];
    var base = Object.assign({}, TRH14);
    if (mats.length) {
      base.layers = layersFromCustomMaterials(mats, base.total_thickness_mm);
    }
    if (cov > 1000000) {
      base.warning =
        "Design coverages (" + cov.toLocaleString() + ") exceed the TRH 14 catalog maximum. " +
        "Thickness has been clamped to the highest available catalog value.";
    }
    return base;
  }
  // Economics: 200 trips/d, 5 km haul, 10 trucks
  //   Truck-km/day = 200 × 10 km = 2,000 truck-km
  //   Fuel: asphalt 0.85 L/km × $1.20/L × 2000 × 365 ≈ $744k/yr
  //         gravel  1.10 L/km × $1.20/L × 2000 × 365 ≈ $963k/yr  (+29%)
  //   Tires: asphalt life ~2,000h → gravel ~700h (3× faster wear)
  //         asphalt ~$380k/yr; gravel ~$960k/yr
  //   Maintenance: asphalt $150k/yr; gravel $340k/yr
  var COMPARISON = {
    scenarios: [
      { name: "Asphalt 100 mm", tire_cost_usd_per_year: 380000, fuel_cost_usd_per_year: 744000, maintenance_cost_usd_per_year: 150000 },
      { name: "Gravel 250 mm",  tire_cost_usd_per_year: 960000, fuel_cost_usd_per_year: 963000, maintenance_cost_usd_per_year: 340000 },
    ],
  };
  function compareMethodsResponse(params) {
    var mats = (params && params.custom_materials) || [];
    return {
      usace: {
        method: "USACE TM 5-822-12 CBR design curves + AASHTO 4th-power LEF",
        total_thickness_mm: 750,
        total_coverages: 72000,
        total_cesa: 12480000,
        confidence: "high",
      },
      trh14: {
        method: "TRH 14 (CSRA 1985) design catalog",
        total_thickness_mm: 800,
        total_coverages: 72000,
        material_class: "G5",
        confidence: "medium",
      },
      delta_mm: 50,
      subgrade_cbr: 8,
      confidence: "high",
    };
  }
  var SUMMARY = {
    title: "Haul Road Design Summary",
    generated_at: new Date().toISOString(),
    inputs: { fleet_vehicles: 12, design_life_years: 10, cesa: 12480000 },
    results: { design_coverages: 72000, recommended_method: "CBR", total_thickness_mm: 750 },
  };
  var VERSION  = { haulpave: "0.2.0", bridge: "0.1.0" };
  var HEALTH   = { ok: true, haulpave_loaded: true };

  function env(data) {
    return { data: data, stub: true, stub_message: "Stub data — Phase 0" };
  }

  var MATERIALS = [
    { name: "Gravel-sand mix (G5)", material_class: "G5", cbr_range: [7, 15], typical_modulus_mpa: 120, source: "CSRA TRH 14 (stub)" },
    { name: "Crushed stone base (high quality)", material_class: "N/A", cbr_range: [80, 100], typical_modulus_mpa: 450, source: "USACE TM 5-822-12 (stub)" },
  ];
  var LAYER_COEFF = { coefficient: 0.10 };
  var CUSTOM_MAT = {
    name: "User material", material_type: "granular", elastic_modulus_mpa: 120,
    cbr_percent: 15, poisson_ratio: 0.35, layer_coefficient: null, thickness_mm: null, description: "",
  };
  var ECON_DETAIL = {
    scenarios: [
      { name: "Asphalt 100 mm", cesa: 12480000, fuel_cost_usd_per_year: 744000, tire_cost_usd_per_year: 380000, maintenance_cost_usd_per_year: 150000, total_cost_usd_per_year: 1274000, npv_usd: 8500000, annual_equivalent_cost_usd: 1250000, cashflows: [] },
    ], design_life_years: 10, discount_rate: 0.08,
  };
  var EXCEL_EXPORT = { bytes_written: 0 };

  function sensitivityResponse(p) {
    var metric = p && p.metric;
    var variable = p && p.variable;
    var min = Number(p && p.min_value);
    var max = Number(p && p.max_value);
    var steps = Math.max(3, Math.min(20, Number(p && p.steps) || 10));
    var perturbations = [];
    for (var i = 0; i < steps; i++) {
      var t = steps === 1 ? 0 : i / (steps - 1);
      var x = min + t * (max - min);
      var y;
      if (metric === "cost_total" && variable === "trips_per_day") {
        y = 1484000 * x;
      } else if (metric === "total_thickness_mm") {
        y = 720 + Math.round(x);
      } else if (metric === "cesa") {
        y = 12480000 + Math.round(x * 1000);
      } else {
        y = null;
      }
      perturbations.push({ x: x, y: y });
    }
    return env({ metric: metric, variable: variable, perturbations: perturbations });
  }
  var DISPATCH = {
    list_vehicles:    function() { return env(VEHICLES);    },
    compute_cesa:     function() { return env(CESA);        },
    cbr_thickness:    function(p) { return env(cbrResponse(p)); },
    trh14_thickness:  function(p) { return env(trhResponse(p)); },
    compare_scenarios:function() { return env(COMPARISON);  },
    compare_methods:  function(p) { return env(compareMethodsResponse(p)); },
    design_pavement:  function(p) { return env(cbrResponse(p || { subgrade_cbr: 8, design_coverages: 72000 })); },
    analyze_sensitivity: function(p) { return sensitivityResponse(p); },
    material_library: function() { return env(MATERIALS); },
    material_to_layer_coefficient: function() { return env(LAYER_COEFF); },
    custom_material:  function(p) {
      var req = p || {};
      return env({
        name: req.name || CUSTOM_MAT.name,
        material_type: req.material_type || CUSTOM_MAT.material_type,
        elastic_modulus_mpa: req.elastic_modulus_mpa != null ? req.elastic_modulus_mpa : CUSTOM_MAT.elastic_modulus_mpa,
        cbr_percent: req.cbr_percent != null ? req.cbr_percent : CUSTOM_MAT.cbr_percent,
        poisson_ratio: req.poisson_ratio != null ? req.poisson_ratio : CUSTOM_MAT.poisson_ratio,
        layer_coefficient: req.layer_coefficient != null ? req.layer_coefficient : CUSTOM_MAT.layer_coefficient,
        thickness_mm: req.thickness_mm != null ? req.thickness_mm : CUSTOM_MAT.thickness_mm,
        description: req.description != null ? req.description : CUSTOM_MAT.description,
      });
    },
    compute_economics_detail: function() { return env(ECON_DETAIL); },
    export_comparison_to_excel: function() { return env(EXCEL_EXPORT); },
    build_summary:    function() { return env(SUMMARY);     },
    get_version:      function() { return env(VERSION);     },
    health_check:     function() { return env(HEALTH);      },
  };

  window.__TAURI_INTERNALS__ = {
    invoke: function(cmd, args) {
      return new Promise(function(resolve, reject) {
        setTimeout(function() {
          if (cmd === "get_sidecar_status") {
            return resolve(window.__HAULCALC_SIDECAR_STATUS__ || "running");
          }
          if (cmd === "restart_sidecar")    { return resolve(undefined); }
          if (cmd === "take_pending_file_path") { return resolve(null); }
          if (cmd === "plugin:dialog|save") { return resolve("mocked_file.csv"); }
          if (cmd === "plugin:dialog|open") {
            if (window.__HAULCALC_OPEN_JSON__) {
              return resolve("C:/mock/open.hcalc");
            }
            return resolve(null);
          }
          if (cmd === "plugin:fs|write_text_file") { return resolve(undefined); }
          if (cmd === "plugin:fs|read_text_file") {
            if (window.__HAULCALC_OPEN_JSON__) {
              try {
                return resolve(JSON.parse(window.__HAULCALC_OPEN_JSON__));
              } catch (e) {
                return resolve(window.__HAULCALC_OPEN_JSON__);
              }
            }
            return reject({ code: "ENOENT", message: "No test file", stub: false });
          }
          if (cmd === "plugin:dialog|message") {
            var buttons = args && args.buttons;
            if (typeof buttons === "object" && "ok" in buttons) {
              return resolve(buttons.ok);
            }
            return resolve("Yes");
          }
          if (cmd === "haul_pave_call" && args && args.method === "health_check") {
            if (window.__HAULCALC_SIDECAR_STATUS__ === "killed") {
              return reject({ code: "SIDEcar_DOWN", message: "Sidecar not running", stub: false });
            }
          }
          if (cmd !== "haul_pave_call") {
            return reject({ code: "UNKNOWN_CMD", message: "Unknown command: " + cmd, stub: false });
          }
          var handler = DISPATCH[args && args.method];
          if (!handler) {
            return reject({ code: "UNKNOWN_METHOD", message: "Unknown method: " + (args && args.method), stub: true });
          }
          resolve(handler(args && args.params));
        }, 30);
      });
    },
  };
})();`;

export const test = base.extend<Record<string, never>>({
  page: async ({ page }, use) => {
    await page.addInitScript(TAURI_MOCK);
    await page.goto("/");
    await page.waitForTimeout(500);
    await use(page);
  },
});

/** Fresh page that lands on Dashboard with one render error queued (DAS-136 E2E). */
export const testE2eThrow = base.extend<Record<string, never>>({
  page: async ({ page }, use) => {
    await page.addInitScript(() => {
      window.__HAULCALC_E2E_SHOULD_THROW__ = true;
    });
    await page.addInitScript(TAURI_MOCK);
    await page.goto("/#/dashboard");
    await page.waitForTimeout(800);
    await use(page);
  },
});

export { expect } from "@playwright/test";
