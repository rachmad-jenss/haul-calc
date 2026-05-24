export type WorkflowStepId = "fleet" | "pavement" | "economics" | "report";

export type WorkflowStepStatus = "done" | "current" | "upcoming";

export type WorkflowStep = {
  id: WorkflowStepId;
  label: string;
  route: string;
  status: WorkflowStepStatus;
};

export type WorkflowGuidanceState = {
  cesaResult: unknown;
  cesaDirty: boolean;
  cbrResult: unknown;
  trhResult: unknown;
  pavementDirty: boolean;
  costResult: unknown;
  economicsDirty: boolean;
  reportSummary: unknown;
};

function stepComplete(hasResult: boolean, dirty: boolean): boolean {
  return hasResult && !dirty;
}

export function buildWorkflowSteps(state: WorkflowGuidanceState): WorkflowStep[] {
  const fleetDone = stepComplete(Boolean(state.cesaResult), state.cesaDirty);
  const pavementDone = stepComplete(
    Boolean(state.cbrResult || state.trhResult),
    state.pavementDirty,
  );
  const economicsDone = stepComplete(Boolean(state.costResult), state.economicsDirty);
  const reportDone = Boolean(state.reportSummary);

  const completions = [fleetDone, pavementDone, economicsDone, reportDone];
  const currentIndex = completions.findIndex((done) => !done);
  const activeIndex = currentIndex === -1 ? completions.length - 1 : currentIndex;

  const defs: { id: WorkflowStepId; label: string; route: string }[] = [
    { id: "fleet", label: "Fleet & Traffic", route: "/fleet" },
    { id: "pavement", label: "Pavement Design", route: "/pavement" },
    { id: "economics", label: "Economics", route: "/economics" },
    { id: "report", label: "Reports", route: "/reports" },
  ];

  return defs.map((def, index) => {
    let status: WorkflowStepStatus = "upcoming";
    if (completions[index]) status = "done";
    else if (index === activeIndex) status = "current";
    return { ...def, status };
  });
}

export function workflowDismissStorageKey(projectName: string): string {
  const slug = projectName.trim() || "untitled";
  return `haulcalc-workflow-banner-dismissed:${slug}`;
}
