# Haul Calc

Desktop GUI (Windows) for **mining haul road pavement calculations**, built on
top of the [haul-pave](https://github.com/rachmad-jenss/haul-pave) Python
library.

## Stack

- **Tauri 2** — native desktop shell (Rust)
- **React 18 + TypeScript + Vite** — UI
- **Tailwind CSS** + shadcn-style primitives — styling
- **Recharts** — pavement layer & cost charts
- **Python sidecar** (PyInstaller single-file exe) — wraps `haulpave` and
  speaks JSON-RPC over stdin/stdout

## What it covers (v1)

- Fleet definition → CESA + design coverages
- USACE CBR pavement thickness
- TRH 14 pavement thickness
- Operating-cost comparison across pavement scenarios (tires, fuel,
  maintenance)
- Versioned design summary export (JSON)

`haul-pave` is currently Phase 0; calculations not yet shipped upstream are
returned as **clearly-flagged stub fixtures** so the UI is fully usable
during development.

**Out of scope for v1:** geometric design (gradient, super-elevation, sight
distance, curves), full haul-cycle / productivity simulation.

## Prerequisites

- Windows 10/11
- Node.js 20+ and pnpm 9+
- Rust stable (via `rustup`)
- Python 3.10+
- WebView2 runtime (preinstalled on Windows 11; bootstrapped by the installer
  on older systems)

## First-time setup

```powershell
# 1. Generate platform icons from the base SVG (one-time)
pnpm install
pnpm tauri icon src-tauri/icons/base.svg

# 2. Build the Python sidecar exe (one-time per haul-pave version bump)
pwsh python-sidecar/build.ps1
```

## Develop

```powershell
pnpm tauri:dev
```

## Build a release installer

```powershell
pwsh python-sidecar/build.ps1
pnpm install
pnpm tauri:build
```

Outputs land in `src-tauri/target/release/bundle/`:
- `msi/Haul Calc_*.msi`
- `nsis/Haul Calc_*-setup.exe`

## Project layout

```
haul-calc/
├── src-tauri/          Rust host (Tauri shell + sidecar bridge)
│   ├── src/main.rs        entrypoint
│   ├── src/lib.rs         app builder, plugins, state wiring
│   ├── src/bridge.rs      JSON-RPC client over sidecar stdio
│   └── src/commands.rs    #[tauri::command] handlers
├── src/                React frontend
│   ├── lib/haulpave-client.ts   typed wrapper around invoke()
│   ├── lib/types.ts             DTO mirror of haul-pave pydantic models
│   └── routes/                  one page per feature
├── python-sidecar/     Python bridge + PyInstaller config
│   ├── bridge.py
│   ├── requirements.txt
│   └── build.ps1
└── .github/workflows/ci.yml
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
   │  dispatches to haulpave.{traffic, pavement, economics, ...}
   ▼
haulpave package (pydantic results)
```

Responses come back in three flavours:

| Shape | Meaning |
|---|---|
| `{ data, stub: false }` | Real haul-pave result |
| `{ data, stub: true, stub_message }` | Fixture (haul-pave hasn't shipped this yet) |
| `throw CallError` | Real failure |

The UI renders a yellow `<StubBanner>` whenever a response is flagged as a
stub.

## License

MIT
