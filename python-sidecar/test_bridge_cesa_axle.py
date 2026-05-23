"""Unit tests for CESA axle load distribution (DAS-142)."""

from __future__ import annotations

from bridge import _axle_load_distribution, _build_traffic


def test_axle_load_distribution_scales_passes_by_wheel_positions() -> None:
    params = {
        "fleet": [
            {"vehicle_id": "cat-797f", "count": 1, "trips_per_day": 10, "payload_kn": 4000},
        ],
        "design_life_years": 1,
        "working_days_per_year": 10,
    }
    traffic = _build_traffic(params)
    dist = _axle_load_distribution(traffic)
    assert len(dist) >= 2
    passes = [row["passes"] for row in dist]
    assert len(set(passes)) > 1, "wheel positions should yield different pass counts per group"
    assert all(p > 0 for p in passes)
