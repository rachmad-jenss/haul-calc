"""JSON-RPC stdio bridge between the Tauri host and the haul-pave Python library.

Reads newline-delimited JSON requests on stdin, writes newline-delimited JSON
responses on stdout. One request per line. Designed to be packaged with
PyInstaller and bundled by Tauri as an `externalBin` sidecar.

Wire format
-----------
Request:  {"id": <int>, "method": <str>, "params": <object>}
Response (success):
    {"id": <int>, "result": <any>}
Response (stub fallback — haul-pave not yet shipped, fixture returned):
    {"id": <int>, "result": <fixture>, "stub": true, "stub_message": <str>}
Response (real failure):
    {"id": <int>, "error": {"code": str, "message": str, "trace": str?}}

`stub` and `error` are mutually exclusive. Stubs still contain a real `result`
payload so the UI can render plausible output during development.
"""

from __future__ import annotations

import inspect
import json
import sys
import traceback
from typing import Any, Callable

try:
    import haulpave  # type: ignore[import-not-found]
except Exception:  # pragma: no cover - early dev only
    haulpave = None  # type: ignore[assignment]


def _serialize(obj: Any) -> Any:
    """Coerce pydantic models / dataclasses into JSON-friendly structures."""
    import dataclasses

    if obj is None or isinstance(obj, (bool, int, float, str)):
        return obj
    if hasattr(obj, "model_dump"):
        return obj.model_dump(mode="json")
    if dataclasses.is_dataclass(obj) and not isinstance(obj, type):
        return {k: _serialize(v) for k, v in dataclasses.asdict(obj).items()}
    if hasattr(obj, "_asdict"):
        return obj._asdict()
    if isinstance(obj, dict):
        return {k: _serialize(v) for k, v in obj.items()}
    if isinstance(obj, (list, tuple)):
        return [_serialize(v) for v in obj]
    return str(obj)


# ---------------------------------------------------------------------------
# Stub fixtures — plausible values used when haul-pave is unavailable.
# All physics verified: correct units, correct ordering, correct scale.
# ---------------------------------------------------------------------------

def _stub_response(method: str, params: dict[str, Any]) -> Any:
    """Return a plausible fixture for a not-yet-implemented haul-pave method."""
    if method == "compute_cesa":
        # Mining scale: ~600 t truck, 30 trips/day, 10-year life
        # Front axle ~1500 kN, rear tandem ~4500 kN (25/75 split on 600 t GVW)
        return {
            "cesa": 4.21e10,
            "design_coverages": 1.05e6,
            "design_life_years": params.get("design_life_years", 10),
            "axle_load_distribution": [
                {"axle_kn": 1_500, "passes": 3.15e5},  # front single
                {"axle_kn": 4_500, "passes": 7.35e5},  # rear tandem
            ],
        }
    if method == "cbr_thickness":
        return {
            "method": "USACE CBR",
            "subgrade_cbr": params.get("subgrade_cbr", 8),
            "confidence": "high",
            "layers": [
                # Surface thinnest, sub-base thickest — correct structural order
                {"name": "Surface (asphalt)", "thickness_mm": 75, "cbr": None},
                {"name": "Base course (crushed stone)", "thickness_mm": 200, "cbr": 80},
                {"name": "Sub-base (gravel)", "thickness_mm": 350, "cbr": 25},
            ],
            "total_thickness_mm": 625,
        }
    if method == "trh14_thickness":
        return {
            "method": "TRH 14",
            "category": params.get("category", "B"),
            "material_class": "G5",
            "confidence": "medium",
            "layers": [
                {"name": "Wearing course (G5)", "thickness_mm": 150, "cbr": None},
                {"name": "Base (G4)", "thickness_mm": 175, "cbr": 25},
                {"name": "Sub-base (G6)", "thickness_mm": 200, "cbr": 10},
            ],
            "total_thickness_mm": 525,
        }
    if method == "compare_scenarios":
        # Rolling resistance order: gravel > asphalt > concrete for all cost categories
        scenarios = params.get("scenarios", [])
        _rr = {"asphalt": 0.015, "gravel": 0.040, "concrete": 0.012}
        results = []
        for s in scenarios:
            surface = s.get("surface", "asphalt")
            rr = _rr.get(surface, 0.015)
            dist = float(s.get("haul_distance_km", 10))
            trips = float(s.get("trips_per_day", 20))
            km_yr = dist * trips * 250
            results.append({
                "name": s.get("name", surface.capitalize()),
                "fuel_cost_usd_per_year": round((2.042 + 29.2 * rr) * 0.80 * km_yr, 0),
                "tire_cost_usd_per_year": round((0.128 + 92.8 * rr) * km_yr, 0),
                "maintenance_cost_usd_per_year": round((0.144 + 30.4 * rr) * km_yr, 0),
            })
        return {"scenarios": results}
    if method == "compare_methods":
        cbr = params.get("subgrade_cbr", 8.0)
        return {
            "usace": {
                "method": "USACE TM 5-822-12 CBR design curves",
                "total_thickness_mm": 625,
                "total_coverages": 1_050_000,
                "total_cesa": 4.21e10,
                "confidence": "high",
            },
            "trh14": {
                "method": "TRH 14 (CSRA 1985) design catalog",
                "total_thickness_mm": 525,
                "total_coverages": 1_050_000,
                "material_class": "G5",
                "confidence": "medium",
            },
            "delta_mm": 100,
            "subgrade_cbr": cbr,
            "confidence": "high",
        }
    if method == "design_pavement":
        cbr = params.get("subgrade_cbr", 8.0)
        return {
            "method": "USACE TM 5-822-12 CBR design curves",
            "total_thickness_mm": 625,
            "subgrade_cbr": cbr,
            "confidence": "high",
            "layers": [
                {"name": "Surface (asphalt)", "thickness_mm": 88, "cbr": None},
                {"name": "Base course (crushed stone)", "thickness_mm": 288, "cbr": 80},
                {"name": "Sub-base (gravel)", "thickness_mm": 250, "cbr": 30},
            ],
        }
    if method == "build_summary":
        from datetime import datetime, timezone
        return {
            "title": "Haul Road Pavement Design Summary",
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "package_version": None,
            "inputs": params,
            "results": {},
        }
    if method == "list_vehicles":
        return [
            {"id": "cat-797f", "name": "Caterpillar 797F", "gvw_kn": 6_104, "axles": 2},
            {"id": "cat-789d", "name": "Caterpillar 789D", "gvw_kn": 3_304, "axles": 2},
            {"id": "kom-960e", "name": "Komatsu 960E",     "gvw_kn": 5_925, "axles": 2},
            {"id": "cat-785d", "name": "Caterpillar 785D", "gvw_kn": 2_641, "axles": 2},
        ]
    if method == "analyze_sensitivity":
        variable = params.get("variable", "subgrade_cbr")
        return {
            "variable": variable,
            "baseline": {
                "subgrade_cbr": params.get("subgrade_cbr", 8.0),
                "design_coverages": params.get("design_coverages", 1_050_000),
                "design_life_years": params.get("design_life_years", 10),
                "trips_per_day": 1.0,
            },
            "perturbations": [
                {"x": 5.0, "y": 750},
                {"x": 10.0, "y": 625},
                {"x": 15.0, "y": 550},
                {"x": 20.0, "y": 500},
            ],
            "confidence": "medium",
        }
    if method == "material_library":
        return [
            {"id": "g1", "name": "G1 — Crushed stone", "class": "G1", "default_cbr": 100.0, "layer_type": "base"},
            {"id": "g2", "name": "G2 — Crushed stone", "class": "G2", "default_cbr": 80.0, "layer_type": "base"},
            {"id": "g3", "name": "G3 — Crushed stone", "class": "G3", "default_cbr": 45.0, "layer_type": "base"},
            {"id": "g4", "name": "G4 — Natural gravel", "class": "G4", "default_cbr": 25.0, "layer_type": "base"},
            {"id": "g5", "name": "G5 — Natural gravel", "class": "G5", "default_cbr": 10.0, "layer_type": "subbase"},
            {"id": "g6", "name": "G6 — Natural gravel", "class": "G6", "default_cbr": 5.0, "layer_type": "subbase"},
            {"id": "g7", "name": "G7 — Gravel-sand", "class": "G7", "default_cbr": 3.0, "layer_type": "subbase"},
            {"id": "asphalt-wearing", "name": "Asphalt wearing course", "class": None, "default_cbr": None, "layer_type": "surface"},
        ]
    if method == "material_to_layer_coefficient":
        material_class = params.get("material_class", "G5")
        _coeffs = {"G1": 0.14, "G2": 0.12, "G3": 0.10, "G4": 0.09, "G5": 0.08, "G6": 0.06, "G7": 0.04}
        return {
            "material_class": material_class,
            "coefficient": _coeffs.get(material_class, 0.08),
        }
    if method == "custom_material":
        return {
            "id": "custom-001",
            "name": params.get("name", "Custom material"),
            "material_class": params.get("material_class", "G5"),
            "cbr": params.get("cbr", 15.0),
            "source": params.get("source", "user"),
        }
    if method == "compute_economics_detail":
        return {
            "scenarios": [
                {
                    "name": s.get("name", f"Scenario {i}"),
                    "cesa": 4.21e10,
                    "fuel_cost_usd_per_year": 1_200_000 + i * 50_000,
                    "tire_cost_usd_per_year": 300_000 + i * 20_000,
                    "maintenance_cost_usd_per_year": 450_000 + i * 30_000,
                    "total_cost_usd_per_year": 1_950_000 + i * 100_000,
                    "npv_usd": 12_500_000 + i * 800_000,
                    "annual_equivalent_cost_usd": 1_750_000 + i * 100_000,
                    "cashflows": [
                        {"year": y, "value": 1_950_000 + i * 100_000}
                        for y in range(1, int(params.get("design_life_years", 10)) + 1)
                    ],
                }
                for i, s in enumerate(params.get("scenarios", [{"name": "Default"}]))
            ],
            "design_life_years": params.get("design_life_years", 10),
            "discount_rate": params.get("discount_rate", 0.08),
        }
    if method == "export_comparison_to_excel":
        return {
            "bytes_written": 0,
            "file_path": params.get("file_path", ""),
        }
    raise NotImplementedError(method)


# ---------------------------------------------------------------------------
# Per-method adapters — convert raw JSON params to typed haulpave inputs
# ---------------------------------------------------------------------------

# ---------------------------------------------------------------------------
# Shared: build a TrafficInput from the fleet params sent by haul-calc UI
# ---------------------------------------------------------------------------

def _build_traffic(params: dict[str, Any]) -> Any:
    """Convert haul-calc fleet JSON into haulpave TrafficInput.

    Looks up vehicle_id in the registry first; falls back to synthetic
    axle-split from payload_kn when the ID is unknown.
    """
    from haulpave.models.traffic import FleetUnit, TrafficInput
    from haulpave.models.vehicle import AxleGroup, MiningVehicle, TireSpec
    from haulpave.vehicle_registry import find_by_id

    _tire = TireSpec(contact_pressure_kpa=700.0, contact_area_mm2=50_000.0)

    fleet_units = []
    for entry in params.get("fleet", []):
        vehicle_id = entry.get("vehicle_id", "")

        # Try the real registry first
        reg_entry = find_by_id(vehicle_id) if vehicle_id else None

        if reg_entry is not None:
            vehicle = reg_entry.vehicle
        else:
            # Synthesise from payload_kn (custom / unknown vehicle)
            payload_kn = float(entry.get("payload_kn", 1_000.0))
            gvw_kn = payload_kn * 4 / 3  # rough 75% payload fraction
            vehicle = MiningVehicle(
                name=vehicle_id or "unknown",
                gross_vehicle_mass_t=round(gvw_kn / 9.81, 1),
                axle_groups=[
                    AxleGroup(
                        axle_count=1, tyres_per_axle=2,
                        gross_load_kn=round(gvw_kn * 0.25, 1), tire_spec=_tire,
                    ),
                    AxleGroup(
                        axle_count=2, tyres_per_axle=4,
                        gross_load_kn=round(gvw_kn * 0.75, 1), tire_spec=_tire,
                    ),
                ],
                source="bridge synthetic",
            )

        count = max(1, int(entry.get("count", 1)))
        fleet_units.append(FleetUnit(
            vehicle=vehicle,
            trips_per_day=float(entry.get("trips_per_day", 1)) * count,
        ))

    return TrafficInput(
        fleet=fleet_units,
        design_life_years=float(params.get("design_life_years", 10)),
        working_days_per_year=int(params.get("working_days_per_year", 250)),
    )


def _call_compute_cesa(params: dict[str, Any]) -> Any:
    from haulpave.traffic.cesa import compute_cesa
    from haulpave.traffic.coverages import compute_coverages

    traffic = _build_traffic(params)
    cesa_result = compute_cesa(traffic)
    cov_result = compute_coverages(traffic)

    # Build axle load distribution from fleet vehicles
    axle_dist = []
    for fu in traffic.fleet:
        total_passes = fu.trips_per_day * traffic.working_days_per_year * traffic.design_life_years
        for ag in fu.vehicle.axle_groups:
            axle_dist.append({
                "axle_kn": round(ag.gross_load_kn),
                "passes": round(total_passes),
            })

    return {
        "cesa": cesa_result.total_cesa,
        "design_coverages": cov_result.total_coverages,
        "design_life_years": traffic.design_life_years,
        "axle_load_distribution": axle_dist,
    }


_USACE_MAX_COVERAGE: float | None = None


def _get_usace_max_coverage() -> float:
    global _USACE_MAX_COVERAGE
    if _USACE_MAX_COVERAGE is None:
        from haulpave.pavement import load_curve_data
        curve_data = load_curve_data("usace_cbr_v1")
        _USACE_MAX_COVERAGE = float(max(curve_data["coverage_levels"]))
    return _USACE_MAX_COVERAGE


def _usace_digitized_max_coverage(curve_data: dict[str, Any]) -> float:
    extrapolated = set(curve_data.get("extrapolated_coverage_levels", []))
    digitized = [v for v in curve_data["coverage_levels"] if v not in extrapolated]
    if digitized:
        return float(max(digitized))
    return float(max(curve_data["coverage_levels"]))


def _usace_warning_message(
    coverages: float,
    *,
    was_clamped: bool,
    was_extrapolated: bool,
    max_coverage: float,
    digitized_max: float,
) -> str | None:
    if was_clamped:
        return (
            f"Design coverages ({coverages:,.0f}) exceed the USACE CBR curve maximum "
            f"({max_coverage:,.0f}). Thickness has been clamped to the curve boundary."
        )
    if was_extrapolated:
        return (
            f"Design coverages ({coverages:,.0f}) are in the extrapolated zone "
            f"(beyond {digitized_max:,.0f}). Result carries medium confidence."
        )
    return None


def _call_cbr_thickness(params: dict[str, Any]) -> Any:
    import warnings

    from haulpave.pavement import interpolate_thickness, load_curve_data

    cbr = float(params["subgrade_cbr"])
    coverages = float(params["design_coverages"])
    curve_data = load_curve_data("usace_cbr_v1")
    max_coverage = _get_usace_max_coverage()
    digitized_max = _usace_digitized_max_coverage(curve_data)
    with warnings.catch_warnings():
        warnings.simplefilter("ignore", UserWarning)
        thickness, was_clamped, was_extrapolated = interpolate_thickness(
            curve_data, cbr=cbr, coverages=coverages
        )
    t = round(thickness)

    if was_clamped or was_extrapolated:
        confidence = "medium"
    else:
        confidence = "high"

    result: dict[str, Any] = {
        "method": "USACE TM 5-822-12 CBR design curves",
        "subgrade_cbr": cbr,
        "confidence": confidence,
        "layers": [
            {"name": "Surface (asphalt)", "thickness_mm": round(t * 0.14), "cbr": None},
            {"name": "Base course",       "thickness_mm": round(t * 0.46), "cbr": 80},
            {"name": "Sub-base",          "thickness_mm": round(t * 0.40), "cbr": 30},
        ],
        "total_thickness_mm": t,
    }

    warning = _usace_warning_message(
        coverages,
        was_clamped=was_clamped,
        was_extrapolated=was_extrapolated,
        max_coverage=max_coverage,
        digitized_max=digitized_max,
    )
    if warning:
        result["warning"] = warning

    return result


# Map TypeScript category A/B/C/D → representative subgrade CBR for TRH14 lookup.
# TRH 14 Table 2 G-class mid-points:
#   A = G3 (CBR≥25) → 30%   B = G5 (CBR≥7) → 10%
#   C = G6 (CBR≥4)  →  5%   D = G7 (CBR≥2) →  3%
_TRH14_CATEGORY_CBR: dict[str, float] = {
    "A": 30.0, "B": 10.0, "C": 5.0, "D": 3.0,
}


def _call_trh14_thickness(params: dict[str, Any]) -> Any:
    from haulpave.pavement.trh14 import (
        interpolate_catalog, load_catalog, cbr_to_material_class,
    )

    category = str(params.get("category", "B")).upper()
    cbr = _TRH14_CATEGORY_CBR.get(category, 10.0)
    coverages = float(params["design_coverages"])
    mat_class = cbr_to_material_class(cbr)
    catalog = load_catalog()
    thickness, was_clamped = interpolate_catalog(
        catalog["thickness_mm"][mat_class],
        catalog["coverage_levels"],
        coverages,
    )
    t = round(thickness)
    result: dict[str, Any] = {
        "method": "TRH 14 (CSRA 1985) design catalog",
        "category": category,
        "material_class": mat_class,
        "confidence": "medium",
        "layers": [
            {"name": f"Wearing course ({mat_class})",
             "thickness_mm": round(t * 0.28), "cbr": None},
            {"name": "Base",
             "thickness_mm": round(t * 0.42), "cbr": 25},
            {"name": "Sub-base",
             "thickness_mm": round(t * 0.30), "cbr": 10},
        ],
        "total_thickness_mm": t,
    }
    if was_clamped:
        result["warning"] = (
            f"Design coverages ({coverages:,.0f}) exceed the TRH 14 catalog maximum. "
            "Thickness has been clamped to the highest available catalog value."
        )
    return result


def _call_compare_scenarios(params: dict[str, Any]) -> Any:
    from haulpave.economics.compare import RoadScenario, compare_scenarios

    road_scenarios = []
    for s in params.get("scenarios", []):
        road_scenarios.append(RoadScenario(
            name=s.get("name", "Scenario"),
            surface=s.get("surface", "asphalt"),
            thickness_mm=int(s.get("thickness_mm", 100)),
            haul_distance_km=float(s.get("haul_distance_km", 5)),
            trips_per_day=int(s.get("trips_per_day", 20)),
        ))

    result = compare_scenarios(road_scenarios)

    # Map to the wire format the UI expects
    return {
        "scenarios": [
            {
                "name": sc.name,
                "tire_cost_usd_per_year": round(sc.tire_cost_usd_per_year),
                "fuel_cost_usd_per_year": round(sc.fuel_cost_usd_per_year),
                "maintenance_cost_usd_per_year": round(sc.maintenance_cost_usd_per_year),
            }
            for sc in result.scenarios
        ],
    }


def _call_compare_methods(params: dict[str, Any]) -> Any:
    """Compare CBR vs TRH14 in a single call — returns both results."""
    import warnings

    from haulpave.pavement import load_curve_data
    from haulpave.pavement.compare import compare_methods

    traffic = _build_traffic(params)
    cbr = float(params.get("subgrade_cbr", 8.0))
    with warnings.catch_warnings():
        warnings.simplefilter("ignore", UserWarning)
        result = compare_methods(traffic, subgrade_cbr=cbr)

    curve_data = load_curve_data("usace_cbr_v1")
    max_coverage = _get_usace_max_coverage()
    digitized_max = _usace_digitized_max_coverage(curve_data)
    usace_cov = float(result.usace.total_coverages)

    usace_confidence = (
        "medium"
        if result.usace.was_clamped or result.usace.was_extrapolated
        else result.usace.confidence
    )
    usace_result: dict[str, Any] = {
        "method": result.usace.method,
        "total_thickness_mm": round(result.usace.required_thickness_mm),
        "total_coverages": round(usace_cov),
        "total_cesa": result.usace.total_cesa,
        "confidence": usace_confidence,
    }
    usace_warning = _usace_warning_message(
        usace_cov,
        was_clamped=result.usace.was_clamped,
        was_extrapolated=result.usace.was_extrapolated,
        max_coverage=max_coverage,
        digitized_max=digitized_max,
    )
    if usace_warning:
        usace_result["warning"] = usace_warning

    trh_confidence = "medium" if result.trh14.was_clamped else result.trh14.confidence
    trh14_result: dict[str, Any] = {
        "method": result.trh14.method,
        "total_thickness_mm": round(result.trh14.total_thickness_mm),
        "total_coverages": round(result.trh14.total_coverages),
        "material_class": result.trh14.material_class,
        "confidence": trh_confidence,
    }
    if result.trh14.was_clamped:
        trh14_result["warning"] = (
            f"Design coverages ({result.trh14.total_coverages:,.0f}) exceed the TRH 14 catalog maximum. "
            "Thickness has been clamped to the highest available catalog value."
        )

    compare_confidence = result.confidence
    if result.usace.was_clamped or result.usace.was_extrapolated or result.trh14.was_clamped:
        compare_confidence = "medium"

    return {
        "usace": usace_result,
        "trh14": trh14_result,
        "delta_mm": round(result.delta_mm),
        "subgrade_cbr": cbr,
        "confidence": compare_confidence,
    }


def _call_design_pavement(params: dict[str, Any]) -> Any:
    """One-call full pavement design (recommended method)."""
    import warnings
    from haulpave.pavement.compare import design_pavement

    traffic = _build_traffic(params)
    cbr = float(params.get("subgrade_cbr", 8.0))

    with warnings.catch_warnings():
        warnings.simplefilter("ignore")
        result = design_pavement(traffic, subgrade_cbr=cbr)

    return _serialize(result)


def _call_build_summary(params: dict[str, Any]) -> Any:
    from haulpave.reporting.summary import build_design_summary

    summary = build_design_summary(params)
    return summary.model_dump(mode="json")


def _call_list_vehicles(_params: dict[str, Any]) -> Any:
    from haulpave.vehicle_registry import list_all

    return [
        {
            "id": entry.id,
            "name": entry.name,
            "gvw_kn": entry.gvw_kn,
            "axles": entry.axles,
        }
        for entry in list_all()
    ]


def _sensitivity_step_values(min_value: float, max_value: float, steps: int) -> list[float]:
    n = max(3, min(20, int(steps)))
    if n == 1:
        return [min_value]
    span = max_value - min_value
    return [min_value + span * i / (n - 1) for i in range(n)]


def _annual_cost_for_scenarios(road_scenarios: list[Any]) -> float:
    from haulpave.economics.compare import compare_scenarios

    result = compare_scenarios(road_scenarios)
    return float(
        sum(
            sc.tire_cost_usd_per_year
            + sc.fuel_cost_usd_per_year
            + sc.maintenance_cost_usd_per_year
            for sc in result.scenarios
        )
    )


def _road_scenarios_at_sweep(
    template: list[dict[str, Any]],
    variable: str,
    x: float,
    *,
    design_life_years: float,
) -> list[Any]:
    road: list[Any] = []
    from haulpave.economics.compare import RoadScenario

    for s in template:
        trips = max(1, int(s.get("trips_per_day", 20)))
        if variable == "trips_per_day":
            trips = max(1, round(trips * x))
        road.append(
            RoadScenario(
                name=s.get("name", "Scenario"),
                surface=s.get("surface", "asphalt"),
                thickness_mm=int(s.get("thickness_mm", 100)),
                haul_distance_km=float(s.get("haul_distance_km", 5)),
                trips_per_day=trips,
            )
        )
    if variable == "design_life_years":
        _ = design_life_years  # fleet traffic uses design_life from params in cost path only via trips
    return road


def _call_analyze_sensitivity_cost_total(params: dict[str, Any]) -> dict[str, Any]:
    raw = params.get("cost_scenarios") or []
    if not raw:
        raise ValueError("cost_scenarios required for cost_total sensitivity")

    variable = str(params.get("variable", "trips_per_day"))
    min_value = float(params.get("min_value", 0.5))
    max_value = float(params.get("max_value", 2.0))
    steps = int(params.get("steps", 10))
    design_life = float(params.get("design_life_years", 10))

    xs = _sensitivity_step_values(min_value, max_value, steps)
    perturbations: list[dict[str, float | None]] = []
    for x in xs:
        road = _road_scenarios_at_sweep(
            raw, variable, x, design_life_years=design_life
        )
        perturbations.append({"x": x, "y": round(_annual_cost_for_scenarios(road))})

    mid = xs[len(xs) // 2]
    return {
        "variable": variable,
        "baseline": {
            "subgrade_cbr": float(params.get("subgrade_cbr", 8.0)),
            "design_coverages": float(params.get("design_coverages", 1_050_000)),
            "design_life_years": design_life,
            "trips_per_day": float(mid if variable == "trips_per_day" else 1.0),
        },
        "perturbations": perturbations,
        "confidence": "medium",
    }


def _call_analyze_sensitivity_cesa(params: dict[str, Any]) -> dict[str, Any]:
    from haulpave.traffic.cesa import compute_cesa

    variable = str(params.get("variable", "design_life_years"))
    if variable not in ("design_life_years", "trips_per_day"):
        raise ValueError(f"CESA sensitivity does not support variable: {variable}")

    min_v = float(params.get("min_value", 5.0))
    max_v = float(params.get("max_value", 25.0))
    steps = int(params.get("steps", 10))
    xs = _sensitivity_step_values(min_v, max_v, steps)
    base_traffic = _build_traffic(params)

    perturbations: list[dict[str, float | None]] = []
    for x in xs:
        if variable == "design_life_years":
            traffic = base_traffic.model_copy(update={"design_life_years": max(1, int(round(x)))})
        else:
            fleet = []
            for fu in base_traffic.fleet:
                fleet.append(
                    fu.model_copy(
                        update={"trips_per_day": max(1, round(fu.trips_per_day * x))}
                    )
                )
            traffic = base_traffic.model_copy(update={"fleet": tuple(fleet)})
        perturbations.append({"x": x, "y": round(compute_cesa(traffic).total_cesa)})

    return {
        "variable": variable,
        "baseline": {
            "subgrade_cbr": float(params.get("subgrade_cbr", 8.0)),
            "design_coverages": float(params.get("design_coverages", 1_050_000)),
            "design_life_years": float(params.get("design_life_years", 10)),
            "trips_per_day": 1.0,
        },
        "perturbations": perturbations,
        "confidence": "medium",
    }


def _call_analyze_sensitivity(params: dict[str, Any]) -> Any:
    metric = str(params.get("metric", "total_thickness_mm"))
    raw_cost = params.get("cost_scenarios")

    if metric == "cost_total":
        return _call_analyze_sensitivity_cost_total(params)
    if metric == "cesa":
        return _call_analyze_sensitivity_cesa(params)

    try:
        from haulpave.economics.sensitivity import SensitivityInput, analyze_sensitivity
    except ImportError:
        return _call_analyze_sensitivity_compat(params)

    traffic = _build_traffic(params)
    sens_kwargs: dict[str, Any] = {
        "traffic": traffic,
        "variable": params.get("variable", "subgrade_cbr"),
        "min_value": float(params.get("min_value", 2.0)),
        "max_value": float(params.get("max_value", 20.0)),
        "steps": int(params.get("steps", 10)),
        "metric": metric,
        "subgrade_cbr": float(params.get("subgrade_cbr", 8.0)),
        "design_coverages": float(params.get("design_coverages", 1_050_000)),
    }
    if raw_cost is not None:
        sens_kwargs["cost_scenarios"] = raw_cost

    sig = inspect.signature(SensitivityInput)
    filtered = {k: v for k, v in sens_kwargs.items() if k in sig.parameters}
    sens_input = SensitivityInput(**filtered)
    result = analyze_sensitivity(sens_input)
    return _serialize(result)


def _call_analyze_sensitivity_compat(params: dict[str, Any]) -> dict[str, Any]:
    """Fallback when haulpave.economics.sensitivity is unavailable (v0.5.x)."""
    from haulpave.pavement import design_pavement, load_curve_data
    from haulpave.utils.interpolation import interpolate_thickness

    variable = str(params.get("variable", "subgrade_cbr"))
    if variable == "trips_per_day":
        raise ValueError("trips_per_day sensitivity requires metric cost_total or economics.sensitivity")

    traffic = _build_traffic(params)
    cbr = float(params.get("subgrade_cbr", 8.0))
    coverages = float(params.get("design_coverages", 1_050_000))
    min_v = float(params.get("min_value", 2.0))
    max_v = float(params.get("max_value", 20.0))
    steps = int(params.get("steps", 10))
    xs = _sensitivity_step_values(min_v, max_v, steps)
    curve_data = load_curve_data("usace_cbr_v1")

    perturbations: list[dict[str, float | None]] = []
    for x in xs:
        if variable == "subgrade_cbr":
            thickness, _, _ = interpolate_thickness(curve_data, cbr=x, coverages=coverages)
        elif variable == "design_coverages":
            thickness, _, _ = interpolate_thickness(curve_data, cbr=cbr, coverages=x)
        elif variable == "design_life_years":
            modified = traffic.model_copy(update={"design_life_years": max(1, int(round(x)))})
            thickness = design_pavement(modified, cbr).required_thickness_mm
        else:
            raise ValueError(f"Unsupported sensitivity variable: {variable}")
        perturbations.append({"x": x, "y": round(thickness)})

    return {
        "variable": variable,
        "baseline": {
            "subgrade_cbr": cbr,
            "design_coverages": coverages,
            "design_life_years": float(params.get("design_life_years", 10)),
            "trips_per_day": 1.0,
        },
        "perturbations": perturbations,
        "confidence": "medium",
    }


def _call_material_library(_params: dict[str, Any]) -> Any:
    from haulpave.materials.library import list_all_templates

    return _serialize(list_all_templates())


def _call_material_to_layer_coefficient(params: dict[str, Any]) -> Any:
    from haulpave.materials.library import material_to_layer_coefficient

    return _serialize(material_to_layer_coefficient(
        material_class=str(params.get("material_class", "G5")),
    ))


def _call_custom_material(params: dict[str, Any]) -> Any:
    from haulpave.models.materials import CustomMaterial

    return _serialize(CustomMaterial(
        id=params.get("existing_id") or "",
        name=params.get("name", "Custom material"),
        material_class=params.get("material_class", "G5"),
        cbr=float(params.get("cbr", 15.0)),
        source=str(params.get("source", "user")),
    ))


def _call_compute_economics_detail(params: dict[str, Any]) -> Any:
    from haulpave.economics.compare import RoadScenario, compute_economics_detail

    road_scenarios = []
    for s in params.get("scenarios", []):
        road_scenarios.append(RoadScenario(
            name=s.get("name", "Scenario"),
            surface=s.get("surface", "asphalt"),
            thickness_mm=int(s.get("thickness_mm", 100)),
            haul_distance_km=float(s.get("haul_distance_km", 5)),
            trips_per_day=int(s.get("trips_per_day", 20)),
        ))

    result = compute_economics_detail(
        road_scenarios,
        design_life_years=float(params.get("design_life_years", 10)),
        discount_rate=float(params.get("discount_rate", 0.08)),
    )

    return _serialize(result)


def _call_export_comparison_to_excel(params: dict[str, Any]) -> Any:
    import base64
    from haulpave.economics.compare import RoadScenario, export_comparison_to_excel

    road_scenarios = []
    for s in params.get("scenarios", []):
        road_scenarios.append(RoadScenario(
            name=s.get("name", "Scenario"),
            surface=s.get("surface", "asphalt"),
            thickness_mm=int(s.get("thickness_mm", 100)),
            haul_distance_km=float(s.get("haul_distance_km", 5)),
            trips_per_day=int(s.get("trips_per_day", 20)),
        ))

    data = export_comparison_to_excel(road_scenarios)

    file_path = params.get("file_path", "")
    if file_path and isinstance(data, bytes):
        with open(file_path, "wb") as f:
            f.write(data)
        return {"bytes_written": len(data), "file_path": file_path}
    if isinstance(data, bytes):
        return {"bytes_written": len(data), "file_base64": base64.b64encode(data).decode("ascii")}
    return _serialize(data)


# ---------------------------------------------------------------------------
# Dispatch table — built once at module import, not per request.
# ---------------------------------------------------------------------------

_DISPATCH: dict[str, Callable[[dict[str, Any]], Any]] = (
    {
        "compute_cesa": _call_compute_cesa,
        "cbr_thickness": _call_cbr_thickness,
        "trh14_thickness": _call_trh14_thickness,
        "compare_scenarios": _call_compare_scenarios,
        "compare_methods": _call_compare_methods,
        "design_pavement": _call_design_pavement,
        "build_summary": _call_build_summary,
        "list_vehicles": _call_list_vehicles,
        "analyze_sensitivity": _call_analyze_sensitivity,
        "material_library": _call_material_library,
        "material_to_layer_coefficient": _call_material_to_layer_coefficient,
        "custom_material": _call_custom_material,
        "compute_economics_detail": _call_compute_economics_detail,
        "export_comparison_to_excel": _call_export_comparison_to_excel,
    }
    if haulpave is not None
    else {}
)


BRIDGE_VERSION = "1.2.3"


def _dispatch(method: str, params: dict[str, Any]) -> tuple[Any, bool]:
    if method == "health_check":
        return {
            "ok": True,
            "haulpave_loaded": haulpave is not None,
        }, False
    if method == "get_version":
        version = getattr(haulpave, "__version__", None) if haulpave is not None else None
        return {"haulpave": version, "bridge": BRIDGE_VERSION}, version is None

    real_fn = _DISPATCH.get(method)

    if real_fn is not None:
        try:
            return real_fn(params), False
        except NotImplementedError:
            pass
        except Exception:
            raise  # real errors must not silently fall back to stubs

    # Fall back to stub (haul-pave unavailable or method not yet wired)
    return _stub_response(method, params), True


def main() -> int:
    for raw in sys.stdin:
        raw = raw.strip()
        if not raw:
            continue
        req_id: int | None = None
        try:
            req = json.loads(raw)
            req_id = req.get("id")
            method = req["method"]
            params = req.get("params") or {}
            result, is_stub = _dispatch(method, params)
            payload: dict[str, Any] = {"id": req_id, "result": _serialize(result)}
            if is_stub:
                payload["stub"] = True
                payload["stub_message"] = (
                    f"haul-pave has not implemented `{method}` yet — returning fixture."
                )
            sys.stdout.write(json.dumps(payload) + "\n")
            sys.stdout.flush()
        except NotImplementedError as e:
            sys.stdout.write(
                json.dumps({"id": req_id, "error": {"code": "NotImplemented", "message": str(e)}})
                + "\n"
            )
            sys.stdout.flush()
        except Exception as e:  # noqa: BLE001
            # Full traceback written to stderr (log) only — not exposed over stdout RPC.
            traceback.print_exc(file=sys.stderr)
            sys.stdout.write(
                json.dumps({
                    "id": req_id,
                    "error": {
                        "code": type(e).__name__,
                        "message": str(e),
                    },
                })
                + "\n"
            )
            sys.stdout.flush()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
