import { test, expect, navigate } from "../fixtures";

test.describe("CESA axle pass distribution (DAS-142 manual)", () => {
  test("axle table shows different pass counts per load group", async ({ page }) => {
    await navigate(page, "/fleet");
    await page.getByRole("button", { name: /compute cesa/i }).click();
    await expect(page.getByText("Axle load distribution")).toBeVisible({ timeout: 15_000 });
    const passCells = page.locator("table").nth(1).locator("tbody tr td:last-child");
    const texts = await passCells.allTextContents();
    const values = texts.map((t) => Number(t.replace(/,/g, ""))).filter((n) => Number.isFinite(n));
    expect(values.length).toBeGreaterThanOrEqual(2);
    expect(new Set(values).size).toBeGreaterThan(1);
  });
});
