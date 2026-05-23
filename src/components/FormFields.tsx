import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn, parseNumericInput } from "@/lib/utils";

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
  const errorId = id ? `${id}-error` : undefined;
  const descId = id && description ? `${id}-description` : undefined;
  const describedBy = [error ? errorId : undefined, descId].filter(Boolean).join(" ") || undefined;

  return (
    <div className="space-y-1">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
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
        <p id={descId} className="text-xs text-muted-foreground">
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
      <span className="text-sm text-muted-foreground">{label}</span>
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
      <span className="text-muted-foreground">{label}</span>
      <span>{children}</span>
    </div>
  );
}
