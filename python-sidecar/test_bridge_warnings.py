"""Unit tests for compare_methods warning capture (DAS-137)."""

from __future__ import annotations

import warnings

from bridge import _capture_user_warnings


def test_capture_user_warnings_returns_messages() -> None:
    def _warn() -> str:
        warnings.warn("test warning from library", UserWarning)
        return "ok"

    result, messages = _capture_user_warnings(_warn)
    assert result == "ok"
    assert messages == ["test warning from library"]
