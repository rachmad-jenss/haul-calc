import { useEffect, useState } from "react";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { StubBanner } from "@/components/StubBanner";
import { haulPave } from "@/lib/haulpave-client";
import { customMaterialRequestSchema, firstError } from "@/lib/schemas";
import { useCalcStore } from "@/lib/store";
import type { CallError, MaterialTemplate, MaterialType } from "@/lib/types";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Prefill form when opened from material catalog (DAS-161). */
  catalogPrefill?: MaterialTemplate | null;
}

interface FormState {
  name: string;
  material_type: MaterialType;
  elastic_modulus_mpa: string;
  cbr_percent: string;
  poisson_ratio: string;
  layer_coefficient: string;
  thickness_mm: string;
  description: string;
}

const EMPTY_FORM: FormState = {
  name: "",
  material_type: "granular",
  elastic_modulus_mpa: "120",
  cbr_percent: "",
  poisson_ratio: "0.35",
  layer_coefficient: "",
  thickness_mm: "",
  description: "",
};

function formFromTemplate(t: MaterialTemplate): FormState {
  const mid =
    t.cbr_range[1] != null ? (t.cbr_range[0] + t.cbr_range[1]) / 2 : t.cbr_range[0] + 5;
  return {
    name: t.name,
    material_type: "granular",
    elastic_modulus_mpa: String(t.typical_modulus_mpa),
    cbr_percent: String(Math.round(mid * 10) / 10),
    poisson_ratio: "0.35",
    layer_coefficient: "",
    thickness_mm: "",
    description: `From catalog: ${t.source}`,
  };
}

const MATERIAL_TYPES: MaterialType[] = ["granular", "stabilized", "asphalt", "concrete"];

export function CustomMaterialModal({ open, onOpenChange, catalogPrefill }: Props) {
  const { customMaterials, addCustomMaterial, removeCustomMaterial } = useCalcStore();
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [formError, setFormError] = useState<string | null>(null);
  const [stubMessage, setStubMessage] = useState<string | undefined>();
  const [validating, setValidating] = useState(false);

  useEffect(() => {
    if (open && catalogPrefill) {
      setForm(formFromTemplate(catalogPrefill));
      setFormError(null);
    }
  }, [open, catalogPrefill]);

  if (!open) return null;

  const handleClose = () => {
    setForm(EMPTY_FORM);
    setFormError(null);
    setStubMessage(undefined);
    onOpenChange(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      name: form.name.trim(),
      material_type: form.material_type,
      elastic_modulus_mpa: parseFloat(form.elastic_modulus_mpa),
      cbr_percent: form.cbr_percent.trim() ? parseFloat(form.cbr_percent) : null,
      poisson_ratio: form.poisson_ratio.trim() ? parseFloat(form.poisson_ratio) : 0.35,
      layer_coefficient: form.layer_coefficient.trim()
        ? parseFloat(form.layer_coefficient)
        : null,
      thickness_mm: form.thickness_mm.trim() ? parseFloat(form.thickness_mm) : null,
      description: form.description.trim(),
    };
    const parsed = customMaterialRequestSchema.safeParse(payload);
    if (!parsed.success) {
      setFormError(firstError(parsed.error));
      return;
    }
    setFormError(null);

    setValidating(true);
    try {
      const res = await haulPave.customMaterial(parsed.data);
      setStubMessage(res.stub ? res.stubMessage : undefined);
      addCustomMaterial(parsed.data);
      toast.success(`Custom material "${parsed.data.name}" added`);
      setForm(EMPTY_FORM);
    } catch (err) {
      const e = err as CallError;
      toast.error(`Could not validate material: ${e.message}`);
    } finally {
      setValidating(false);
    }
  };

  const handleRemove = (id: string, name: string) => {
    removeCustomMaterial(id);
    toast.success(`Removed "${name}"`);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      role="dialog"
      aria-modal="true"
      aria-labelledby="custom-materials-title"
      tabIndex={-1}
      onKeyDown={(e) => {
        if (e.key === "Escape") handleClose();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) handleClose();
      }}
    >
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-lg border bg-background p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 id="custom-materials-title" className="text-lg font-semibold">
            Custom materials
          </h2>
          <button
            type="button"
            onClick={handleClose}
            className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {stubMessage ? <StubBanner message={stubMessage} /> : null}

        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="cm-name">Material name</Label>
            <Input
              id="cm-name"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="e.g. Crusher run base"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="cm-type">Type</Label>
              <select
                id="cm-type"
                value={form.material_type}
                onChange={(e) =>
                  setForm((f) => ({ ...f, material_type: e.target.value as MaterialType }))
                }
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                {MATERIAL_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="cm-e">Elastic modulus (MPa)</Label>
              <Input
                id="cm-e"
                type="number"
                min={0.1}
                step="any"
                value={form.elastic_modulus_mpa}
                onChange={(e) =>
                  setForm((f) => ({ ...f, elastic_modulus_mpa: e.target.value }))
                }
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="cm-cbr">CBR (%)</Label>
              <Input
                id="cm-cbr"
                type="number"
                min={0.1}
                step="any"
                value={form.cbr_percent}
                onChange={(e) => setForm((f) => ({ ...f, cbr_percent: e.target.value }))}
                placeholder={form.material_type === "granular" ? "Required" : "Optional"}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="cm-nu">Poisson ratio</Label>
              <Input
                id="cm-nu"
                type="number"
                min={0.01}
                max={0.49}
                step="0.01"
                value={form.poisson_ratio}
                onChange={(e) => setForm((f) => ({ ...f, poisson_ratio: e.target.value }))}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="cm-a">Layer coefficient (optional)</Label>
              <Input
                id="cm-a"
                type="number"
                min={0.01}
                step="any"
                value={form.layer_coefficient}
                onChange={(e) =>
                  setForm((f) => ({ ...f, layer_coefficient: e.target.value }))
                }
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="cm-t">Thickness (mm, optional)</Label>
              <Input
                id="cm-t"
                type="number"
                min={1}
                step="any"
                value={form.thickness_mm}
                onChange={(e) => setForm((f) => ({ ...f, thickness_mm: e.target.value }))}
              />
            </div>
          </div>

          <div className="space-y-1">
            <Label htmlFor="cm-desc">Notes</Label>
            <Input
              id="cm-desc"
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            />
          </div>

          {formError ? <p className="text-xs text-destructive">{formError}</p> : null}

          <Button type="submit" className="w-full" disabled={validating}>
            {validating ? "Validating…" : "Add material"}
          </Button>
        </form>

        {customMaterials.length > 0 ? (
          <div className="mt-5">
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Project materials ({customMaterials.length})
            </p>
            <ul className="space-y-1">
              {customMaterials.map((m) => (
                <li
                  key={m.id}
                  className="flex items-center justify-between rounded-md border px-3 py-2 text-sm"
                >
                  <span className="truncate">
                    {m.name}{" "}
                    <span className="text-muted-foreground">
                      — {m.material_type}, {m.elastic_modulus_mpa} MPa
                      {m.cbr_percent != null ? `, CBR ${m.cbr_percent}%` : ""}
                    </span>
                  </span>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleRemove(m.id, m.name)}
                    aria-label={`Remove ${m.name}`}
                    className="ml-2 shrink-0"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </div>
  );
}
