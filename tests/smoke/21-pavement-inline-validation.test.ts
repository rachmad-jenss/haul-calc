import { test, expect, navigate } from "../fixtures";

test.describe("DAS-191 pavement inline Zod validation", () => {
  test.beforeEach(async ({ page }) => {
    await navigate(page, "/pavement");
    await page.waitForTimeout(500);
  });

  test("invalid CBR shows inline error on Compute", async ({ page }) => {
    await page.getByLabel(/subgrade cbr/i).fill("0");
    await page.getByRole("button", { name: /compute/i }).click();
    await expect(page.locator("#subgrade-cbr-error")).toBeVisible();
  });

  test("stub banners still appear after valid compute", async ({ page }) => {
    await page.getByRole("button", { name: /compute/i }).click();
    await page.waitForTimeout(3000);
    const text = await page.locator("main").textContent();
    expect(text?.toLowerCase()).toMatch(/stub|fixture|not yet/);
  });
});
