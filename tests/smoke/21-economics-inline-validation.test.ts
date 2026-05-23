import { test, expect, navigate } from "../fixtures";

test.describe("DAS-192 economics inline Zod validation", () => {
  test.beforeEach(async ({ page }) => {
    await navigate(page, "/economics");
    await page.waitForTimeout(500);
  });

  test("invalid thickness highlights scenario field on Compare", async ({ page }) => {
    const scenario = page.locator(".rounded.border.p-3").first();
    const thickness = scenario.locator('input[type="number"]').first();
    await thickness.fill("0");
    await page.getByRole("button", { name: /compare/i }).click();
    await expect(thickness).toHaveAttribute("aria-invalid", "true");
    await expect(page.locator(".text-destructive").first()).toBeVisible();
  });

  test("valid compare still renders chart", async ({ page }) => {
    await page.getByRole("button", { name: /compare/i }).click();
    await expect(page.locator("svg.recharts-surface").first()).toBeVisible({ timeout: 15_000 });
  });
});
