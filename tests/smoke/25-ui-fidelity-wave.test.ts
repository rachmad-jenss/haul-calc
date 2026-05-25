import { test, expect, navigate, type Page } from "../fixtures";

/** Mark the project dirty via a fleet edit (sets isProjectDirty in store). */
async function markProjectDirty(page: Page) {
  await navigate(page, "/fleet");
  const empty = page.getByTestId("fleet-empty-state");
  if (await empty.isVisible()) {
    await empty.getByRole("button", { name: /add row/i }).click();
  } else {
    const firstInput = page.locator("table tbody tr").first().locator("input").first();
    await firstInput.fill("1");
  }
  await expect(page.getByTestId("app-titlebar")).toContainText("Unsaved", { timeout: 5_000 });
}

test.describe("UI fidelity wave smoke (DAS-265)", () => {
  test("custom title bar visible with window chrome controls", async ({ page }) => {
    const bar = page.getByTestId("app-titlebar");
    await expect(bar).toBeVisible();
    await expect(bar.getByRole("img", { name: "HaulCalc" })).toBeVisible();
    await expect(bar.locator("svg")).toBeVisible();
    await expect(bar.getByRole("button", { name: "Minimize" })).toBeVisible();
    await expect(bar.getByRole("button", { name: /maximize|restore/i })).toBeVisible();
    await expect(bar.getByRole("button", { name: "Close" })).toBeVisible();
  });

  test("title bar shows dirty subtitle after fleet edit", async ({ page }) => {
    await markProjectDirty(page);
    await expect(page.getByTestId("app-titlebar")).toContainText("Unsaved");
  });

  test("theme toggle cycles light, dark, and system without crash", async ({ page }) => {
    const toggle = page.getByRole("button", {
      name: /light mode|dark mode|system theme/i,
    });
    await expect(toggle).toBeVisible();

    const labels: string[] = [];
    for (let i = 0; i < 3; i++) {
      const before = (await toggle.getAttribute("aria-label")) ?? "";
      labels.push(before);
      await toggle.click();
      await expect(toggle).not.toHaveAttribute("aria-label", before);
      await expect(page.getByTestId("app-titlebar")).toBeVisible();
    }

    expect(labels.some((l) => /light mode/i.test(l))).toBe(true);
    expect(labels.some((l) => /dark mode/i.test(l))).toBe(true);
    expect(labels.some((l) => /system theme/i.test(l))).toBe(true);
  });

  test("in-app confirm dialog when starting new project with unsaved changes", async ({ page }) => {
    await markProjectDirty(page);
    await page.getByRole("button", { name: "New project" }).click();

    const dialog = page.getByRole("dialog", { name: "Unsaved Changes" });
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText("Start a new project anyway");

    await dialog.getByRole("button", { name: "Cancel" }).click();
    await expect(dialog).toBeHidden();
    await expect(page.getByTestId("app-titlebar")).toContainText("Unsaved");
  });

  test("sidebar navigates core routes with title bar present", async ({ page }) => {
    for (const route of ["/dashboard", "/fleet", "/pavement", "/settings"]) {
      await navigate(page, route);
      await expect(page.locator("main")).toBeVisible();
      await expect(page.getByTestId("app-titlebar")).toBeVisible();
    }
  });

  test("sonner toast appears after loading sample fleet", async ({ page }) => {
    await navigate(page, "/fleet");
    const empty = page.getByTestId("fleet-empty-state");
    if (await empty.isVisible()) {
      await empty.getByRole("button", { name: /sample fleet/i }).click();
    } else {
      await page.getByRole("button", { name: /sample fleet/i }).click();
    }
    await expect(
      page.locator("[data-sonner-toast]").filter({ hasText: /loaded \d+ sample vehicles/i }),
    ).toBeVisible({ timeout: 10_000 });
  });
});
