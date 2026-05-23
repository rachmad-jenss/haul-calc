import { test, testE2eThrow, expect, navigate } from "../fixtures";

testE2eThrow.describe("DAS-136 ErrorBoundary manual checks", () => {
  testE2eThrow("Try again remounts route after render error", async ({ page }) => {
    await expect(page.getByText(/something went wrong/i)).toBeVisible();
    await page.evaluate(() => {
      window.__HAULCALC_E2E_SHOULD_THROW__ = false;
    });
    await page.getByRole("button", { name: /try again/i }).click();
    await expect(page.locator("main")).toContainText("Dashboard", { timeout: 10_000 });
    await expect(page.getByRole("heading", { name: /something went wrong/i })).toHaveCount(0);
  });
});

test.describe("DAS-136 ErrorBoundary layout", () => {
  test("full-height route still fills main pane after ErrorBoundary wrapper", async ({ page }) => {
    await navigate(page, "/fleet");
    const main = page.locator("main");
    const routeRoot = main.locator("div.h-full").first();
    await expect(routeRoot).toBeVisible();
    const mainBox = await main.boundingBox();
    const routeBox = await routeRoot.boundingBox();
    expect(mainBox).not.toBeNull();
    expect(routeBox).not.toBeNull();
    if (mainBox && routeBox) {
      expect(routeBox.height).toBeGreaterThan(mainBox.height * 0.5);
    }
  });
});
