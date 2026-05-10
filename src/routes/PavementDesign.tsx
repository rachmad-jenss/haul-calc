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
import { Calculator } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/PageHeader";
import { StubBanner } from "@/components/StubBanner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { haulPave } from "@/lib/haulpave-client";
import { cbrRequestSchema, trh14RequestSchema, firstError } from "@/lib/schemas";
import type { CallError, PavementResult } from "@/lib/types";

const LAYER_COLORS = ["#1d4ed8", "#0ea5e9", "#22c55e", "#eab308", "#a16207"];

export default function PavementDesign() {
  const [subgradeCbr, setSubgradeCbr] = useState(8);
  const [coverages, setCoverages] = useState(1_050_000);
  const [category, setCategory] = useState<"A" | "B" | "C" | "D">("B");

  const [cbr, setCbr] = useState<{
    data: PavementResult;
    stub: boolean;
    msg?: string;
  } | null>(null);
  const [trh, setTrh] = useState<{
    data: PavementResult;
    stub: boolean;
    msg?: string;
  } | null>(null);
  const [running, setRunning] = useState(false);

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
      category,
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
      setCbr({ data: cbrRes.data, stub: cbrRes.stub, msg: cbrRes.stubMessage });
      setTrh({ data: trhRes.data, stub: trhRes.stub, msg: trhRes.stubMessage });
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
            <Field
              id="subgrade-cbr"
              label="Subgrade CBR (%)"
              value={subgradeCbr}
              onChange={setSubgradeCbr}
              min={1}
              max={50}
            />
            <Field
              id="coverages"
              label="Design coverages"
              value={coverages}
              onChange={setCoverages}
              min={1}
            />
            <div className="space-y-1">
              <Label htmlFor="category">TRH 14 category</Label>
              <select
                id="category"
                value={category}
                onChange={(e) =>
                  setCategory(e.target.value as "A" | "B" | "C" | "D")
                }
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
              </TabsList>
              <TabsContent value="cbr" className="space-y-3">
                {cbr?.stub ? <StubBanner message={cbr.msg} /> : null}
                <PavementChart result={cbr?.data} />
              </TabsContent>
              <TabsContent value="trh14" className="space-y-3">
                {trh?.stub ? <StubBanner message={trh.msg} /> : null}
                <PavementChart result={trh?.data} />
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Field({
  id,
  label,
  value,
  onChange,
  min,
  max,
}: {
  id: string;
  label: string;
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
}) {
  return (
    <div className="space-y-1">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        type="number"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
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
