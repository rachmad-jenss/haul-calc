import { test, expect, navigate } from "../fixtures";

test.describe("DAS-138 sidecar killed status", () => {
  test("Settings shows Stopped when sidecar is killed", async ({ page }) => {
    await page.addInitScript(() => {
      (window as Window & { __HAULCALC_SIDECAR_STATUS__?: string }).__HAULCALC_SIDECAR_STATUS__ =
        "killed";
    });
    await page.reload();
    await navigate(page, "/settings");
    await page.getByRole("button", { name: /refresh/i }).click();
    await expect(page.locator("main")).toContainText("Stopped", { timeout: 10_000 });
    await expect(page.locator("main")).not.toContainText("Crashed");
  });

  test("Refresh shows Running when sidecar is healthy", async ({ page }) => {
    await navigate(page, "/settings");
    await page.waitForTimeout(1500);
    await expect(page.locator("main")).toContainText("Running", { timeout: 10_000 });
    await expect(page.locator("main")).toContainText("0.2.0");
  });
});
