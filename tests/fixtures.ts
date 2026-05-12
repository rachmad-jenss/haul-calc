import { test as base, expect, type Page } from "@playwright/test";
import { mkdirSync } from "fs";
import { join } from "path";

mkdirSync(join("tests", "screenshots"), { recursive: true });

export const SS = (name: string) => join("tests", "screenshots", `${name}.png`);

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
      // 797F front axle (GVW/4 × 0.4): ~600 kN × 642,400 passes
      { axle_kn: 600,  passes: 642400  },
      // 797F rear axle (GVW/4 × 1.6 per rear): ~1400 kN × 642,400
      { axle_kn: 1400, passes: 642400  },
      // 789D front axle: ~400 kN × 350,400
      { axle_kn: 400,  passes: 350400  },
      // 789D rear axle: ~800 kN × 350,400
      { axle_kn: 800,  passes: 350400  },
    ],
  };
  // CBR method (USACE): CBR=8%, 72,000 design coverages, ultra-heavy vehicles
  //   Total structure: ~750mm — typical for low-CBR + heavy mining traffic
  var CBR = {
    method: "CBR", subgrade_cbr: 8,
    layers: [
      { name: "Wearing course", thickness_mm: 150, cbr: null },
      { name: "Base",           thickness_mm: 350, cbr: 80  },
      { name: "Sub-base",       thickness_mm: 250, cbr: 30  },
    ],
    total_thickness_mm: 750,
  };
  // TRH14 Category B: 1,000,000–30,000,000 design passes — 72,000 coverages
  //   Typical B structure: 100mm WC + 300-400mm base + 250-350mm sub-base
  var TRH14 = {
    method: "TRH14", category: "B",
    layers: [
      { name: "Wearing course", thickness_mm: 100, cbr: null },
      { name: "Base",           thickness_mm: 380, cbr: 80  },
      { name: "Sub-base",       thickness_mm: 320, cbr: 25  },
    ],
    total_thickness_mm: 800,
  };
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

  var DISPATCH = {
    list_vehicles:    function() { return env(VEHICLES);    },
    compute_cesa:     function() { return env(CESA);        },
    cbr_thickness:    function() { return env(CBR);         },
    trh14_thickness:  function() { return env(TRH14);       },
    compare_scenarios:function() { return env(COMPARISON);  },
    build_summary:    function() { return env(SUMMARY);     },
    get_version:      function() { return env(VERSION);     },
    health_check:     function() { return env(HEALTH);      },
  };

  window.__TAURI_INTERNALS__ = {
    invoke: function(cmd, args) {
      return new Promise(function(resolve, reject) {
        setTimeout(function() {
          if (cmd === "get_sidecar_status") { return resolve("running"); }
          if (cmd === "restart_sidecar")    { return resolve(undefined); }
          if (cmd !== "haul_pave_call") {
            return reject({ code: "UNKNOWN_CMD", message: "Unknown command: " + cmd, stub: false });
          }
          var handler = DISPATCH[args && args.method];
          if (!handler) {
            return reject({ code: "UNKNOWN_METHOD", message: "Unknown method: " + (args && args.method), stub: true });
          }
          resolve(handler());
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

export { expect } from "@playwright/test";
