import { test, expect, navigate } from "../fixtures";

test.describe("DAS-165 material library E2E flow", () => {
  test.beforeEach(async ({ page }) => {
    await navigate(page, "/pavement");
    await page.waitForTimeout(800);
  });

  test("browse catalog, add from template, compute and compare show layer names", async ({
    page,
  }) => {
    await expect(page.getByText("Gravel-sand mix (G5)")).toBeVisible({ timeout: 10_000 });

    await page.getByLabel("Search material catalog").fill("Crushed");
    await expect(page.getByText("Crushed stone base (high quality)")).toBeVisible();
    await expect(page.getByText("Gravel-sand mix (G5)")).not.toBeVisible();

    await page
      .locator("li")
      .filter({ hasText: "Crushed stone base (high quality)" })
      .getByRole("button", { name: "Use" })
      .click();

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(dialog.getByLabel("Material name")).toHaveValue(
      "Crushed stone base (high quality)",
    );

    await dialog.getByRole("button", { name: "Add material" }).click();
    await expect(
      dialog.getByRole("listitem").filter({ hasText: "Crushed stone base (high quality)" }),
    ).toBeVisible();

    await dialog.getByLabel("Close").click();
    await expect(page.getByRole("dialog")).not.toBeVisible();

    await page.getByRole("button", { name: /Compute thickness/i }).click();
    await expect(page.getByTestId("pavement-total-thickness")).toBeVisible({
      timeout: 15_000,
    });
    await expect(
      page.getByLabel("USACE CBR").getByText("Crushed stone base (high quality)"),
    ).toBeVisible();

    await page.getByRole("tab", { name: "Compare" }).click();
    await page.getByRole("button", { name: /Run comparison/i }).click();
    await expect(page.getByTestId("compare-usace-thickness-mm")).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByTestId("compare-trh14-thickness-mm")).toBeVisible();
  });

  test("add custom material manually and use in compute", async ({ page }) => {
    await page.getByRole("button", { name: /Custom materials/i }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();

    await dialog.getByLabel("Material name").fill("Manual E2E gravel");
    await dialog.locator("#cm-cbr").fill("20");
    await dialog.getByRole("button", { name: "Add material" }).click();
    await expect(dialog.getByRole("listitem").filter({ hasText: "Manual E2E gravel" })).toBeVisible();

    await dialog.getByLabel("Close").click();
    await page.getByRole("button", { name: /Compute thickness/i }).click();
    await expect(page.getByTestId("pavement-total-thickness")).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByText("Manual E2E gravel")).toBeVisible();
  });
});
