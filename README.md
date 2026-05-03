# HaulCalc

Desktop GUI (Windows) for **mining haul road pavement calculations**, powered by the
[haul-pave](https://github.com/rachmad-jenss/haul-pave) Python library.

[![CI](https://github.com/rachmad-jenss/haul-calc/actions/workflows/ci.yml/badge.svg)](https://github.com/rachmad-jenss/haul-calc/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

## Stack

- **Tauri 2** — native desktop shell (Rust)
- **React 18 + TypeScript + Vite** — UI
- **Tailwind CSS** + shadcn-style primitives — styling
- **Recharts** — pavement layer & cost charts
- **Python sidecar** (PyInstaller single-file exe) — wraps `haulpave` and speaks JSON-RPC over stdin/stdout

## What it covers

- Fleet definition from built-in OEM vehicle registry (CAT 797F, 789D, 785D; KOM 960E) → CESA + design coverages
- USACE CBR pavement thickness
- TRH 14 pavement thickness
- Multi-scenario operating-cost comparison (tires, fuel, maintenance) using rolling-resistance model
- Versioned design summary export (JSON)

**Out of scope:** geometric design (gradient, super-elevation, sight distance, curves), full haul-cycle / productivity simulation.

## Prerequisites

- Windows 10/11
- Node.js 20+ and pnpm 9+
- Rust stable (via `rustup`)
- Python 3.10+
- WebView2 runtime (preinstalled on Windows 11; bootstrapped by the installer on older systems)

## Development setup

```powershell
# Install JS and Python dependencies
pnpm install
pip install haulpave  # or: cd python-sidecar && pip install -r requirements.txt

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

Outputs land in `src-tauri/target/release/bundle/`:
- `msi/HaulCalc_*.msi`
- `nsis/HaulCalc_*-setup.exe`

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
└── tests/smoke/              Playwright E2E smoke tests (6 suites)
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

MIT
