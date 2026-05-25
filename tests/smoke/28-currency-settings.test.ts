import { test, expect } from "../fixtures";
import { STORE_KEY, preferencesPersistPayload } from "../fixtures";

test.describe("Currency settings (DAS-292)", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/#/settings");
    await page.waitForTimeout(500);
  });

  test("defaults to USD without rate field", async ({ page }) => {
    await expect(page.getByRole("radio", { name: "USD" })).toBeChecked();
    await expect(page.getByLabel(/USD to IDR rate/i)).toHaveCount(0);
  });

  test("IDR shows rate field and rejects invalid rate", async ({ page }) => {
    await page.getByRole("radio", { name: "IDR" }).click();
    const rateInput = page.getByRole("textbox");
    await rateInput.fill("0");
    await rateInput.blur();
    await expect(page.getByRole("alert")).toContainText("positive");

    await rateInput.fill("16500");
    await rateInput.blur();
    await expect(page.getByRole("alert")).toHaveCount(0);
    await expect(rateInput).toHaveValue("16500");
  });

  test("currency and rate persist across restart", async ({ page }) => {
    await page.evaluate(
      ({ key, payload }) => {
        localStorage.setItem(key, JSON.stringify(payload));
      },
      {
        key: STORE_KEY,
        payload: preferencesPersistPayload({
          currency: "IDR",
          usdToIdrRate: 15800,
        }),
      },
    );
    await page.reload();
    await page.waitForTimeout(1200);

    await expect(page.getByRole("radio", { name: "IDR" })).toBeChecked();
    await expect(page.getByRole("textbox")).toHaveValue("15800");
  });
});
