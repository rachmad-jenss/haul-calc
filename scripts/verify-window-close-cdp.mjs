/**
 * DAS-177 dirty-state helper: drive the Tauri WebView via CDP (port 9222).
 * Requires: WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS=--remote-debugging-port=9222
 */
import { chromium } from "@playwright/test";

const CDP = process.env.CDP_URL ?? "http://127.0.0.1:9222";

const browser = await chromium.connectOverCDP(CDP);
const context = browser.contexts()[0] ?? (await browser.newContext());
let page = context.pages().find((p) => p.url().includes("haul") || p.url().includes("localhost"));
if (!page) page = context.pages()[0];
if (!page) throw new Error("No WebView page in CDP");

if (!page.url().includes("/fleet")) {
  await page.evaluate(() => {
    window.location.hash = "#/fleet";
  });
  await page.waitForURL(/#\/fleet/);
}

const designLife = page.locator("#design-life");
await designLife.waitFor();
const currentValue = await designLife.inputValue();
const nextValue = currentValue === "13" ? "12" : "13";
await designLife.click();
await designLife.fill(nextValue);
await page.keyboard.press("Tab");
await new Promise((r) => setTimeout(r, 800));

const title = await page.title();
const actualValue = await designLife.inputValue();
console.log(`PAGE_TITLE=${title}`);
console.log(`DIRTY_FIELD_SET=1 VALUE=${actualValue}`);
process.exit(0);
