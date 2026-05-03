import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/smoke",
  timeout: 30_000,
  retries: 0,
  workers: 1, // share the single Vite dev server
  reporter: [
    ["list"],
    ["html", { open: "never", outputFolder: "tests/playwright-report" }],
  ],
  outputDir: "tests/test-results",

  globalSetup: "./tests/global-setup.ts",
  globalTeardown: "./tests/global-teardown.ts",

  use: {
    baseURL: "http://localhost:1420",
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },

  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
