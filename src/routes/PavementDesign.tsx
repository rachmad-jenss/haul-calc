import { useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Calculator, ArrowDownToLine } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/PageHeader";
import { StubBanner } from "@/components/StubBanner";
import { NumField } from "@/components/FormFields";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { haulPave } from "@/lib/haulpave-client";
import { cbrRequestSchema, trh14RequestSchema, firstError } from "@/lib/schemas";
import { useCalcStore } from "@/lib/store";
import type { CallError, CompareMethodsResult, PavementResult } from "@/lib/types";
import { formatNumber, parseNumericInput } from "@/lib/utils";

const LAYER_COLORS = ["#1d4ed8", "#0ea5e9", "#22c55e", "#eab308", "#a16207"];

export default function PavementDesign() {
  const {
    cesaResult,
    fleet,
    designLifeYears,
    subgradeCbr,
    coverages,
    trhCategory,
    cbrResult,
    trhResult,
    setSubgradeCbr,
    setCoverages,
    setTrhCategory,
    setCbrResult,
    setTrhResult,
  } = useCalcStore();

  const [running, setRunning] = useState(false);
  const [compareResult, setCompareResult] = useState<(CompareMethodsResult & { stub: boolean; stubMessage?: string }) | null>(null);
  const [comparing, setComparing] = useState(false);

  const importFromCesa = () => {
    if (cesaResult) {
      setCoverages(cesaResult.design_coverages);
      toast.success("Design coverages imported from CESA result.");
    }
  };

  const compare = async () => {
    if (!fleet.length) {
      toast.error("Add fleet entries first before comparing methods.");
      return;
    }
    const cbrParsed = cbrRequestSchema.safeParse({ subgrade_cbr: subgradeCbr, design_coverages: coverages });
    if (!cbrParsed.success) {
      toast.error(firstError(cbrParsed.error));
      return;
    }
    setComparing(true);
    try {
      const res = await haulPave.compareMethods({
        subgrade_cbr: cbrParsed.data.subgrade_cbr,
        fleet,
        design_life_years: designLifeYears,
      });
      setCompareResult({ ...res.data, stub: res.stub, stubMessage: res.stubMessage });
    } catch (err) {
      const e = err as CallError;
      toast.error(`compare_methods failed: ${e.message}`);
    } finally {
      setComparing(false);
    }
  };

  const compute = async () => {
    const cbrParsed = cbrRequestSchema.safeParse({
      subgrade_cbr: subgradeCbr,
      design_coverages: coverages,
    });
    if (!cbrParsed.success) {
      toast.error(firstError(cbrParsed.error));
      return;
    }
    const trhParsed = trh14RequestSchema.safeParse({
      category: trhCategory,
      design_coverages: coverages,
    });
    if (!trhParsed.success) {
      toast.error(firstError(trhParsed.error));
      return;
    }
    setRunning(true);
    try {
      const [cbrRes, trhRes] = await Promise.all([
        haulPave.cbrThickness(cbrParsed.data),
        haulPave.trh14Thickness(trhParsed.data),
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
            <NumField
              id="subgrade-cbr"
              label="Subgrade CBR (%)"
              value={subgradeCbr}
              onChange={setSubgradeCbr}
              min={1}
              max={50}
            />
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
                onChange={(e) => setCoverages(parseNumericInput(e.target.value, coverages))}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="category">TRH 14 category</Label>
              <select
                id="category"
                value={trhCategory}
                onChange={(e) => setTrhCategory(e.target.value as "A" | "B" | "C" | "D")}
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="A">A — heavily trafficked</option>
                <option value="B">B — primary</option>
                <option value="C">C — secondary</option>
                <option value="D">D — light</option>
              </select>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recommended structure</CardTitle>
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
                <PavementChart result={cbrResult ?? undefined} />
              </TabsContent>
              <TabsContent value="trh14" className="space-y-3">
                {trhResult?.stub ? <StubBanner message={trhResult.stubMessage} /> : null}
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
                <MethodComparisonPanel result={compareResult ?? undefined} />
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

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
              <div className="mb-1 font-mono text-2xl font-bold">
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
  if (!result) {
    return (
      <p className="text-sm text-muted-foreground">
        Run "Compute thickness" to see the recommended pavement structure.
      </p>
    );
  }
  const data = result.layers.map((l, i) => ({
    name: l.name,
    thickness: l.thickness_mm,
    cbr: l.cbr,
    fill: LAYER_COLORS[i % LAYER_COLORS.length],
  }));
  return (
    <div className="space-y-3">
      <div className="text-sm text-muted-foreground">
        Method: <span className="font-medium text-foreground">{result.method}</span>
        {" · "}
        Total: <span className="font-mono">{result.total_thickness_mm} mm</span>
      </div>
      <div className="h-72 w-full">
        <ResponsiveContainer>
          <BarChart data={data} layout="vertical" margin={{ left: 16, right: 16 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis type="number" unit=" mm" />
            <YAxis type="category" dataKey="name" width={140} />
            <Tooltip />
            <Bar dataKey="thickness">
              {data.map((entry, idx) => (
                <Cell key={idx} fill={entry.fill} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
