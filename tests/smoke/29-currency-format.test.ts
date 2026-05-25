import { test, expect, navigate, seedStoreState } from "../fixtures";

test.describe("Currency formatting (DAS-293)", () => {
  test("Economics opex results use IDR symbols when IDR selected", async ({ page }) => {
    await seedStoreState(page, { currency: "IDR", usdToIdrRate: 16_000 });
    await navigate(page, "/economics");
    await page.getByRole("button", { name: /compare scenarios/i }).click();
    await expect(page.locator("svg.recharts-surface").first()).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.locator("main")).toContainText(/Rp|IDR/);
  });
});
