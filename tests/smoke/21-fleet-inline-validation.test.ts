import { test, expect, navigate } from "../fixtures";

test.describe("DAS-190 fleet inline Zod validation", () => {
  test.beforeEach(async ({ page }) => {
    await navigate(page, "/fleet");
    await page.waitForTimeout(500);
  });

  test("invalid count shows inline error on Compute", async ({ page }) => {
    const countInput = page.locator("table tbody tr").first().getByRole("spinbutton").first();
    await countInput.fill("0");
    await page.getByRole("button", { name: /compute cesa/i }).click();
    await expect(page.locator("table tbody tr").first().locator(".text-destructive")).toBeVisible();
  });

  test("fixing count clears inline error", async ({ page }) => {
    const countInput = page.locator("table tbody tr").first().getByRole("spinbutton").first();
    await countInput.fill("0");
    await page.getByRole("button", { name: /compute cesa/i }).click();
    await expect(page.locator("table tbody tr").first().locator(".text-destructive")).toBeVisible();
    await countInput.fill("8");
    await expect(page.locator("table tbody tr").first().locator(".text-destructive")).not.toBeVisible();
  });
});
