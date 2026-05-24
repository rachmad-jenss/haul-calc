import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

type ResultStaleBadgeProps = {
  onRecalculate: () => void;
  recalculating?: boolean;
};

export function ResultStaleBadge({ onRecalculate, recalculating }: ResultStaleBadgeProps) {
  return (
    <div className="flex items-center gap-2">
      <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium uppercase text-amber-700 dark:bg-amber-900/40 dark:text-amber-400">
        Stale
      </span>
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="h-6 gap-1 px-2 text-[10px]"
        onClick={onRecalculate}
        disabled={recalculating}
        aria-label="Recalculate with current inputs"
      >
        <RefreshCw className={recalculating ? "h-3 w-3 animate-spin" : "h-3 w-3"} />
        {recalculating ? "Recalculating…" : "Recalculate"}
      </Button>
    </div>
  );
}
