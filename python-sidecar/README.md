# Python sidecar

Tiny JSON-RPC bridge that wraps the [haul-pave](https://github.com/rachmad-jenss/haul-pave)
library and exposes it to the Tauri host over stdin/stdout.

## Build

```powershell
pwsh build.ps1
```

Produces `../src-tauri/binaries/haulpave-bridge-<triple>.exe`, which Tauri
picks up via `bundle.externalBin` in `src-tauri/tauri.conf.json`.

## Run standalone (debug)

```powershell
. .venv/Scripts/Activate.ps1
python bridge.py
# then type a request followed by Enter, e.g.:
{"id": 1, "method": "get_version", "params": {}}
```

## Stub vs real

`haul-pave` is currently Phase 0 — many functions aren't shipped yet. The
bridge transparently falls back to fixture data flagged with `stub: true` so
the UI keeps rendering during development. As haul-pave Phases 1–3 land, the
real call paths in `METHOD_TABLE` will start returning real numbers.
