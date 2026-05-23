import { test, expect, navigate } from "../fixtures";

test.describe("DAS-194 undo/redo toolbar", () => {
  test.beforeEach(async ({ page }) => {
    await navigate(page, "/fleet");
    await page.waitForTimeout(500);
  });

  test("undo and redo buttons disabled on fresh project", async ({ page }) => {
    await expect(page.getByRole("button", { name: "Undo" })).toBeDisabled();
    await expect(page.getByRole("button", { name: "Redo" })).toBeDisabled();
  });

  test("edit fleet row then undo/redo toolbar and keyboard", async ({ page }) => {
    const trips = page.locator("table tbody tr").first().getByRole("spinbutton").nth(1);
    await trips.fill("77");
    await expect(trips).toHaveValue("77");

    const undo = page.getByRole("button", { name: "Undo" });
    const redo = page.getByRole("button", { name: "Redo" });
    await expect(undo).toBeEnabled();
    await undo.click();
    await expect(trips).not.toHaveValue("77");
    await expect(redo).toBeEnabled();

    await page.keyboard.press("Control+Y");
    await expect(trips).toHaveValue("77");

    await page.keyboard.press("Control+Z");
    await expect(trips).not.toHaveValue("77");
  });
});
