import { test, expect, navigate } from "../fixtures";

test.describe("DAS-141 LCCA break-even in UI", () => {
  test("shows break-even year when two scenarios cross", async ({ page }) => {
    await navigate(page, "/economics");
    await page.getByRole("tab", { name: /lcca/i }).click();
    await page.waitForTimeout(300);

    const nums = page.locator("main input[type='number']");
    await nums.nth(0).fill("0");
    await nums.nth(1).fill("10");
    await nums.nth(2).fill("5000000");
    await nums.nth(3).fill("0");
    await nums.nth(4).fill("50");
    await nums.nth(5).fill("1000000");
    await nums.nth(6).fill("1000000");
    await nums.nth(7).fill("1");

    await page.getByRole("button", { name: /compute lcca/i }).click();
    await expect(page.getByText(/break-even at year 4/i)).toBeVisible({ timeout: 10_000 });
  });
});
