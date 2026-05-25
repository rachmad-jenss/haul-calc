import { useMemo } from "react";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import type { DisplayCurrency } from "@/lib/store";
import { useCalcStore } from "@/lib/store";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatNumber(value: number, digits = 2): string {
  if (!Number.isFinite(value)) return "—";
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value);
}

export function currencyLocale(currency: DisplayCurrency): string {
  return currency === "IDR" ? "id-ID" : "en-US";
}

export function toDisplayAmount(
  usdValue: number,
  currency: DisplayCurrency,
  rate: number,
): number {
  if (!Number.isFinite(usdValue)) return usdValue;
  if (currency === "IDR") return usdValue * rate;
  return usdValue;
}

export function formatGroupedAmount(value: number, currency: DisplayCurrency): string {
  if (!Number.isFinite(value)) return "";
  return new Intl.NumberFormat(currencyLocale(currency), {
    maximumFractionDigits: 0,
    minimumFractionDigits: 0,
  }).format(value);
}

export function formatCurrency(value: number, currency: DisplayCurrency = "USD"): string {
  if (!Number.isFinite(value)) return "—";
  return new Intl.NumberFormat(currencyLocale(currency), {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatMoneyFromUsd(
  usd: number,
  currency: DisplayCurrency,
  rate: number,
): string {
  return formatCurrency(toDisplayAmount(usd, currency, rate), currency);
}

export function parseNumericInput(raw: string, fallback: number): number {
  if (raw.trim() === "") return fallback;
  const n = Number(raw.trim());
  return Number.isFinite(n) ? n : fallback;
}

/** Parses grouped integer money strings (e.g. 1,234,567 or 16.000.000). */
export function parseGroupedIntegerInput(raw: string, fallback: number): number {
  if (raw.trim() === "") return fallback;
  let s = raw.trim().replace(/\s/g, "");
  s = s.replace(/,/g, "");
  s = s.replace(/\./g, "");
  const n = Number(s);
  return Number.isFinite(n) ? n : fallback;
}

export function parseDisplayAmountToUsd(
  raw: string,
  fallbackUsd: number,
  currency: DisplayCurrency,
  rate: number,
): number {
  const display = parseGroupedIntegerInput(raw, Number.NaN);
  if (!Number.isFinite(display)) return fallbackUsd;
  if (currency === "IDR") {
    if (!Number.isFinite(rate) || rate <= 0) return fallbackUsd;
    return display / rate;
  }
  return display;
}

export function useMoneyFormatter() {
  const currency = useCalcStore((s) => s.currency);
  const rate = useCalcStore((s) => s.usdToIdrRate);

  return useMemo(
    () => ({
      currency,
      rate,
      toDisplay: (usd: number) => toDisplayAmount(usd, currency, rate),
      formatMoney: (usd: number) => formatMoneyFromUsd(usd, currency, rate),
      formatDisplay: (amount: number) => formatCurrency(amount, currency),
      formatGrouped: (amount: number) => formatGroupedAmount(amount, currency),
      parseInputToUsd: (raw: string, fallbackUsd: number) =>
        parseDisplayAmountToUsd(raw, fallbackUsd, currency, rate),
    }),
    [currency, rate],
  );
}

export function currencyUnitSuffix(currency: DisplayCurrency): string {
  return currency === "IDR" ? "IDR" : "USD";
}

export function toSafeCsvCell(value: string | number): string {
  const raw = String(value).replace(/"/g, '""').replace(/\r?\n/g, " ");
  const neutralized = /^[=+\-@]/.test(raw) ? `'${raw}` : raw;
  return `"${neutralized}"`;
}
