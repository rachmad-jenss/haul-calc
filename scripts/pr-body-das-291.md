## Summary

- Sync Compare tab workspace to in-memory `compareSnapshot` (session store, not saved in `.hcalc`) when 2–4 files are loaded.
- Add optional **Compare Projects** section toggle on Reports; embed side-by-side metric tables in PDF.
- Append structured `compare_projects` block to JSON export when toggled on.

Closes #291

## Test plan

- [x] `pnpm typecheck` and `pnpm lint` pass
- [x] Compare snapshot null with &lt;2 projects; tables format IDR (`32-pdf-compare-section`)
- [x] Reports toggle enabled/disabled with compare snapshot
- [x] JSON export with compare on/off
- [x] PDF export with compare snapshot (E2E toast)
