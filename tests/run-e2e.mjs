/**
 * E2E smoke test runner — Playwright vs Vite dev server.
 *
 * global-setup.ts starts Vite on :1420 (or reuses an already-running instance).
 * global-teardown.ts kills it when tests finish.
 *
 * Usage: pnpm test:e2e
 */

import { spawnSync } from "child_process";
import { mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dir = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dir, "..");

mkdirSync(join(ROOT, "tests", "screenshots"), { recursive: true });

const pw = spawnSync("pnpm", ["playwright", "test"], {
  stdio: "inherit",
  cwd: ROOT,
  shell: true,
});

const exitCode = pw.status ?? 1;
console.log(`\n[e2e] Screenshots: tests/screenshots/`);
console.log(`[e2e] Report:      tests/playwright-report/index.html`);
console.log(`[e2e] Exit code:   ${exitCode}`);
process.exit(exitCode);
