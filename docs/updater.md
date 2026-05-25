# HaulCalc auto-updater (Windows / NSIS)

HaulCalc ships as an NSIS installer (`Haul.Calc_*_x64-setup.exe`) and uses Tauri’s built-in updater (`tauri-plugin-updater`) on Windows. Updates are **in-place upgrades**: the new installer runs over the existing install directory. They are **not** a separate uninstall followed by a fresh install.

## In-app update flow

1. **Check** — The app calls `check()` against `latest.json` on GitHub Releases (see `src-tauri/tauri.conf.json` → `plugins.updater.endpoints`). Users can trigger this from **Settings → Updates → Check for Updates**, or on startup when **auto-check updates** is enabled (`src/hooks/useAutoUpdate.tsx`).
2. **Download** — When the user chooses **Update now**, Tauri downloads the signed `.nsis.zip` updater artifact for the new version.
3. **Install** — `downloadAndInstall()` runs the NSIS installer silently against the **same** install path as the current app (overwrite / upgrade mode).
4. **Relaunch** — After install completes, the app calls `relaunch()` so the new binary starts.

Fresh installs from the Releases page use the same NSIS bundle; behavior is the same installer, only the entry point differs (browser download vs in-app updater).

## In-place upgrade (not uninstall-then-install)

- The updater does **not** remove the old version first via Windows “Uninstall”.
- NSIS copies new files into the existing installation folder (typically under `%LOCALAPPDATA%\Programs` or the path chosen at first install).
- Version metadata in Add/Remove Programs is updated in place; you should see **one** **HaulCalc** entry, not two side-by-side versions.
- User data (e.g. `.hcalc` project files) lives outside the install directory and is unaffected by upgrades.

To **fully remove** the app, the user must use **Windows Settings → Apps → Installed apps** (or **Add or remove programs**) and uninstall HaulCalc manually. That path runs `NSIS_HOOK_PREUNINSTALL` (see below) and removes program files; it is separate from in-app updates.

## Sidecar kill before file copy (DAS-118)

`src-tauri/windows/hooks.nsh` is wired via `bundle.windows.nsis.installerHooks` in `tauri.conf.json`.

| Hook | When it runs |
|------|----------------|
| `NSIS_HOOK_PREINSTALL` | Before NSIS copies/overwrites files — **both** first install **and** in-place upgrade |
| `NSIS_HOOK_PREUNINSTALL` | Only when the user uninstalls from Windows Settings |

`PREINSTALL` stops `haulpave-bridge.exe` with `taskkill` so `haulpave-bridge.exe` is not locked while the installer overwrites the sidecar binary. Without this, upgrades can fail with “file in use” errors while the app or sidecar is still running.

## Maintainer notes

- Release CI must publish `latest.json`, the NSIS setup `.exe`, and signed updater `.nsis.zip` artifacts (see `AGENTS.md` → Release & Version Bump).
- `createUpdaterArtifacts: true` in `tauri.conf.json` enables updater bundles at build time.
- Regression check: install vN, upgrade to vN+1 via in-app updater; confirm a single ARP entry and no `haulpave-bridge.exe` file-lock errors.

## Related files

- `src-tauri/tauri.conf.json` — updater endpoints, NSIS hooks path
- `src-tauri/windows/hooks.nsh` — preinstall / preuninstall sidecar kill
- `src/hooks/useAutoUpdate.tsx` — check, download, install, relaunch UX
