# HaulCalc

Desktop GUI (Windows) for **mining haul road pavement calculations**, powered by the
[haul-pave](https://github.com/rachmad-jenss/haul-pave) Python library.

[![CI](https://github.com/rachmad-jenss/haul-calc/actions/workflows/ci.yml/badge.svg)](https://github.com/rachmad-jenss/haul-calc/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

## Download

Grab the latest installer from the [Releases](https://github.com/rachmad-jenss/haul-calc/releases/latest) page (`Haul.Calc_*_x64-setup.exe`).

The app auto-updates — once installed, use **Settings → Updates → Check for Updates** to get new versions.

Updates run the NSIS installer **in place** over your existing install (not uninstall-then-reinstall). See [docs/updater.md](docs/updater.md) for the full flow, Add/Remove Programs behavior, and sidecar handling during upgrades.

## Stack

- **Tauri 2** — native desktop shell (Rust)
- **React 18 + TypeScript + Vite** — UI
- **Tailwind CSS** + shadcn-style primitives — styling
- **Recharts** — pavement layer & cost charts
- **Python sidecar** (PyInstaller single-file exe) — wraps `haulpave` and speaks JSON-RPC over stdin/stdout

## What it covers

- Fleet definition from built-in OEM vehicle registry (CAT 797F, 789D, 785D; KOM 960E) → CESA + design coverages
- Fleet CSV import/export for round-trip data sharing
- One-click sample fleet loader for quick starts
- USACE CBR pavement thickness (SI or Imperial units)
- TRH 14 pavement thickness
- Multi-scenario operating-cost comparison (tires, fuel, maintenance) using rolling-resistance model
- Life-Cycle Cost Analysis (LCCA) with NPV and AEC computation
- Multi-project comparison for side-by-side benchmarking
- Sensitivity analysis with what-if parameter sweeps and data table view
- Material Bill of Quantities (BoQ) in Reports (CSV/PDF) using layer names and bulk density from haul-pave material types
- Material catalog on Pavement Design (TRH 14 / USACE templates) with search; add project-specific custom materials and use them in thickness compute and method comparison
- Custom materials persist in `.hcalc` project files (snapshot v3+)
- Keyboard shortcuts: Ctrl+N (new), Ctrl+O (open), Ctrl+S (save), Ctrl+Z/Y (undo/redo)
- Fleet row ordering with up/down reorder buttons
- Excel export for economics comparison
- Save/load projects as `.hcalc` files — double-click to open directly
- Versioned design summary export (JSON)

**Out of scope (v1):** geometric design (gradient, super-elevation, sight distance, curves), full haul-cycle / productivity simulation.

## Prerequisites

- Windows 10/11
- Node.js 20+ and pnpm 9+
- Rust stable (via `rustup`)
- Python 3.10+
- [haul-pave](https://github.com/rachmad-jenss/haul-pave) **0.5.0+** (material library API, custom materials, layer `material_type` for BoQ density)
- WebView2 runtime (preinstalled on Windows 11; bootstrapped by the installer on older systems)

## Development setup

```powershell
# Install JS and Python dependencies
pnpm install
pip install "haulpave>=0.5.0"  # or: cd python-sidecar && pip install -r requirements.txt

# Build the Python sidecar exe (run once per haul-pave version bump)
pwsh python-sidecar/build.ps1

# Start dev server + Tauri window
pnpm tauri dev
```

## Build a release installer

```powershell
pwsh python-sidecar/build.ps1
pnpm install
pnpm tauri build
```

Output lands in `src-tauri/target/release/bundle/nsis/Haul Calc_*_x64-setup.exe`.

## Running tests

```powershell
pnpm test:e2e   # Playwright E2E smoke tests (requires running Tauri dev window)
```

## Project layout

```
haul-calc/
├── src-tauri/              Rust host (Tauri shell + sidecar bridge)
│   ├── src/bridge.rs         JSON-RPC client over sidecar stdio
│   └── src/commands.rs       #[tauri::command] handlers
├── src/                    React frontend
│   ├── lib/haulpave-client.ts  typed wrapper around invoke()
│   ├── lib/types.ts            DTO mirrors of haul-pave Pydantic models
│   └── routes/                 one page per feature
├── python-sidecar/
│   ├── bridge.py             JSON-RPC stdio bridge wrapping haulpave
│   ├── requirements.txt
│   └── build.ps1             PyInstaller build script
└── tests/smoke/              Playwright E2E smoke tests
```

## How the bridge works

```
React (invoke)
   │  haul_pave_call({ method, params })
   ▼
Tauri command (Rust)
   │  newline-delimited JSON-RPC
   ▼
haulpave-bridge.exe (Python sidecar)
   │  dispatches to haulpave.{traffic, pavement, economics, reporting, vehicle_registry}
   ▼
haulpave package (Pydantic results)
```

Responses come back in three shapes:

| Shape | Meaning |
|-------|---------|
| `{ result }` | Real haul-pave result |
| `{ result, stub: true, stub_message }` | Fixture (haul-pave method not yet wired) |
| `{ error }` | Real failure |

The UI renders a yellow `<StubBanner>` whenever a response is flagged as a stub.

## License

MIT — Copyright (c) 2026 Rahmad J E. N. S. S.
