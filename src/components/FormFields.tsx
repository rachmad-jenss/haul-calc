import { useEffect, useId, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  cn,
  formatGroupedAmount,
  parseDisplayAmountToUsd,
  parseNumericInput,
  toDisplayAmount,
} from "@/lib/utils";
import type { DisplayCurrency } from "@/lib/store";
import { useCalcStore } from "@/lib/store";

const fieldErrorClass = "text-xs text-destructive";

export function FieldError({ id, message }: { id?: string; message?: string }) {
  if (!message) return null;
  return (
    <p id={id} className={fieldErrorClass} role="alert">
      {message}
    </p>
  );
}

export function NumField({
  id,
  label,
  value,
  onChange,
  min,
  max,
  error,
  description,
  disabled,
}: {
  id?: string;
  label: string;
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  error?: string;
  description?: string;
  disabled?: boolean;
}) {
  const autoId = useId();
  const inputId = id ?? autoId;
  const errorId = `${inputId}-error`;
  const descId = description ? `${inputId}-description` : undefined;
  const describedBy = [error ? errorId : undefined, descId].filter(Boolean).join(" ") || undefined;

  return (
    <div className="space-y-1">
      <Label htmlFor={inputId}>{label}</Label>
      <Input
        id={inputId}
        type="number"
        min={min}
        max={max}
        value={value}
        disabled={disabled}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className={cn(error && "border-destructive focus-visible:ring-destructive")}
        onChange={(e) => onChange(parseNumericInput(e.target.value, value))}
      />
      {description ? (
        <p id={descId} className="text-md text-subtle">
          {description}
        </p>
      ) : null}
      <FieldError id={errorId} message={error} />
    </div>
  );
}

export function CurrencyNumField({
  id,
  label,
  value,
  onChange,
  min,
  error,
  description,
  disabled,
  currency: currencyProp,
  rate: rateProp,
}: {
  id?: string;
  label: string;
  /** Stored value in USD (engine currency). */
  value: number;
  onChange: (usd: number) => void;
  min?: number;
  error?: string;
  description?: string;
  disabled?: boolean;
  currency?: DisplayCurrency;
  rate?: number;
}) {
  const storeCurrency = useCalcStore((s) => s.currency);
  const storeRate = useCalcStore((s) => s.usdToIdrRate);
  const currency = currencyProp ?? storeCurrency;
  const rate = rateProp ?? storeRate;

  const autoId = useId();
  const inputId = id ?? autoId;
  const errorId = `${inputId}-error`;
  const descId = description ? `${inputId}-description` : undefined;
  const describedBy = [error ? errorId : undefined, descId].filter(Boolean).join(" ") || undefined;

  const [focused, setFocused] = useState(false);
  const [text, setText] = useState(() =>
    formatGroupedAmount(toDisplayAmount(value, currency, rate), currency),
  );

  useEffect(() => {
    if (!focused) {
      setText(formatGroupedAmount(toDisplayAmount(value, currency, rate), currency));
    }
  }, [value, currency, rate, focused]);

  const commit = (raw: string) => {
    let usd = parseDisplayAmountToUsd(raw, value, currency, rate);
    if (min != null && Number.isFinite(min)) usd = Math.max(min, usd);
    onChange(usd);
    setText(formatGroupedAmount(toDisplayAmount(usd, currency, rate), currency));
  };

  return (
    <div className="space-y-1">
      <Label htmlFor={inputId}>{label}</Label>
      <Input
        id={inputId}
        type="text"
        inputMode="numeric"
        value={text}
        disabled={disabled}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className={cn(error && "border-destructive focus-visible:ring-destructive")}
        onFocus={() => setFocused(true)}
        onBlur={() => {
          setFocused(false);
          commit(text);
        }}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.currentTarget.blur();
          }
        }}
      />
      {description ? (
        <p id={descId} className="text-md text-subtle">
          {description}
        </p>
      ) : null}
      <FieldError id={errorId} message={error} />
    </div>
  );
}

export function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between border-b pb-2 last:border-0">
      <span className="text-md text-subtle">{label}</span>
      <span className="font-mono text-base font-semibold">{value}</span>
    </div>
  );
}

export function Row({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between border-b pb-2 last:border-0">
      <span className="text-md text-subtle">{label}</span>
      <span>{children}</span>
    </div>
  );
}
