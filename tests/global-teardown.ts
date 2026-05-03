import { existsSync, readFileSync, unlinkSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dir = dirname(fileURLToPath(import.meta.url));
const PID_FILE = join(__dir, ".vite-pid");

export default async function globalTeardown() {
  if (!existsSync(PID_FILE)) return;

  const pid = parseInt(readFileSync(PID_FILE, "utf8"), 10);
  unlinkSync(PID_FILE);

  try {
    process.kill(pid, "SIGTERM");
    console.log(`[teardown] Killed Vite dev server (pid ${pid})`);
  } catch {
    // already gone
  }
}
