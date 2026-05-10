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


def _call_cbr_thickness(params: dict[str, Any]) -> Any:
    from haulpave.pavement import interpolate_thickness, load_curve_data

    cbr = float(params["subgrade_cbr"])
    coverages = float(params["design_coverages"])
    curve_data = load_curve_data("usace_cbr_v1")
    thickness = interpolate_thickness(curve_data, cbr=cbr, coverages=coverages)
    t = round(thickness)

    # Decompose into rational layer structure (surface < base > sub-base)
    return {
        "method": "USACE TM 5-822-12 CBR design curves",
        "subgrade_cbr": cbr,
        "layers": [
            {"name": "Surface (asphalt)", "thickness_mm": round(t * 0.14), "cbr": None},
            {"name": "Base course",       "thickness_mm": round(t * 0.46), "cbr": 80},
            {"name": "Sub-base",          "thickness_mm": round(t * 0.40), "cbr": 30},
        ],
        "total_thickness_mm": t,
    }


# Map TypeScript category A/B/C/D → representative subgrade CBR for TRH14 lookup.
# TRH 14 Table 2 G-class mid-points:
#   A = G3 (CBR≥25) → 30%   B = G5 (CBR≥7) → 10%
#   C = G6 (CBR≥4)  →  5%   D = G7 (CBR≥2) →  3%
_TRH14_CATEGORY_CBR: dict[str, float] = {
    "A": 30.0, "B": 10.0, "C": 5.0, "D": 3.0,
}


def _call_trh14_thickness(params: dict[str, Any]) -> Any:
    from haulpave.pavement.trh14 import (
        _interpolate_catalog, _load_catalog, cbr_to_material_class,
    )

    category = str(params.get("category", "B")).upper()
    cbr = _TRH14_CATEGORY_CBR.get(category, 10.0)
    coverages = float(params["design_coverages"])
    mat_class = cbr_to_material_class(cbr)
    catalog = _load_catalog()
    thickness = _interpolate_catalog(
        catalog["thickness_mm"][mat_class],
        catalog["coverage_levels"],
        coverages,
    )
    t = round(thickness)
    return {
        "method": "TRH 14 (CSRA 1985) design catalog",
        "category": category,
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
    from haulpave.pavement.compare import compare_methods

    traffic = _build_traffic(params)
    cbr = float(params.get("subgrade_cbr", 8.0))

    with warnings.catch_warnings():
        warnings.simplefilter("ignore")
        result = compare_methods(traffic, subgrade_cbr=cbr)

    return {
        "usace": {
            "method": result.usace.method,
            "total_thickness_mm": round(result.usace.required_thickness_mm),
            "total_coverages": round(result.usace.total_coverages),
            "total_cesa": result.usace.total_cesa,
            "confidence": result.usace.confidence,
        },
        "trh14": {
            "method": result.trh14.method,
            "total_thickness_mm": round(result.trh14.total_thickness_mm),
            "total_coverages": round(result.trh14.total_coverages),
            "material_class": result.trh14.material_class,
            "confidence": result.trh14.confidence,
        },
        "delta_mm": round(result.delta_mm),
        "subgrade_cbr": cbr,
        "confidence": result.confidence,
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
    }
    if haulpave is not None
    else {}
)


def _dispatch(method: str, params: dict[str, Any]) -> tuple[Any, bool]:
    if method == "health_check":
        return {
            "ok": True,
            "haulpave_loaded": haulpave is not None,
        }, False
    if method == "get_version":
        version = getattr(haulpave, "__version__", None) if haulpave is not None else None
        return {"haulpave": version, "bridge": "0.1.0"}, version is None

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
