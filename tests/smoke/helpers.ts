import type { Page } from "@playwright/test";
import { join } from "path";

export const SS = (name: string) => join("tests", "screenshots", `${name}.png`);

/** Navigate via React Router history API (works inside WebView2 CDP context). */
export async function navigate(page: Page, path: string) {
  await page.evaluate((p) => {
    window.history.pushState({}, "", p);
    window.dispatchEvent(new PopStateEvent("popstate", { state: {} }));
  }, path);
  await page.waitForTimeout(600);
}
