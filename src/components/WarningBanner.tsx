import { AlertTriangle } from "lucide-react";

export function WarningBanner({ message }: { message?: string }) {
  return (
    <div
      role="alert"
      aria-live="polite"
      className="flex items-start gap-3 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-900 dark:text-amber-100"
    >
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
      <div>
        <span className="font-medium">Warning.</span>{" "}
        <span className="text-amber-800/80 dark:text-amber-100/80">
          {message ?? "An issue was detected with the calculation inputs."}
        </span>
      </div>
    </div>
  );
}
