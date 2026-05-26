## HaulCalc v1.7.1

Patch release: correct Windows taskbar/installer icon embed and opaque Select dropdown menus.

### Bug Fixes

- **Windows app icon** -- Release builds now regenerate bundle icons and run `cargo clean` before packaging so the installer embeds the HC-VI logo (dark tile + haul-road mark), not the legacy blue/yellow artwork still seen on some v1.7.0 installs.
- **Select dropdown** -- Define `--popover` tokens so Fleet and other Radix Select menus render with a solid background instead of appearing transparent.

**Full Changelog:** https://github.com/rachmad-jenss/haul-calc/compare/v1.7.0...v1.7.1
