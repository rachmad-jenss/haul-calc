import { IconRefresh2Outline18 } from "nucleo-ui-essential-outline-18";
import { Button } from "@/components/ui/button";
import { nucleoIconProps } from "@/lib/icons";

type ResultStaleBadgeProps = {
  onRecalculate: () => void;
  recalculating?: boolean;
};

export function ResultStaleBadge({ onRecalculate, recalculating }: ResultStaleBadgeProps) {
  return (
    <div className="flex items-center gap-2">
      <span className="rounded bg-warning/15 px-1.5 py-0.5 text-2xs font-medium uppercase text-warning-foreground">
        Stale
      </span>
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="h-6 gap-1 px-2 text-2xs"
        onClick={onRecalculate}
        disabled={recalculating}
        aria-label="Recalculate with current inputs"
      >
        <IconRefresh2Outline18
          {...nucleoIconProps({
            size: 12,
            className: recalculating ? "animate-spin" : undefined,
          })}
          aria-hidden
        />
        {recalculating ? "Recalculating…" : "Recalculate"}
      </Button>
    </div>
  );
}
