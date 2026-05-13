import { useState } from "react";
import { Download, FileText, FileOutput } from "lucide-react";
import { save } from "@tauri-apps/plugin-dialog";
import { writeTextFile, writeFile } from "@tauri-apps/plugin-fs";
import { toast } from "sonner";
import { generatePdf } from "@/lib/pdf-generator";
import { PageHeader } from "@/components/PageHeader";
import { StubBanner } from "@/components/StubBanner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { haulPave } from "@/lib/haulpave-client";
import { useCalcStore } from "@/lib/store";
import type { CallError } from "@/lib/types";

export default function Reports() {
  const {
    cesaResult,
    cbrResult,
    trhResult,
    costResult,
    projectName,
    authorName,
    reportSummary,
    setProjectName,
    setAuthorName,
    setReportSummary,
  } = useCalcStore();

  const [running, setRunning] = useState(false);

  const hasData = !!(cesaResult || cbrResult || trhResult || costResult);

  const generate = async () => {
    setRunning(true);
    try {
      const res = await haulPave.buildSummary({
        project_name: projectName,
        author: authorName,
        cesa: cesaResult
          ? {
              cesa: cesaResult.cesa,
              design_coverages: cesaResult.design_coverages,
              design_life_years: cesaResult.design_life_years,
            }
          : undefined,
        pavement_cbr: cbrResult
          ? {
              method: cbrResult.method,
              total_thickness_mm: cbrResult.total_thickness_mm,
              layers: cbrResult.layers,
            }
          : undefined,
        pavement_trh14: trhResult
          ? {
              method: trhResult.method,
              total_thickness_mm: trhResult.total_thickness_mm,
              layers: trhResult.layers,
            }
          : undefined,
        cost_comparison: costResult
          ? { scenarios: costResult.scenarios }
          : undefined,
      });
      setReportSummary(res.data, res.stub, res.stubMessage);
    } catch (err) {
      const e = err as CallError;
      toast.error(`build_summary failed: ${e.message}`);
    } finally {
      setRunning(false);
    }
  };

  const exportJson = async () => {
    if (!reportSummary) return;
    try {
      const path = await save({
        defaultPath: `${projectName.replace(/\s+/g, "_")}.json`,
        filters: [{ name: "JSON", extensions: ["json"] }],
      });
      if (!path) return;
      const { stub: _s, stubMessage: _sm, ...data } = reportSummary;
      await writeTextFile(path, JSON.stringify(data, null, 2));
      toast.success(`Saved to ${path}`);
    } catch (err) {
      toast.error(`Export failed: ${(err as Error).message}`);
    }
  };

  const exportPdf = async () => {
    if (!reportSummary) return;
    try {
      const blob = generatePdf({
        projectName,
        authorName,
        generatedAt: new Date().toISOString(),
        cesaResult,
        cbrResult,
        trhResult,
        costResult,
      });
      const path = await save({
        defaultPath: `${projectName.replace(/\s+/g, "_")}.pdf`,
        filters: [{ name: "PDF", extensions: ["pdf"] }],
      });
      if (!path) return;
      const bytes = new Uint8Array(await blob.arrayBuffer());
      await writeFile(path, bytes);
      toast.success(`Saved to ${path}`);
    } catch (err) {
      toast.error(`PDF export failed: ${(err as Error).message}`);
    }
  };

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        title="Reports"
        description="Generate a versioned design summary for the current calculation set."
        actions={
          <>
            <Button variant="outline" onClick={generate} disabled={running}>
              <FileText className="h-4 w-4" />
              {running ? "Generating..." : "Generate summary"}
            </Button>
            <Button variant="outline" onClick={exportPdf} disabled={!reportSummary}>
              <FileOutput className="h-4 w-4" />
              Export PDF
            </Button>
            <Button onClick={exportJson} disabled={!reportSummary}>
              <Download className="h-4 w-4" />
              Export JSON
            </Button>
          </>
        }
      />

      <div className="grid flex-1 gap-4 overflow-auto p-6 lg:grid-cols-[360px,1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Metadata</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="project">Project name</Label>
              <Input
                id="project"
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="author">Author / engineer</Label>
              <Input
                id="author"
                value={authorName}
                onChange={(e) => setAuthorName(e.target.value)}
                placeholder="Name, certification"
              />
            </div>
            <div className="rounded-md border bg-muted/50 p-3 text-xs text-muted-foreground space-y-1">
              <p className="font-medium text-foreground">Data available</p>
              <DataBadge label="CESA" active={!!cesaResult} />
              <DataBadge label="CBR thickness" active={!!cbrResult} />
              <DataBadge label="TRH 14 thickness" active={!!trhResult} />
              <DataBadge label="Cost comparison" active={!!costResult} />
              {!hasData && (
                <p className="pt-1 text-xs text-amber-600">
                  Run calculations on other tabs first for a complete report.
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="overflow-hidden">
          <CardHeader>
            <CardTitle>Summary preview</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {reportSummary?.stub ? <StubBanner message={reportSummary.stubMessage} /> : null}
            {reportSummary ? (
              <pre className="max-h-[480px] overflow-auto rounded-md bg-muted p-3 text-xs leading-relaxed">
                {JSON.stringify(reportSummary, null, 2)}
              </pre>
            ) : (
              <p className="text-sm text-muted-foreground">
                Click "Generate summary" to build a design report from the most recent
                calculations.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function DataBadge({ label, active }: { label: string; active: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <span
        className={`h-2 w-2 rounded-full ${active ? "bg-emerald-500" : "bg-muted-foreground/30"}`}
      />
      <span className={active ? "text-foreground" : ""}>{label}</span>
    </div>
  );
}
