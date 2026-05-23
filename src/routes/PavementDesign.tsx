import { useEffect, useState } from "react";
import { Calculator, ArrowDownToLine, AlertTriangle, Layers } from "lucide-react";
import { CustomMaterialModal } from "@/components/CustomMaterialModal";
import { MaterialLibraryPanel } from "@/components/MaterialLibraryPanel";
import { PavementCrossSection } from "@/components/PavementCrossSection";
import { toast } from "sonner";
import { PageHeader } from "@/components/PageHeader";
import { StubBanner } from "@/components/StubBanner";
import { WarningBanner } from "@/components/WarningBanner";
import { FieldError, NumField } from "@/components/FormFields";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { customMaterialsToRpc } from "@/lib/custom-materials-rpc";
import { haulPave } from "@/lib/haulpave-client";
import { cbrRequestSchema, fieldErrorsFromZod, trh14RequestSchema } from "@/lib/schemas";
import { cn } from "@/lib/utils";
import { useCalcStore } from "@/lib/store";
import type {
  CallError,
  CompareMethodsResult,
  MaterialTemplate,
  PavementResult,
} from "@/lib/types";
import { convertThickness, unitLabels } from "@/lib/unit-convert";
import { formatNumber, parseNumericInput } from "@/lib/utils";

export default function PavementDesign() {
  const {
    cesaResult,
    subgradeCbr,
    coverages,
    trhCategory,
    cbrResult,
    trhResult,
    pavementDirty,
    customMaterials,
    setSubgradeCbr,
    setCoverages,
    setTrhCategory,
    setCbrResult,
    setTrhResult,
  } = useCalcStore();

  const [running, setRunning] = useState(false);
  const [compareResult, setCompareResult] = useState<(CompareMethodsResult & { stub: boolean; stubMessage?: string }) | null>(null);
  const [comparing, setComparing] = useState(false);
  const [showCustomMaterialModal, setShowCustomMaterialModal] = useState(false);
  const [catalogPrefill, setCatalogPrefill] = useState<MaterialTemplate | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const validateInputs = (): boolean => {
    const errors: Record<string, string> = {};
    const cbrParsed = cbrRequestSchema.safeParse({
      subgrade_cbr: subgradeCbr,
      design_coverages: coverages,
    });
    if (!cbrParsed.success) Object.assign(errors, fieldErrorsFromZod(cbrParsed.error));
    const trhParsed = trh14RequestSchema.safeParse({
      category: trhCategory,
      design_coverages: coverages,
    });
    if (!trhParsed.success) {
      for (const [k, v] of Object.entries(fieldErrorsFromZod(trhParsed.error))) {
        if (!(k in errors)) errors[k] = v;
      }
    }
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) {
      const summary = Object.values(errors)[0];
      toast.error(summary ?? "Validation error");
      return false;
    }
    return true;
  };

  useEffect(() => {
    setCompareResult(null);
  }, [subgradeCbr, coverages, trhCategory, customMaterials]);

  const importFromCesa = () => {
    if (cesaResult) {
      setCoverages(cesaResult.design_coverages);
      toast.success("Design coverages imported from CESA result.");
    }
  };

  const compare = async () => {
    if (!validateInputs()) return;
    const cbrParsed = cbrRequestSchema.safeParse({
      subgrade_cbr: subgradeCbr,
      design_coverages: coverages,
    });
    if (!cbrParsed.success) return;
    const trhParsed = trh14RequestSchema.safeParse({
      category: trhCategory,
      design_coverages: coverages,
    });
    if (!trhParsed.success) return;
    const materialsRpc = customMaterialsToRpc(customMaterials);
    const materialParams = materialsRpc ? { custom_materials: materialsRpc } : {};
    setComparing(true);
    try {
      const [cbrRes, trhRes] = await Promise.all([
        haulPave.cbrThickness({ ...cbrParsed.data, ...materialParams }),
        haulPave.trh14Thickness({ ...trhParsed.data, ...materialParams }),
      ]);

      setCbrResult(cbrRes.data, cbrRes.stub, cbrRes.stubMessage);
      setTrhResult(trhRes.data, trhRes.stub, trhRes.stubMessage);

      const usace = {
        method: cbrRes.data.method,
        total_thickness_mm: cbrRes.data.total_thickness_mm,
        total_coverages: coverages,
        total_cesa: cesaResult?.cesa,
        confidence: cbrRes.data.confidence,
        material_class: cbrRes.data.material_class,
        warning: cbrRes.data.warning,
      };
      const trh14 = {
        method: trhRes.data.method,
        total_thickness_mm: trhRes.data.total_thickness_mm,
        total_coverages: coverages,
        confidence: trhRes.data.confidence,
        material_class: trhRes.data.material_class,
        warning: trhRes.data.warning,
      };
      const confidence =
        CONFIDENCE_RANK[usace.confidence] <= CONFIDENCE_RANK[trh14.confidence]
          ? usace.confidence
          : trh14.confidence;
      const stubMessages = [cbrRes.stubMessage, trhRes.stubMessage].filter(Boolean);

      setCompareResult({
        usace,
        trh14,
        delta_mm: Math.abs(usace.total_thickness_mm - trh14.total_thickness_mm),
        subgrade_cbr: subgradeCbr,
        confidence,
        stub: cbrRes.stub || trhRes.stub,
        stubMessage: stubMessages.length > 0 ? stubMessages.join(" · ") : undefined,
      });
    } catch (err) {
      const e = err as CallError;
      toast.error(`comparison failed: ${e.message}`);
    } finally {
      setComparing(false);
    }
  };

  const compute = async () => {
    if (!validateInputs()) return;
    const cbrParsed = cbrRequestSchema.safeParse({
      subgrade_cbr: subgradeCbr,
      design_coverages: coverages,
    });
    if (!cbrParsed.success) return;
    const trhParsed = trh14RequestSchema.safeParse({
      category: trhCategory,
      design_coverages: coverages,
    });
    if (!trhParsed.success) return;
    const materialsRpc = customMaterialsToRpc(customMaterials);
    const materialParams = materialsRpc ? { custom_materials: materialsRpc } : {};

    setRunning(true);
    try {
      const [cbrRes, trhRes] = await Promise.all([
        haulPave.cbrThickness({ ...cbrParsed.data, ...materialParams }),
        haulPave.trh14Thickness({ ...trhParsed.data, ...materialParams }),
      ]);
      setCbrResult(cbrRes.data, cbrRes.stub, cbrRes.stubMessage);
      setTrhResult(trhRes.data, trhRes.stub, trhRes.stubMessage);
    } catch (err) {
      const e = err as CallError;
      toast.error(`thickness calc failed: ${e.message}`);
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        title="Pavement Design"
        description="Compute layer thicknesses via USACE CBR and TRH 14 methods."
        actions={
          <Button onClick={compute} disabled={running}>
            <Calculator className="h-4 w-4" />
            {running ? "Computing..." : "Compute thickness"}
          </Button>
        }
      />

      <div className="grid flex-1 gap-4 overflow-auto p-6 lg:grid-cols-[360px,1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Inputs</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1">
              <NumField
                id="subgrade-cbr"
                label="Subgrade CBR (%)"
                value={subgradeCbr}
                error={fieldErrors.subgrade_cbr}
                onChange={(v) => {
                  setFieldErrors((prev) => {
                    if (!("subgrade_cbr" in prev)) return prev;
                    const next = { ...prev };
                    delete next.subgrade_cbr;
                    return next;
                  });
                  setSubgradeCbr(v);
                }}
                min={1}
                max={50}
              />
              {subgradeCbr < 3 && (
                <p className="flex items-center gap-1 text-[11px] text-amber-600 dark:text-amber-400">
                  <AlertTriangle className="h-3 w-3 shrink-0" />
                  Very weak subgrade — consider soil improvement
                </p>
              )}
              {subgradeCbr > 30 && (
                <p className="flex items-center gap-1 text-[11px] text-amber-600 dark:text-amber-400">
                  <AlertTriangle className="h-3 w-3 shrink-0" />
                  CBR &gt; 30% is unusually strong for native subgrade
                </p>
              )}
            </div>
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <Label htmlFor="coverages">Design coverages</Label>
                {cesaResult && (
                  <button
                    type="button"
                    onClick={importFromCesa}
                    className="flex items-center gap-1 text-xs text-primary hover:underline"
                  >
                    <ArrowDownToLine className="h-3 w-3" />
                    Import from CESA ({formatNumber(cesaResult.design_coverages, 0)})
                  </button>
                )}
              </div>
              <Input
                id="coverages"
                type="number"
                min={1}
                value={coverages}
                aria-invalid={fieldErrors.design_coverages ? true : undefined}
                className={cn(fieldErrors.design_coverages && "border-destructive")}
                onChange={(e) => {
                  setFieldErrors((prev) => {
                    if (!("design_coverages" in prev)) return prev;
                    const next = { ...prev };
                    delete next.design_coverages;
                    return next;
                  });
                  setCoverages(Math.max(1, parseNumericInput(e.target.value, coverages)));
                }}
              />
              <FieldError message={fieldErrors.design_coverages} />
              {coverages > 2_000_000 && (
                <p className="flex items-center gap-1 text-[11px] text-amber-600 dark:text-amber-400">
                  <AlertTriangle className="h-3 w-3 shrink-0" />
                  Very high coverages — verify CESA computation
                </p>
              )}
              {coverages > 0 && coverages < 10_000 && (
                <p className="flex items-center gap-1 text-[11px] text-amber-600 dark:text-amber-400">
                  <AlertTriangle className="h-3 w-3 shrink-0" />
                  Very low coverages — verify fleet traffic inputs
                </p>
              )}
            </div>
            <div className="space-y-1">
              <Label htmlFor="category">TRH 14 category</Label>
              <select
                id="category"
                value={trhCategory}
                onChange={(e) => {
                  setFieldErrors((prev) => {
                    if (!("category" in prev)) return prev;
                    const next = { ...prev };
                    delete next.category;
                    return next;
                  });
                  setTrhCategory(e.target.value as "A" | "B" | "C" | "D");
                }}
                className={cn(
                  "h-9 w-full rounded-md border border-input bg-background px-3 text-sm",
                  fieldErrors.category && "border-destructive",
                )}
                aria-invalid={fieldErrors.category ? true : undefined}
              >
                <option value="A">A — heavily trafficked</option>
                <option value="B">B — primary</option>
                <option value="C">C — secondary</option>
                <option value="D">D — light</option>
              </select>
              <FieldError message={fieldErrors.category} />
            </div>

            <div className="space-y-2 border-t pt-3">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Materials
              </p>
              <MaterialLibraryPanel
                onPickTemplate={(t) => {
                  setCatalogPrefill(t);
                  setShowCustomMaterialModal(true);
                  toast.info(`Prefilled "${t.name}" — review and add to project.`);
                }}
              />
              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={() => {
                  setCatalogPrefill(null);
                  setShowCustomMaterialModal(true);
                }}
              >
                <Layers className="mr-2 h-4 w-4" />
                Custom materials…
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center gap-2">
            <CardTitle>Recommended structure</CardTitle>
            {(cbrResult || trhResult) && pavementDirty && (
              <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium uppercase text-amber-700 dark:bg-amber-900/40 dark:text-amber-400">
                Stale
              </span>
            )}
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="cbr">
              <TabsList>
                <TabsTrigger value="cbr">USACE CBR</TabsTrigger>
                <TabsTrigger value="trh14">TRH 14</TabsTrigger>
                <TabsTrigger value="compare">Compare</TabsTrigger>
              </TabsList>
              <TabsContent value="cbr" className="space-y-3">
                {cbrResult?.stub ? <StubBanner message={cbrResult.stubMessage} /> : null}
                {cbrResult?.warning ? <WarningBanner message={cbrResult.warning} /> : null}
                <PavementChart result={cbrResult ?? undefined} />
              </TabsContent>
              <TabsContent value="trh14" className="space-y-3">
                {trhResult?.stub ? <StubBanner message={trhResult.stubMessage} /> : null}
                {trhResult?.warning ? <WarningBanner message={trhResult.warning} /> : null}
                <PavementChart result={trhResult ?? undefined} />
              </TabsContent>
              <TabsContent value="compare" className="space-y-3">
                <div className="flex justify-end">
                  <Button size="sm" onClick={compare} disabled={comparing}>
                    <Calculator className="h-4 w-4" />
                    {comparing ? "Comparing..." : "Run comparison"}
                  </Button>
                </div>
                {compareResult?.stub ? <StubBanner message={compareResult.stubMessage} /> : null}
                {compareResult?.usace?.warning ? <WarningBanner message={compareResult.usace.warning} /> : null}
                {compareResult?.trh14?.warning ? <WarningBanner message={compareResult.trh14.warning} /> : null}
                {compareResult?.warnings?.map((msg) => (
                  <WarningBanner key={msg} message={msg} />
                ))}
                <MethodComparisonPanel result={compareResult ?? undefined} />
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>

      <CustomMaterialModal
        open={showCustomMaterialModal}
        onOpenChange={setShowCustomMaterialModal}
        catalogPrefill={catalogPrefill}
      />
    </div>
  );
}

const CONFIDENCE_RANK: Record<"low" | "medium" | "high", number> = {
  low: 0,
  medium: 1,
  high: 2,
};

const CONFIDENCE_COLOR: Record<string, string> = {
  high: "bg-emerald-100 text-emerald-800",
  medium: "bg-amber-100 text-amber-800",
  low: "bg-red-100 text-red-800",
};

function MethodComparisonPanel({ result }: { result?: CompareMethodsResult }) {
  if (!result) {
    return (
      <p className="text-sm text-muted-foreground">
        Click "Run comparison" to compare USACE CBR and TRH 14 methods side-by-side.
      </p>
    );
  }

  if (!result.usace || !result.trh14) {
    return (
      <p className="text-sm text-destructive">
        Comparison result is incomplete. Please try again.
      </p>
    );
  }

  const winner = result.usace.total_thickness_mm <= result.trh14.total_thickness_mm ? "usace" : "trh14";

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        {(["usace", "trh14"] as const).map((key) => {
          const m = result[key];
          const isWinner = key === winner;
          return (
            <div
              key={key}
              className={`rounded-lg border p-4 ${isWinner ? "border-primary bg-primary/5" : ""}`}
            >
              <div className="mb-2 flex items-start justify-between gap-2">
                <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {key === "usace" ? "USACE CBR" : "TRH 14"}
                </span>
                {isWinner && (
                  <span className="rounded bg-primary px-1.5 py-0.5 text-[10px] font-semibold text-primary-foreground">
                    Recommended
                  </span>
                )}
              </div>
              <div
                className="mb-1 font-mono text-2xl font-bold"
                data-testid={`compare-${key}-thickness-mm`}
              >
                {formatNumber(m.total_thickness_mm, 0)} mm
              </div>
              <div className="text-xs text-muted-foreground">{m.method}</div>
              <div className="mt-2 flex flex-wrap gap-1">
                <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${CONFIDENCE_COLOR[m.confidence]}`}>
                  {m.confidence} confidence
                </span>
                {m.material_class && (
                  <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium">
                    Class {m.material_class}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex items-center gap-3 rounded-md border bg-muted/40 px-4 py-3 text-sm">
        <span className="text-muted-foreground">Δ Thickness:</span>
        <span className="font-mono font-semibold">{formatNumber(Math.abs(result.delta_mm), 0)} mm</span>
        <span className="text-muted-foreground">·</span>
        <span className="text-muted-foreground">Subgrade CBR:</span>
        <span className="font-mono font-semibold">{result.subgrade_cbr}%</span>
        <span className="text-muted-foreground">·</span>
        <span className="text-muted-foreground">Overall:</span>
        <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${CONFIDENCE_COLOR[result.confidence]}`}>
          {result.confidence}
        </span>
      </div>
    </div>
  );
}

function PavementChart({ result }: { result?: PavementResult }) {
  const { unitSystem } = useCalcStore();

  if (!result) {
    return (
      <p className="text-sm text-muted-foreground">
        Run "Compute thickness" to see the recommended pavement structure.
      </p>
    );
  }

  const displayThickness = convertThickness(result.total_thickness_mm, unitSystem);
  const thicknessLabel = unitLabels[unitSystem].thickness;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
        <span>Method: <span className="font-medium text-foreground">{result.method}</span></span>
        <span>·</span>
        <span>Total: <span className="font-mono" data-testid="pavement-total-thickness">{formatNumber(displayThickness, unitSystem === 'Imperial' ? 2 : 0)} {thicknessLabel}</span></span>
        <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${CONFIDENCE_COLOR[result.confidence]}`}>
          {result.confidence} confidence
        </span>
      </div>
      <PavementCrossSection result={result} />
    </div>
  );
}
