import { useState } from "react";
import { Download, FileText, FileOutput } from "lucide-react";
import { save } from "@tauri-apps/plugin-dialog";
import { writeTextFile, writeFile } from "@tauri-apps/plugin-fs";
import { toast } from "sonner";
import { generatePdf, DEFAULT_SECTIONS, type IncludeSections } from "@/lib/pdf-generator";
import { computeBoq, type BoqRow } from "@/lib/boq";
import { PageHeader } from "@/components/PageHeader";
import { ReportSummaryPreview } from "@/components/ReportSummaryPreview";
import { StubBanner } from "@/components/StubBanner";
import { NumField } from "@/components/FormFields";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { haulPave } from "@/lib/haulpave-client";
import { useCalcStore } from "@/lib/store";
import type { CallError, PavementLayer } from "@/lib/types";
import { toSafeCsvCell } from "@/lib/utils";

export default function Reports() {
  const {
    cesaResult,
    cbrResult,
    trhResult,
    costResult,
    projectName,
    authorName,
    reportSummary,
    boqGeometry,
    setProjectName,
    setAuthorName,
    setReportSummary,
    setBoqGeometry,
  } = useCalcStore();

  const [running, setRunning] = useState(false);
  const [sections, setSections] = useState<IncludeSections>({ ...DEFAULT_SECTIONS });

  const hasData = !!(cesaResult || cbrResult || trhResult || costResult);

  const toggleSection = (key: keyof IncludeSections) =>
    setSections((prev) => ({ ...prev, [key]: !prev[key] }));

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
      const boqLayers = (cbrResult ?? trhResult)?.layers ?? [];
      const blob = generatePdf({
        projectName,
        authorName,
        generatedAt: new Date().toISOString(),
        cesaResult,
        cbrResult,
        trhResult,
        costResult,
        boqGeometry,
        boqLayers,
        includeSections: sections,
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

      <div className="flex flex-1 flex-col gap-4 overflow-auto p-6">
        <div className="grid gap-4 lg:grid-cols-[360px,1fr]">
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

            <div className="space-y-2">
              <p className="text-xs font-medium text-foreground">PDF sections</p>
              <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                <SectionToggle
                  id="sec-cesa"
                  label="CESA Analysis"
                  checked={sections.cesa}
                  disabled={!cesaResult}
                  onToggle={() => toggleSection("cesa")}
                />
                <SectionToggle
                  id="sec-cbr"
                  label="CBR Thickness"
                  checked={sections.cbr}
                  disabled={!cbrResult}
                  onToggle={() => toggleSection("cbr")}
                />
                <SectionToggle
                  id="sec-trh14"
                  label="TRH 14 Thickness"
                  checked={sections.trh14}
                  disabled={!trhResult}
                  onToggle={() => toggleSection("trh14")}
                />
                <SectionToggle
                  id="sec-cost"
                  label="Cost Comparison"
                  checked={sections.cost}
                  disabled={!costResult}
                  onToggle={() => toggleSection("cost")}
                />
                <SectionToggle
                  id="sec-boq"
                  label="Material BoQ"
                  checked={sections.boq}
                  disabled={!(cbrResult || trhResult)}
                  onToggle={() => toggleSection("boq")}
                />
              </div>
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
              <ReportSummaryPreview summary={reportSummary} />
            ) : (
              <p className="text-sm text-muted-foreground">
                Click "Generate summary" to build a design report from the most recent
                calculations.
              </p>
            )}
          </CardContent>
        </Card>
        </div>

        {(cbrResult || trhResult) && (
          <BoqSection
            layers={(cbrResult ?? trhResult)!.layers}
            geometry={boqGeometry}
            onGeometryChange={(field, value) =>
              setBoqGeometry({ ...boqGeometry, [field]: value })
            }
          />
        )}
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

function SectionToggle({
  id,
  label,
  checked,
  disabled,
  onToggle,
}: {
  id: string;
  label: string;
  checked: boolean;
  disabled: boolean;
  onToggle: () => void;
}) {
  return (
    <div className={`flex items-center gap-2 ${disabled ? "opacity-40" : ""}`}>
      <Checkbox
        id={id}
        checked={checked && !disabled}
        disabled={disabled}
        onCheckedChange={onToggle}
      />
      <label
        htmlFor={id}
        className={`text-xs ${disabled ? "cursor-not-allowed" : "cursor-pointer"} select-none`}
      >
        {label}
      </label>
    </div>
  );
}

function BoqSection({
  layers,
  geometry,
  onGeometryChange,
}: {
  layers: PavementLayer[];
  geometry: { roadLengthKm: number; roadWidthM: number; shoulderWidthM: number };
  onGeometryChange: (field: "roadLengthKm" | "roadWidthM" | "shoulderWidthM", value: number) => void;
}) {
  const rows: BoqRow[] = computeBoq(layers, geometry);

  const exportCsv = async () => {
    if (!rows.length) return;
    try {
      const path = await save({
        defaultPath: "material_boq.csv",
        filters: [{ name: "CSV", extensions: ["csv"] }],
      });
      if (!path) return;
      
      const header = ["Layer", "Thickness (mm)", "Area (m2)", "Volume (m3)", "Density (t/m3)", "Mass (t)"];
      const lines = [header.join(",")];
      let totalMass = 0;
      for (const r of rows) {
        lines.push([
          toSafeCsvCell(r.layer),
          r.thicknessMm.toFixed(0),
          r.areaM2.toFixed(1),
          r.volumeM3.toFixed(1),
          r.densityTm3.toFixed(1),
          r.massT.toFixed(1),
        ].join(","));
        totalMass += r.massT;
      }
      lines.push(`"Total mass",,,,,${totalMass.toFixed(1)}`);
      await writeTextFile(path, lines.join("\n"));
      toast.success(`Saved to ${path}`);
    } catch (err) {
      toast.error(`Export failed: ${String(err)}`);
    }
  };

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle>Material BoQ</CardTitle>
        <Button variant="outline" size="sm" onClick={exportCsv} disabled={!rows.length}>
          <Download className="mr-2 h-4 w-4" />
          Export CSV
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-3 gap-3">
          <NumField
            id="boq-length"
            label="Road length (km)"
            value={geometry.roadLengthKm}
            min={0.1}
            onChange={(v) => onGeometryChange("roadLengthKm", v)}
          />
          <NumField
            id="boq-width"
            label="Road width (m)"
            value={geometry.roadWidthM}
            min={1}
            onChange={(v) => onGeometryChange("roadWidthM", v)}
          />
          <NumField
            id="boq-shoulder"
            label="Shoulder width/side (m)"
            value={geometry.shoulderWidthM}
            min={0}
            onChange={(v) => onGeometryChange("shoulderWidthM", v)}
          />
        </div>

        <div className="overflow-auto rounded-md border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50 text-xs font-semibold text-muted-foreground">
                <th className="px-3 py-2 text-left">Layer</th>
                <th className="px-3 py-2 text-right">Thickness (mm)</th>
                <th className="px-3 py-2 text-right">Area (m²)</th>
                <th className="px-3 py-2 text-right">Volume (m³)</th>
                <th className="px-3 py-2 text-right">Density (t/m³)</th>
                <th className="px-3 py-2 text-right">Mass (t)</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr key={i} className="border-b last:border-0 hover:bg-muted/30">
                  <td className="px-3 py-2">{row.layer}</td>
                  <td className="px-3 py-2 text-right font-mono">{row.thicknessMm.toFixed(0)}</td>
                  <td className="px-3 py-2 text-right font-mono">{row.areaM2.toFixed(1)}</td>
                  <td className="px-3 py-2 text-right font-mono">{row.volumeM3.toFixed(1)}</td>
                  <td className="px-3 py-2 text-right font-mono">{row.densityTm3.toFixed(1)}</td>
                  <td className="px-3 py-2 text-right font-mono font-semibold">{row.massT.toFixed(1)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t bg-muted/50 font-semibold">
                <td className="px-3 py-2 text-xs text-muted-foreground" colSpan={5}>
                  Total mass
                </td>
                <td className="px-3 py-2 text-right font-mono">
                  {rows.reduce((acc, r) => acc + r.massT, 0).toFixed(1)} t
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
