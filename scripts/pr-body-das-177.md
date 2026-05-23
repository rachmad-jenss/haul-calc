## Summary

Fixes the Windows bug where clicking the window **X** did nothing (no dialog, no dirty `*`, app stayed open).

- **Root cause:** the frontend `onCloseRequested` listener blocks WM_CLOSE on Windows in this app; missing window capabilities also caused `set_title`, `set_theme`, and `destroy` calls to reject.
- **Close behavior:** register `onCloseRequested` only while dirty — clean project closes immediately; dirty project shows the same unsaved confirm as New/Open; 5s fail-open if the dialog never appears.
- **Capabilities:** allow `set-title`, `set-theme`, and `destroy` so window APIs no longer throw permission errors.
- **Store:** stop persisting `isProjectDirty`; reset on rehydrate; defer dirty tracking until persist hydration finishes (persist v9).
- **Rust:** kill sidecar on `WindowEvent::Destroyed`; explicit window label `main`.

Closes #177

## Test plan

- [x] `pnpm lint` and `pnpm exec tsc --noEmit`
- [x] `pnpm build` + 3× `CloseMainWindow()` on debug exe — process exits (clean project)
- [x] `pnpm exec playwright test tests/smoke/01-sidebar.test.ts tests/smoke/08-save-binding.test.ts`
- [x] Vite running first (`http://localhost:1420` returns 200), then debug exe `CloseMainWindow()` exits in 0.24s
- [x] Console no longer reports `window.set_title`, `window.set_theme`, or `window.destroy` permission errors after capability update
- [x] Dirty project: X shows Unsaved Changes dialog; No keeps window, Yes exits (bounded Win32 dialog-button test)
