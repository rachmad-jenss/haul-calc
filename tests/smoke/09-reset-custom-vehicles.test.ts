import { test, expect, navigate } from "../fixtures";

test.describe("DAS-132 resetProject clears customVehicles", () => {
  test("New project clears saved custom vehicles list", async ({ page }) => {
    await navigate(page, "/fleet");
    await page.getByRole("button", { name: /custom vehicles/i }).click();
    await page.getByLabel("Vehicle name").fill("E2E Custom Hauler");
    await page.getByLabel("GVW (kN)").fill("5000");
    await page.getByRole("button", { name: /add vehicle/i }).click();
    const dialog = page.getByRole("dialog", { name: /custom vehicles/i });
    await expect(page.getByTestId("custom-vehicle-row").filter({ hasText: "E2E Custom Hauler" })).toBeVisible();
    await page.getByRole("button", { name: "Close" }).click();

    await page.getByTitle("New project (Ctrl+N)").click();
    await page.waitForTimeout(500);

    await page.getByRole("button", { name: /custom vehicles/i }).click();
    await expect(page.getByText(/saved custom vehicles/i)).not.toBeVisible();
    await expect(page.getByTestId("custom-vehicle-row")).not.toBeVisible();
  });
});
