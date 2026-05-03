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

# haul-pave is currently Phase 0 — most modules are scaffolds. We import what we
# can and fall back to stubs for the rest. Wrapping in try/except keeps the
# sidecar usable even if a sub-module is missing.
try:
    import haulpave  # type: ignore[import-not-found]
except Exception:  # pragma: no cover - early dev only
    haulpave = None  # type: ignore[assignment]


def _serialize(obj: Any) -> Any:
    """Coerce pydantic models / dataclasses into JSON-friendly structures."""
    if obj is None or isinstance(obj, (bool, int, float, str)):
        return obj
    if hasattr(obj, "model_dump"):
        return obj.model_dump(mode="json")
    if hasattr(obj, "_asdict"):
        return obj._asdict()
    if isinstance(obj, dict):
        return {k: _serialize(v) for k, v in obj.items()}
    if isinstance(obj, (list, tuple)):
        return [_serialize(v) for v in obj]
    return str(obj)


def _stub_response(method: str, params: dict[str, Any]) -> Any:
    """Return a plausible fixture for a not-yet-implemented haul-pave method."""
    if method == "compute_cesa":
        return {
            "cesa": 4.21e7,
            "design_coverages": 1.05e6,
            "design_life_years": params.get("design_life_years", 10),
            "axle_load_distribution": [
                {"axle_kn": 80, "passes": 8.4e5},
                {"axle_kn": 130, "passes": 2.1e5},
            ],
        }
    if method == "cbr_thickness":
        return {
            "method": "USACE CBR",
            "subgrade_cbr": params.get("subgrade_cbr", 8),
            "layers": [
                {"name": "Surface (asphalt)", "thickness_mm": 100, "cbr": None},
                {"name": "Base course", "thickness_mm": 250, "cbr": 80},
                {"name": "Sub-base", "thickness_mm": 350, "cbr": 30},
            ],
            "total_thickness_mm": 700,
        }
    if method == "trh14_thickness":
        return {
            "method": "TRH 14",
            "category": params.get("category", "B"),
            "layers": [
                {"name": "Surface (G1)", "thickness_mm": 50, "cbr": None},
                {"name": "Base (G2)", "thickness_mm": 200, "cbr": 80},
                {"name": "Sub-base (G5)", "thickness_mm": 300, "cbr": 25},
            ],
            "total_thickness_mm": 550,
        }
    if method == "compare_scenarios":
        scenarios = params.get("scenarios", [])
        return {
            "scenarios": [
                {
                    "name": s.get("name", f"Scenario {i + 1}"),
                    "tire_cost_usd_per_year": 250_000 + i * 35_000,
                    "fuel_cost_usd_per_year": 1_200_000 - i * 80_000,
                    "maintenance_cost_usd_per_year": 480_000 + i * 12_000,
                }
                for i, s in enumerate(scenarios)
            ],
        }
    if method == "build_summary":
        return {
            "title": "Haul Road Pavement Design Summary",
            "generated_at": "1970-01-01T00:00:00Z",
            "inputs": params,
            "results": {
                "cesa": 4.21e7,
                "recommended_thickness_mm": 700,
            },
        }
    if method == "list_vehicles":
        return [
            {"id": "cat-797f", "name": "Caterpillar 797F", "gvw_kn": 6_230, "axles": 2},
            {"id": "cat-789d", "name": "Caterpillar 789D", "gvw_kn": 3_240, "axles": 2},
            {"id": "kom-960e", "name": "Komatsu 960E", "gvw_kn": 5_950, "axles": 2},
        ]
    raise NotImplementedError(method)


def _real_or_stub(
    real: Callable[..., Any] | None,
    method: str,
    params: dict[str, Any],
) -> tuple[Any, bool]:
    """Try to call the real haul-pave function; fall back to stub fixture."""
    if real is not None:
        try:
            return real(**params), False
        except NotImplementedError:
            pass
    return _stub_response(method, params), True


def _resolve(path: str) -> Callable[..., Any] | None:
    if haulpave is None:
        return None
    obj: Any = haulpave
    for part in path.split("."):
        obj = getattr(obj, part, None)
        if obj is None:
            return None
    return obj if callable(obj) else None


# Map JSON-RPC method name -> dotted path on the haulpave package.
METHOD_TABLE: dict[str, str] = {
    "compute_cesa": "traffic.compute_cesa",
    "cbr_thickness": "pavement.cbr_thickness_usace",
    "trh14_thickness": "pavement.trh14_thickness",
    "compare_scenarios": "economics.compare_scenarios",
    "build_summary": "reporting.build_design_summary",
    "list_vehicles": "vehicle_registry.list_all",
}


def _dispatch(method: str, params: dict[str, Any]) -> tuple[Any, bool]:
    if method == "health_check":
        return {
            "ok": True,
            "haulpave_loaded": haulpave is not None,
        }, False
    if method == "get_version":
        version = getattr(haulpave, "__version__", None) if haulpave is not None else None
        return {"haulpave": version, "bridge": "0.1.0"}, version is None
    real_path = METHOD_TABLE.get(method)
    real = _resolve(real_path) if real_path else None
    return _real_or_stub(real, method, params)


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
                json.dumps(
                    {
                        "id": req_id,
                        "error": {
                            "code": "NotImplemented",
                            "message": str(e),
                        },
                    }
                )
                + "\n"
            )
            sys.stdout.flush()
        except Exception as e:  # noqa: BLE001
            sys.stdout.write(
                json.dumps(
                    {
                        "id": req_id,
                        "error": {
                            "code": type(e).__name__,
                            "message": str(e),
                            "trace": traceback.format_exc(),
                        },
                    }
                )
                + "\n"
            )
            sys.stdout.flush()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
