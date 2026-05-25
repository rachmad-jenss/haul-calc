import { test, expect } from "../fixtures";
import { STORE_KEY, preferencesPersistPayload } from "../fixtures";

test.describe("Fresh startup (DAS-288)", () => {
  test("recent files persist but project data does not", async ({ page }) => {
    await page.evaluate(
      ({ key, payload }) => {
        localStorage.setItem(key, JSON.stringify(payload));
      },
      {
        key: STORE_KEY,
        payload: preferencesPersistPayload({
          recentFiles: ["C:/Users/test/old-project.hcalc"],
          unitSystem: "Imperial",
        }),
      },
    );
    await page.reload();
    await page.waitForTimeout(1200);

    await page.goto("/#/dashboard");
    await page.waitForTimeout(400);

    await expect(page.getByText("old-project.hcalc")).toBeVisible();
    await expect(page.locator("aside")).not.toContainText("old-project.hcalc");
  });
});
