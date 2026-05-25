# Changelog

All notable changes to HaulCalc will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- [docs/updater.md](docs/updater.md) — documents NSIS in-place upgrade behavior for the Tauri auto-updater (not uninstall-then-install)

## [1.2.0] - 2026-05-21

### Added
- Fleet CSV export — export current fleet table to CSV file
- Fleet validation — empty fleet and zero trips pre-checks before CESA computation
- Keyboard shortcuts — Ctrl+N for new project, Escape to close modals
- Pavement CrossSection now supports Imperial units (inches)
- CESA auto-import — coverages field auto-updated when CESA computed
- Sample fleet loader — one-click load sample_fleet.json
- Keyboard shortcuts reference card in Settings
- Sensitivity analysis step count clamping now shows toast notification
- Chart data table view — toggle Show Data/Hide Data in Economics and Sensitivity
- Fleet row reorder — ▲/▼ buttons to reorder fleet entries

### Changed
- Bumped haul-pave dependency from v0.3.0 to v0.4.1
- Pavement compare methods now correctly passes working_days_per_year
- Store migration v8: trips_per_day clamped to min 1 for backward compatibility
- All confidence enum values mapped for consistent badge display

### Fixed
- Imperial unit false positive warning on fleet payload validation
- Fleet input clamping — negative values rejected
- Stale closure in handleNewProject — now reads fresh state from store

## [1.1.0] - 2026-05-19

### Added
- Auto-updater (tauri-plugin-updater) — Check for Updates in Settings with signed release artifacts
- `.hcalc` file association — double-click a project file to open it directly in HaulCalc
- Dynamic version display in sidebar from `package.json`
- NSIS installer branding — custom icon, license page, Start Menu folder

### Changed
- Version bumped to 1.0.0 (first production release)
- NSIS-only bundle (MSI/WiX removed)
- Tag-triggered GitHub Release workflow with automated signing and `latest.json` upload

## [0.1.0] - 2026-05-14

### Added

**Core Calculation Engine**
- Initial scaffold: Tauri 2 + React + Python sidecar wrapping haul-pave library
- Full haul-pave 0.3.0 integration — all adapter functions wired, zero stubs remaining
- Shared calculation state across all routes via Zustand store
- Zod validation on all calculation input forms

**Fleet & Traffic**
- Fleet & Traffic input form with vehicle selection, payload, and trip configuration
- Custom Vehicle Editor for defining non-standard truck/equipment specs
- CSV fleet import modal for bulk vehicle data entry
- `working_days_per_year` field exposed in Fleet & Traffic inputs

**Pavement Design**
- Pavement design calculation with CESA-based structural design
- Compare Methods tab in Pavement Design for side-by-side structural comparison
- SVG pavement cross-section diagram replacing bar chart for visual layer representation
- Inline domain validation warnings for payload, trip count, CBR, and coverages

**Economics & Analysis**
- Economics route with operating cost breakdown and cost-per-tonne metrics
- Sensitivity analysis page with what-if line chart for parameter sweeps
- Sensitivity analysis trips/day sweep with multi-metric output
- LCCA (Life-Cycle Cost Analysis) tab in Economics with NPV and AEC computation, charts

**Reports & Export**
- PDF report export with full project summary
- Material Bill of Quantities (BoQ) section in Reports with PDF export
- Export PNG button for Economics and Sensitivity charts
- Multi-project comparison page for side-by-side project benchmarking

**Project Management**
- Save/load project file via `.hcalc` JSON format with native file dialogs
- Recent files list on Dashboard for quick project access
- Ctrl+S / Ctrl+O keyboard shortcuts for save and open operations
- File system scope expanded to allow read/write to user-chosen dialog paths

**UI & User Experience**
- Dashboard overview route as application home screen
- Dark mode toggle with light/dark/system preference support
- SI/Imperial unit system toggle for international use
- Native title bar synced with application theme
- Dirty state indicators on CESA, pavement, and economics tabs to flag unsaved changes
- Undo/redo support via zundo (Ctrl+Z / Ctrl+Y / Ctrl+Shift+Z)
- Per-route ErrorBoundary wrapping each route for isolated error handling
- Sidecar status tracking and manual restart capability
- Persist store and input guards via shared components

### Fixed

- Bridge.py stub physics errors corrected and real haul-pave methods wired
- Frontend data integrity issues resolved
- Native title bar now correctly syncs with app theme changes
- `type=button` and `aria-label` added to ThemeToggle for accessibility

[Unreleased]: https://github.com/rachmad-jenss/haul-calc/compare/v1.2.0...HEAD
[1.2.0]: https://github.com/rachmad-jenss/haul-calc/compare/v1.1.0...v1.2.0
[1.1.0]: https://github.com/rachmad-jenss/haul-calc/compare/v1.0.0...v1.1.0
[1.0.0]: https://github.com/rachmad-jenss/haul-calc/compare/v0.1.0...v1.0.0
[0.1.0]: https://github.com/rachmad-jenss/haul-calc/releases/tag/v0.1.0
