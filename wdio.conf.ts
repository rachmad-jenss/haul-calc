import { join, dirname } from "path";
import { fileURLToPath } from "url";
import type { Options } from "@wdio/types";

const __dirname = dirname(fileURLToPath(import.meta.url));

const BINARY =
  process.env.TAURI_BINARY ??
  join(__dirname, "src-tauri", "target", "debug", "haul-calc.exe");

export const config: Options.Testrunner = {
  runner: "local",
  specs: ["./tests/smoke/**/*.test.ts"],
  exclude: [],
  maxInstances: 1,

  capabilities: [
    {
      maxInstances: 1,
      "tauri:options": { application: BINARY },
      browserName: "",
    },
  ],

  logLevel: "warn",
  bail: 0,
  baseUrl: "tauri://localhost",
  waitforTimeout: 10000,
  connectionRetryTimeout: 120000,
  connectionRetryCount: 3,

  // tauri-driver must be running before the suite starts
  // (started by the test:e2e npm script)
  hostname: "localhost",
  port: 4444,
  path: "/",

  framework: "mocha",
  reporters: ["spec"],

  autoCompileOpts: {
    autoCompile: true,
    tsNodeOpts: { transpileOnly: true, project: "./tsconfig.node.json" },
  },

  mochaOpts: {
    ui: "bdd",
    timeout: 60000,
  },

  afterTest: async function (test, _ctx, { error }) {
    if (error) {
      const ts = Date.now();
      const safe = test.title.replace(/[^a-z0-9]/gi, "_").toLowerCase();
      await browser.saveScreenshot(`./tests/screenshots/FAIL_${safe}_${ts}.png`);
    }
  },
};
