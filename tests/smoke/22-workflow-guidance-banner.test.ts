import { test, expect, navigate } from "../fixtures";

test.describe("Workflow guidance banner (DAS-197)", () => {
  test.beforeEach(async ({ page }) => {
    await page.evaluate(() => {
      sessionStorage.removeItem("haulcalc-workflow-banner-dismissed:untitled");
      sessionStorage.removeItem("haulcalc-workflow-banner-dismissed:Test");
    });
  });

  test("shows Fleet as current step on fresh project", async ({ page }) => {
    await navigate(page, "/dashboard");
    const banner = page.getByRole("region", { name: "Project workflow guidance" });
    await expect(banner).toBeVisible();
    await expect(banner.getByText("Recommended workflow")).toBeVisible();
    await expect(banner.getByRole("link", { name: /Fleet & Traffic/i })).toHaveAttribute(
      "aria-current",
      "step",
    );
  });

  test("dismiss hides banner for session", async ({ page }) => {
    await navigate(page, "/dashboard");
    const banner = page.getByRole("region", { name: "Project workflow guidance" });
    await banner.getByRole("button", { name: /Dismiss workflow guidance/i }).click();
    await expect(banner).toBeHidden();
    await page.reload();
    await expect(page.getByRole("region", { name: "Project workflow guidance" })).toBeHidden();
  });

  test("step link navigates to fleet route", async ({ page }) => {
    await navigate(page, "/dashboard");
    const banner = page.getByRole("region", { name: "Project workflow guidance" });
    await banner.getByRole("link", { name: /Fleet & Traffic/i }).click();
    await expect(page).toHaveURL(/#\/fleet/);
  });
});
