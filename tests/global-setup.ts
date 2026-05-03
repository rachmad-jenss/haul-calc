import { spawn } from "child_process";
import { writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dir = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dir, "..");
const PID_FILE = join(ROOT, "tests", ".vite-pid");

export default async function globalSetup() {
  // Check if Vite is already running on 1420
  try {
    const res = await fetch("http://localhost:1420");
    if (res.ok) {
      console.log("[setup] Vite already running on :1420");
      return;
    }
  } catch {
    // not running, start it
  }

  console.log("[setup] Starting Vite dev server...");
  const vite = spawn("pnpm", ["dev"], {
    cwd: ROOT,
    shell: true,
    stdio: ["ignore", "pipe", "pipe"],
    detached: false,
  });

  writeFileSync(PID_FILE, String(vite.pid));

  // Wait for Vite to be ready
  for (let i = 0; i < 30; i++) {
    await new Promise((r) => setTimeout(r, 1000));
    try {
      const res = await fetch("http://localhost:1420");
      if (res.ok) {
        console.log("[setup] Vite ready on :1420");
        return;
      }
    } catch {
      // still starting
    }
  }
  throw new Error("[setup] Vite failed to start within 30s");
}
