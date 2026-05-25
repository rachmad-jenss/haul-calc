import { test, expect } from "../fixtures";
import {
  STORE_KEY,
  preferencesPersistPayload,
  seedStoreState,
} from "../fixtures";

async function seedPersistAndReload(
  page: import("@playwright/test").Page,
  overrides: Record<string, unknown>,
) {
  await page.evaluate(
    ({ key, payload }) => {
      localStorage.setItem(key, JSON.stringify(payload));
    },
    { key: STORE_KEY, payload: preferencesPersistPayload(overrides) },
  );
  await page.reload();
  await page.waitForTimeout(1500);
}

test.describe("Save file binding (DAS-127, DAS-288)", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/#/dashboard");
    await page.waitForTimeout(500);
  });

  test("cold start does not restore bound filename from persist", async ({ page }) => {
    await seedPersistAndReload(page, {});

    await expect(page.locator("aside")).not.toContainText(".hcalc");
    await expect(page.getByTestId("app-titlebar")).not.toContainText(".hcalc");
  });

  test("legacy v9 persist blob does not restore activeFileName after upgrade", async ({ page }) => {
    await page.evaluate(
      ({ key }) => {
        localStorage.setItem(
          key,
          JSON.stringify({
            version: 9,
            state: {
              theme: "system",
              autoCheckUpdates: true,
              unitSystem: "SI",
              recentFiles: [],
              activeFileName: "ghost.hcalc",
              activeFilePath: "C:/Users/test/ghost.hcalc",
              projectName: "Ghost project",
            },
          }),
        );
      },
      { key: STORE_KEY },
    );
    await page.reload();
    await page.waitForTimeout(1500);

    await expect(page.getByTestId("app-titlebar")).not.toContainText("ghost.hcalc");
  });

  test("in-session file binding shows filename in title bar", async ({ page }) => {
    await seedStoreState(page, {
      activeFileName: "real-project.hcalc",
      activeFilePath: "C:/Users/test/real-project.hcalc",
      isProjectDirty: true,
    });

    await expect(page.getByTestId("app-titlebar")).toContainText("real-project");
  });

  test("in-session binding heals path from recentFiles when name matches", async ({ page }) => {
    await seedStoreState(page, {
      activeFileName: "real-project.hcalc",
      activeFilePath: null,
      recentFiles: ["C:/Users/test/real-project.hcalc"],
    });

    await expect(page.getByTestId("app-titlebar")).toContainText("real-project", {
      timeout: 10_000,
    });
  });
});
