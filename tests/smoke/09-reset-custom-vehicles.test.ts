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
    await page.keyboard.press("Escape");
    await expect(dialog).not.toBeVisible();

    await page.getByTitle("New project (Ctrl+N)").click();
    const newProjectDialog = page.getByRole("dialog", { name: "Unsaved Changes" });
    await expect(newProjectDialog).toBeVisible();
    await newProjectDialog.getByRole("button", { name: "New project" }).click();

    await page.getByRole("button", { name: /custom vehicles/i }).click();
    await expect(page.getByText(/saved custom vehicles/i)).not.toBeVisible();
    await expect(page.getByTestId("custom-vehicle-row")).not.toBeVisible();
  });
});
