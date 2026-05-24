import { useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { readTextFile } from "@tauri-apps/plugin-fs";
import { toast } from "sonner";
import { FolderOpen, X, Plus, Trophy } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { parseSnapshot, type Snapshot } from "@/lib/project-file";
import { resolveActiveFilePath } from "@/lib/file-binding";
import { useCalcStore } from "@/lib/store";

interface LoadedProject {
  filePath: string;
  fileName: string;
  snapshot: Snapshot;
}

function fmt(n: number | undefined | null, decimals = 0): string {
  if (n == null) return "—";
  return n.toLocaleString(undefined, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

function bestIdx(values: (number | null)[], mode: "min" | "max"): number | null {
  let best: number | null = null;
  let idx: number | null = null;
  for (let i = 0; i < values.length; i++) {
    const v = values[i];
    if (v == null) continue;
    if (best == null || (mode === "min" ? v < best : v > best)) {
      best = v;
      idx = i;
    }
  }
  return idx;
}

export default function Compare() {
  const [projects, setProjects] = useState<LoadedProject[]>([]);
  const [loading, setLoading] = useState(false);
  const { activeFileName, activeFilePath, recentFiles } = useCalcStore();
  const workspacePath = resolveActiveFilePath({ activeFilePath, activeFileName, recentFiles });
  const workspaceLabel = activeFileName ?? (workspacePath ? workspacePath.replace(/^.*[/\\]/, "") : null);

  const addFiles = async () => {
    const filePaths = await open({
      filters: [{ name: "HaulCalc Project", extensions: ["hcalc"] }],
      multiple: true,
    });

    if (!filePaths || !Array.isArray(filePaths) || filePaths.length === 0) return;

    setLoading(true);
    try {
      const existing = new Set(projects.map((p) => p.filePath));
      const newProjects: LoadedProject[] = [];

      for (const fp of filePaths) {
        if (existing.has(fp)) continue;
        if (projects.length + newProjects.length >= 4) {
          toast.warning("Maximum 4 projects for comparison.");
          break;
        }
        try {
          const text = await readTextFile(fp);
          const snapshot = parseSnapshot(text);
          const parts = fp.replace(/\\/g, "/").split("/");
          newProjects.push({
            filePath: fp,
            fileName: parts[parts.length - 1],
            snapshot,
          });
        } catch {
          toast.error(`Failed to load: ${fp}`);
        }
      }

      setProjects((prev) => [...prev, ...newProjects]);
    } finally {
      setLoading(false);
    }
  };

  const removeProject = (filePath: string) => {
    setProjects((prev) => prev.filter((p) => p.filePath !== filePath));
  };

  const hasProjects = projects.length >= 2;

  return (
    <div className="flex flex-col">
      <PageHeader
        title="Compare Projects"
        description="Load 2–4 .hcalc files and compare key results side-by-side"
        actions={
          <Button onClick={addFiles} disabled={loading || projects.length >= 4}>
            <Plus className="mr-2 h-4 w-4" />
            {projects.length === 0 ? "Load Files" : "Add File"}
          </Button>
        }
      />

      <div className="space-y-6 p-6">
        <Card className="border-dashed bg-muted/20">
          <CardContent className="py-3 text-sm text-muted-foreground">
            <p>
              <span className="font-medium text-foreground">Read-only comparison.</span>{" "}
              Files loaded here are not opened in the main workspace and do not change your
              active project.
            </p>
            <p className="mt-1">
              {workspaceLabel ? (
                <>
                  Save (Ctrl+S) still applies to{" "}
                  <span className="font-medium text-foreground">{workspaceLabel}</span>.
                </>
              ) : (
                <>
                  No project file is bound in the workspace — use{" "}
                  <span className="font-medium text-foreground">Open (Ctrl+O)</span> in the sidebar to
                  edit a project.
                </>
              )}
            </p>
          </CardContent>
        </Card>

        {projects.length === 0 && (
          <Card>
            <CardContent className="flex flex-col items-center gap-4 py-12">
              <FolderOpen className="h-12 w-12 text-muted-foreground" />
              <div className="text-center">
                <p className="font-medium">No projects loaded</p>
                <p className="text-sm text-muted-foreground">
                  Click "Load Files" to select 2–4 .hcalc project files for comparison.
                </p>
              </div>
              <Button onClick={addFiles} disabled={loading}>
                <FolderOpen className="mr-2 h-4 w-4" />
                Select Files
              </Button>
            </CardContent>
          </Card>
        )}

        {projects.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {projects.map((p) => (
              <div
                key={p.filePath}
                className="flex items-center gap-2 rounded-md border bg-card px-3 py-1.5 text-sm"
              >
                <span className="font-medium">{p.snapshot.projectName || p.fileName}</span>
                <span className="text-muted-foreground">({p.fileName})</span>
                <button
                  onClick={() => removeProject(p.filePath)}
                  className="rounded p-0.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
            {projects.length < 2 && (
              <p className="self-center text-sm text-muted-foreground">
                Add at least one more file to compare.
              </p>
            )}
          </div>
        )}

        {hasProjects && (
          <>
            <ComparisonSection title="Design Parameters" projects={projects}>
              <Row label="Design life (years)" values={projects.map((p) => p.snapshot.designLifeYears)} />
              <Row label="Subgrade CBR" values={projects.map((p) => p.snapshot.subgradeCbr)} />
              <Row label="Coverages" values={projects.map((p) => p.snapshot.coverages)} mode="min" />
              <Row label="Fleet size" values={projects.map((p) => p.snapshot.fleet?.length ?? null)} />
            </ComparisonSection>

            <ComparisonSection title="CESA" projects={projects}>
              <Row
                label="CESA"
                values={projects.map((p) => p.snapshot.cesaResult?.cesa ?? null)}
                mode="min"
              />
              <Row
                label="Design coverages"
                values={projects.map((p) => p.snapshot.cesaResult?.design_coverages ?? null)}
                mode="min"
              />
            </ComparisonSection>

            <ComparisonSection title="Pavement Thickness" projects={projects}>
              <Row
                label="USACE total (mm)"
                values={projects.map((p) => p.snapshot.cbrResult?.total_thickness_mm ?? null)}
                mode="min"
              />
              <Row
                label="TRH 14 total (mm)"
                values={projects.map((p) => p.snapshot.trhResult?.total_thickness_mm ?? null)}
                mode="min"
              />
              <Row
                label="TRH 14 category"
                textValues={projects.map((p) => p.snapshot.trhCategory ?? "—")}
              />
            </ComparisonSection>

            <ComparisonSection title="Operating Costs (USD/yr)" projects={projects}>
              {(() => {
                const maxScenarios = Math.max(
                  ...projects.map((p) => p.snapshot.costResult?.scenarios?.length ?? 0),
                );
                if (maxScenarios === 0) {
                  return (
                    <tr>
                      <td colSpan={projects.length + 1} className="px-4 py-3 text-center text-sm text-muted-foreground">
                        No cost data available in loaded projects.
                      </td>
                    </tr>
                  );
                }
                const rows: React.ReactNode[] = [];
                for (let i = 0; i < maxScenarios; i++) {
                  const scenarioNames = projects.map(
                    (p) => p.snapshot.costResult?.scenarios?.[i]?.name ?? null,
                  );
                  const label = scenarioNames.find((n) => n != null) ?? `Scenario ${i + 1}`;

                  const tire = projects.map(
                    (p) => p.snapshot.costResult?.scenarios?.[i]?.tire_cost_usd_per_year ?? null,
                  );
                  const fuel = projects.map(
                    (p) => p.snapshot.costResult?.scenarios?.[i]?.fuel_cost_usd_per_year ?? null,
                  );
                  const maint = projects.map(
                    (p) => p.snapshot.costResult?.scenarios?.[i]?.maintenance_cost_usd_per_year ?? null,
                  );
                  const total = projects.map((_, j) => {
                    const t = tire[j];
                    const f = fuel[j];
                    const m = maint[j];
                    if (t == null && f == null && m == null) return null;
                    return (t ?? 0) + (f ?? 0) + (m ?? 0);
                  });

                  rows.push(
                    <tr key={`hdr-${i}`} className="bg-muted/30">
                      <td colSpan={projects.length + 1} className="px-4 py-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        {label}
                      </td>
                    </tr>,
                    <Row key={`tire-${i}`} label="Tire" values={tire} decimals={0} mode="min" />,
                    <Row key={`fuel-${i}`} label="Fuel" values={fuel} decimals={0} mode="min" />,
                    <Row key={`maint-${i}`} label="Maintenance" values={maint} decimals={0} mode="min" />,
                    <Row key={`total-${i}`} label="Total" values={total} decimals={0} mode="min" bold />,
                  );
                }
                return rows;
              })()}
            </ComparisonSection>
          </>
        )}
      </div>
    </div>
  );
}

function ComparisonSection({
  title,
  projects,
  children,
}: {
  title: string;
  projects: LoadedProject[];
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="px-4 py-2 text-left font-medium text-muted-foreground">Metric</th>
                {projects.map((p) => (
                  <th key={p.filePath} className="px-4 py-2 text-right font-medium">
                    {p.snapshot.projectName || p.fileName}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y">{children}</tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

function Row({
  label,
  values,
  textValues,
  decimals = 0,
  mode,
  bold,
}: {
  label: string;
  values?: (number | null)[];
  textValues?: string[];
  decimals?: number;
  mode?: "min" | "max";
  bold?: boolean;
}) {
  const best = values && mode ? bestIdx(values, mode) : null;

  return (
    <tr>
      <td className={`px-4 py-2 text-muted-foreground ${bold ? "font-semibold" : ""}`}>{label}</td>
      {textValues
        ? textValues.map((v, i) => (
            <td key={i} className="px-4 py-2 text-right">
              {v}
            </td>
          ))
        : values?.map((v, i) => (
            <td
              key={i}
              className={`px-4 py-2 text-right ${bold ? "font-semibold" : ""} ${
                best === i ? "text-green-600 dark:text-green-400" : ""
              }`}
            >
              <span className="inline-flex items-center gap-1">
                {fmt(v, decimals)}
                {best === i && <Trophy className="inline h-3.5 w-3.5" />}
              </span>
            </td>
          ))}
    </tr>
  );
}
