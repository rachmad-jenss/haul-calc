import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  currencyLocale,
  formatCurrency,
  formatGroupedAmount,
  formatMoneyFromUsd,
  parseDisplayAmountToUsd,
  parseNumericInput,
  toDisplayAmount,
} from "../../src/lib/utils.ts";

describe("currencyLocale", () => {
  it("maps display currency to Intl locale", () => {
    assert.equal(currencyLocale("USD"), "en-US");
    assert.equal(currencyLocale("IDR"), "id-ID");
  });
});

describe("toDisplayAmount", () => {
  it("converts USD to IDR using rate", () => {
    assert.equal(toDisplayAmount(100, "IDR", 16_000), 1_600_000);
    assert.equal(toDisplayAmount(100, "USD", 16_000), 100);
  });
});

describe("formatCurrency", () => {
  it("formats USD with en-US grouping", () => {
    const s = formatCurrency(1_234_567, "USD");
    assert.match(s, /1,234,567/);
    assert.match(s, /\$/);
  });

  it("formats IDR with id-ID grouping", () => {
    const s = formatCurrency(16_000_000, "IDR");
    assert.match(s, /16\.000\.000|16,000,000/);
  });
});

describe("formatMoneyFromUsd", () => {
  it("applies rate before currency symbol", () => {
    const s = formatMoneyFromUsd(50_000, "IDR", 16_000);
    assert.match(s, /800\.000\.000|800,000,000/);
  });
});

describe("parseNumericInput", () => {
  it("strips en-US thousand commas", () => {
    assert.equal(parseNumericInput("1,234,567", 0), 1_234_567);
  });

  it("strips id-ID thousand dots", () => {
    assert.equal(parseNumericInput("16.000.000", 0), 16_000_000);
  });
});

describe("parse/format round-trip", () => {
  it("USD grouped input round-trips", () => {
    const grouped = formatGroupedAmount(250_000, "USD");
    const parsed = parseNumericInput(grouped, -1);
    assert.equal(parsed, 250_000);
    assert.equal(parseDisplayAmountToUsd(grouped, -1, "USD", 16_000), 250_000);
  });

  it("IDR grouped input converts back to USD", () => {
    const usd = 10_000;
    const rate = 16_000;
    const grouped = formatGroupedAmount(toDisplayAmount(usd, "IDR", rate), "IDR");
    const back = parseDisplayAmountToUsd(grouped, -1, "IDR", rate);
    assert.ok(Math.abs(back - usd) < 0.01);
  });
});
