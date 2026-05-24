import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { CheckCircle2, Circle, CircleDot, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCalcStore } from "@/lib/store";
import {
  buildWorkflowSteps,
  workflowDismissStorageKey,
  type WorkflowStep,
} from "@/lib/workflow-guidance";
import { cn } from "@/lib/utils";

function StepIcon({ status }: { status: WorkflowStep["status"] }) {
  if (status === "done") {
    return <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />;
  }
  if (status === "current") {
    return <CircleDot className="h-4 w-4 shrink-0 text-primary" />;
  }
  return <Circle className="h-4 w-4 shrink-0 text-muted-foreground" />;
}

export function WorkflowGuidanceBanner() {
  const {
    projectName,
    cesaResult,
    cesaDirty,
    cbrResult,
    trhResult,
    pavementDirty,
    costResult,
    economicsDirty,
    reportSummary,
  } = useCalcStore();

  const steps = buildWorkflowSteps({
    cesaResult,
    cesaDirty,
    cbrResult,
    trhResult,
    pavementDirty,
    costResult,
    economicsDirty,
    reportSummary,
  });

  const allDone = steps.every((s) => s.status === "done");
  const dismissKey = workflowDismissStorageKey(projectName);

  const [dismissed, setDismissed] = useState(() => {
    try {
      return sessionStorage.getItem(dismissKey) === "1";
    } catch {
      return false;
    }
  });

  useEffect(() => {
    try {
      setDismissed(sessionStorage.getItem(dismissKey) === "1");
    } catch {
      setDismissed(false);
    }
  }, [dismissKey]);

  if (dismissed || allDone) return null;

  const dismiss = () => {
    try {
      sessionStorage.setItem(dismissKey, "1");
    } catch {
      // ignore quota / private mode
    }
    setDismissed(true);
  };

  return (
    <div
      role="region"
      aria-label="Project workflow guidance"
      className="mx-6 mt-4 rounded-lg border border-primary/20 bg-primary/5 px-4 py-3"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium">Recommended workflow</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Fleet → Pavement → Economics → Report. Continue with the highlighted step.
          </p>
          <ol className="mt-3 flex flex-wrap gap-x-4 gap-y-2">
            {steps.map((step) => (
              <li key={step.id}>
                <Link
                  to={step.route}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-md px-1 py-0.5 text-sm outline-none transition-colors",
                    "hover:bg-accent/60 focus-visible:ring-2 focus-visible:ring-ring",
                    step.status === "current" && "font-medium text-foreground",
                    step.status === "upcoming" && "text-muted-foreground",
                  )}
                  aria-current={step.status === "current" ? "step" : undefined}
                >
                  <StepIcon status={step.status} />
                  {step.label}
                </Link>
              </li>
            ))}
          </ol>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8 shrink-0"
          onClick={dismiss}
          aria-label="Dismiss workflow guidance for this session"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
