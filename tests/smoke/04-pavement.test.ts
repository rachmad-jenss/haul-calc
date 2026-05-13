import { test, expect, navigate, SS } from "../fixtures";

test.describe("Pavement Design page", () => {
  test.beforeEach(async ({ page }) => {
    await navigate(page, "/pavement");
    await page.waitForTimeout(1000);
  });

  test("renders input form", async ({ page }) => {
    await expect(page.locator("main")).toContainText("Subgrade CBR");
    await expect(page.locator("main")).toContainText("Design coverages");
    await page.screenshot({ path: SS("04-pavement-initial") });
  });

  test("computes and shows CBR + TRH14 tabs", async ({ page }) => {
    await page.getByRole("button", { name: /compute/i }).click();
    await expect(page.locator("main")).toContainText("CBR", { timeout: 15_000 });
    await expect(page.locator("main")).toContainText("TRH");
    await page.screenshot({ path: SS("04-pavement-tabs") });
  });

  test("CBR tab shows thickness data", async ({ page }) => {
    await page.getByRole("button", { name: /compute/i }).click();
    await page.waitForTimeout(3000);
    await page.getByRole("tab", { name: /cbr/i }).click();
    await page.waitForTimeout(400);
    const text = await page.locator("main").textContent();
    expect(text?.toLowerCase()).toMatch(/mm|layer|total|thickness/);
    await page.screenshot({ path: SS("04-pavement-cbr-tab") });
  });

  test("TRH14 tab shows thickness data", async ({ page }) => {
    await page.getByRole("button", { name: /compute/i }).click();
    await page.waitForTimeout(3000);
    await page.getByRole("tab", { name: /trh/i }).click();
    await page.waitForTimeout(400);
    const text = await page.locator("main").textContent();
    expect(text?.toLowerCase()).toMatch(/mm|layer|total|thickness/);
    await page.screenshot({ path: SS("04-pavement-trh-tab") });
  });

  test("Compare tab shows side-by-side comparison", async ({ page }) => {
    await page.getByRole("tab", { name: /compare/i }).click();
    await page.getByRole("button", { name: /run comparison/i }).click();
    await page.waitForTimeout(3000);
    const text = await page.locator("main").textContent();
    expect(text?.toLowerCase()).toMatch(/usace|trh 14|recommended/i);
    expect(text?.toLowerCase()).toMatch(/mm/);
    await page.screenshot({ path: SS("04-pavement-compare-tab") });
  });
});
