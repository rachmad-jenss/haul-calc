import { AlertTriangle } from "lucide-react";

export function WarningBanner({ message }: { message?: string }) {
  return (
    <div
      role="alert"
      aria-live="polite"
      className="flex items-start gap-3 rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-sm text-warning-foreground"
    >
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
      <div>
        <span className="font-medium">Warning.</span>{" "}
        <span className="text-warning-foreground/80">
          {message ?? "An issue was detected with the calculation inputs."}
        </span>
      </div>
    </div>
  );
}
