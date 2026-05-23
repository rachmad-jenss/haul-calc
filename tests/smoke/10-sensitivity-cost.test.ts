import { test, expect, navigate } from "../fixtures";

test.describe("DAS-134 sensitivity cost_total", () => {
  test.beforeEach(async ({ page }) => {
    await navigate(page, "/sensitivity");
  });

  test("rejects cost_total sweep unless parameter is trips/day multiplier", async ({ page }) => {
    await page.locator("#sens-metric").selectOption("cost_total");
    await page.getByRole("button", { name: /run analysis/i }).click();
    await expect(
      page.getByText(/annual cost sensitivity only supports trips\/day multiplier/i),
    ).toBeVisible();
    await expect(page.locator("svg.recharts-surface")).toHaveCount(0);
  });

  test("trips/day cost sweep renders chart with varying Y values", async ({ page }) => {
    await page.locator("#sens-metric").selectOption("cost_total");
    await page.locator("#sens-param").selectOption("trips_per_day");
    await page.getByRole("button", { name: /run analysis/i }).click();
    await expect(page.locator("svg.recharts-surface").first()).toBeVisible({ timeout: 15_000 });

    const rows = page.locator("main table tbody tr");
    await expect(rows).toHaveCount(10);
    const firstY = (await rows.first().locator("td").nth(1).textContent()) ?? "";
    const lastY = (await rows.last().locator("td").nth(1).textContent()) ?? "";
    expect(firstY).not.toEqual(lastY);
    const parseCost = (s: string) => parseFloat(s.replace(/[^0-9.]/g, ""));
    expect(parseCost(firstY)).toBeLessThan(parseCost(lastY));
  });
});
