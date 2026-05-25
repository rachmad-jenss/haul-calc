## Summary

- Persist latest sensitivity run as `sensitivitySnapshot` in store and project file snapshot v4.
- Add optional Sensitivity section and chart image toggles on Reports; embed table and JPEG chart in PDF.
- Append `sensitivity_analysis` block to JSON export when toggled; capture off-screen line chart via `PdfReportChartHost`.

Closes #290

## Test plan

- [x] `pnpm typecheck` and `pnpm lint` pass
- [x] Reports sensitivity toggles enabled/disabled with snapshot (`31-pdf-sensitivity-section` smoke)
- [x] Snapshot v4 round-trip and v2 clears sensitivity (`31-pdf-sensitivity-section` smoke)
- [x] Run sensitivity analysis then Reports badge active (`31-pdf-sensitivity-section` E2E)
- [x] Export JSON with sensitivity on/off (`31-pdf-sensitivity-section` E2E)
- [x] Export PDF with sensitivity enabled (`31-pdf-sensitivity-section` E2E)
- [x] PDF export with sensitivity enabled shows success toast (`31-pdf-sensitivity-section` E2E)
- [x] Load v4 snapshot restores sensitivity toggles (`31-pdf-sensitivity-section` E2E)
