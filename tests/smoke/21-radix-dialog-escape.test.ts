import { test, expect, navigate } from "../fixtures";

test.describe("DAS-188 Radix dialog behavior", () => {
  test("Escape closes custom vehicles dialog", async ({ page }) => {
    await navigate(page, "/fleet");
    await page.getByRole("button", { name: /custom vehicles/i }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByRole("heading", { name: /custom vehicles/i })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(dialog).not.toBeVisible();
  });

  test("backdrop click closes custom materials dialog", async ({ page }) => {
    await navigate(page, "/pavement");
    await page.getByRole("button", { name: /custom materials/i }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.locator("[data-state='open']").first().click({ position: { x: 8, y: 8 } });
    await expect(page.getByRole("dialog")).not.toBeVisible();
  });
});
