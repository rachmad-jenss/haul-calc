import { test, expect, navigate, type Page } from "../fixtures";

/** Remove all fleet rows until the empty-state panel is shown. */
async function clearAllFleetRows(page: Page) {
  const empty = page.getByTestId("fleet-empty-state");
  if (await empty.isVisible()) return;

  const remove = page.getByRole("button", { name: "Remove row" });
  while ((await remove.count()) > 0) {
    const before = await remove.count();
    await remove.first().click();
    await expect(remove).toHaveCount(before - 1);
  }
  await expect(empty).toBeVisible();
}

test.describe("UX polish sprint smoke (DAS-201)", () => {
  test.describe("Fleet empty state (DAS-180)", () => {
    test.beforeEach(async ({ page }) => {
      await navigate(page, "/fleet");
      await clearAllFleetRows(page);
    });

    test("shows empty state with Add row and Sample fleet CTAs", async ({ page }) => {
      const empty = page.getByTestId("fleet-empty-state");
      await expect(empty).toContainText("No vehicles in fleet");
      await expect(empty.getByRole("button", { name: /add row/i })).toBeVisible();
      await expect(empty.getByRole("button", { name: /sample fleet/i })).toBeVisible();
    });

    test("Add row from empty state restores fleet table", async ({ page }) => {
      await page.getByTestId("fleet-empty-state").getByRole("button", { name: /add row/i }).click();
      await expect(page.getByTestId("fleet-empty-state")).toBeHidden();
      await expect(page.locator("table tbody tr").first()).toBeVisible();
    });

    test("Sample fleet loads rows from empty state", async ({ page }) => {
      await page.getByTestId("fleet-empty-state").getByRole("button", { name: /sample fleet/i }).click();
      await expect(page.getByTestId("fleet-empty-state")).toBeHidden({ timeout: 10_000 });
      const rows = page.locator("table tbody tr");
      await expect(rows.first()).toBeVisible();
      expect(await rows.count()).toBeGreaterThan(0);
    });
  });

  test.describe("Dialog focus trap (DAS-188)", () => {
    test("Tab keeps focus inside custom vehicles dialog", async ({ page }) => {
      await navigate(page, "/fleet");
      await page.getByRole("button", { name: /custom vehicles/i }).click();
      const dialog = page.getByRole("dialog");
      await expect(dialog).toBeVisible();

      for (let i = 0; i < 12; i++) {
        await page.keyboard.press("Tab");
        const inDialog = await page.evaluate(() => {
          const active = document.activeElement;
          return active != null && active.closest('[role="dialog"]') != null;
        });
        expect(inDialog).toBe(true);
      }
    });
  });

  test.describe("Chart accessible data table (DAS-199)", () => {
    test("Opex chart toggles data table after Compare", async ({ page }) => {
      await navigate(page, "/economics");
      await page.getByRole("button", { name: /compare/i }).click();
      await expect(page.locator("svg.recharts-surface").first()).toBeVisible({ timeout: 15_000 });

      const hideTable = page.getByRole("button", { name: /hide data table/i }).first();
      await expect(hideTable).toBeVisible();
      await expect(page.getByRole("region", { name: "Chart data table" }).first()).toBeVisible();

      await hideTable.click();
      await expect(page.getByRole("button", { name: /show data table/i }).first()).toBeVisible();
      await expect(page.getByRole("region", { name: "Chart data table" })).toHaveCount(0);

      await page.getByRole("button", { name: /show data table/i }).first().click();
      await expect(page.getByRole("region", { name: "Chart data table" }).first()).toBeVisible();
    });
  });

  test.describe("Inline validation regression (DAS-191)", () => {
    test("invalid pavement CBR shows inline error on Compute", async ({ page }) => {
      await navigate(page, "/pavement");
      await page.getByLabel(/subgrade cbr/i).fill("0");
      await page.getByRole("button", { name: /compute/i }).click();
      await expect(page.locator("#subgrade-cbr-error")).toBeVisible();
    });
  });
});
