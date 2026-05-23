import { test, expect, navigate } from "../fixtures";

test.describe("DAS-193 Radix Select keyboard", () => {
  test("sensitivity metric select opens with keyboard and chooses option", async ({ page }) => {
    await navigate(page, "/sensitivity");
    const trigger = page.locator("#sens-metric");
    await trigger.focus();
    await page.keyboard.press("ArrowDown");
    await page.getByRole("option", { name: /annual cost/i }).click();
    await expect(trigger).toContainText(/annual cost/i);
  });
});
