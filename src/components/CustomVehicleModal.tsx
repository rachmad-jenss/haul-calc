import { useState } from "react";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useCalcStore } from "@/lib/store";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface FormState {
  name: string;
  gvw_kn: string;
  axles: string;
}

const EMPTY_FORM: FormState = { name: "", gvw_kn: "", axles: "4" };

export function CustomVehicleModal({ open, onOpenChange }: Props) {
  const { customVehicles, addCustomVehicle, removeCustomVehicle } = useCalcStore();
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [errors, setErrors] = useState<Partial<FormState>>({});

  if (!open) return null;

  const handleClose = () => {
    setForm(EMPTY_FORM);
    setErrors({});
    onOpenChange(false);
  };

  const validate = (): boolean => {
    const errs: Partial<FormState> = {};
    if (!form.name.trim()) errs.name = "Name is required";
    const gvw = parseFloat(form.gvw_kn);
    if (isNaN(gvw) || gvw <= 0) errs.gvw_kn = "GVW must be > 0";
    const axles = Number(form.axles);
    if (!Number.isInteger(axles) || axles < 2 || axles > 12) errs.axles = "Axles must be an integer from 2 to 12";
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    addCustomVehicle({
      name: form.name.trim(),
      gvw_kn: parseFloat(form.gvw_kn),
      axles: Number(form.axles),
    });
    toast.success(`Custom vehicle "${form.name.trim()}" added`);
    setForm(EMPTY_FORM);
    setErrors({});
  };

  const handleRemove = (id: string, name: string) => {
    removeCustomVehicle(id);
    toast.success(`Removed "${name}"`);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      role="dialog"
      aria-modal="true"
      aria-labelledby="custom-vehicles-title"
      tabIndex={-1}
      onKeyDown={(e) => {
        if (e.key === "Escape") handleClose();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) handleClose();
      }}
    >
      <div className="w-full max-w-md rounded-lg border bg-background p-6 shadow-xl">
        {/* Header */}
        <div className="mb-4 flex items-center justify-between">
          <h2 id="custom-vehicles-title" className="text-lg font-semibold">Custom Vehicles</h2>
          <button
            type="button"
            onClick={handleClose}
            className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {/* Add form */}
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="cv-name">Vehicle name</Label>
            <Input
              id="cv-name"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="e.g. Komatsu 930E-5"
            />
            {errors.name && <p className="text-xs text-destructive">{errors.name}</p>}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="cv-gvw">GVW (kN)</Label>
              <Input
                id="cv-gvw"
                type="number"
                min={1}
                step="any"
                value={form.gvw_kn}
                onChange={(e) => setForm((f) => ({ ...f, gvw_kn: e.target.value }))}
                placeholder="e.g. 5800"
              />
              {errors.gvw_kn && <p className="text-xs text-destructive">{errors.gvw_kn}</p>}
            </div>

            <div className="space-y-1">
              <Label htmlFor="cv-axles">Axles</Label>
              <Input
                id="cv-axles"
                type="number"
                min={2}
                max={12}
                step={1}
                value={form.axles}
                onChange={(e) => setForm((f) => ({ ...f, axles: e.target.value }))}
              />
              {errors.axles && <p className="text-xs text-destructive">{errors.axles}</p>}
            </div>
          </div>

          <Button type="submit" className="w-full">
            Add Vehicle
          </Button>
        </form>

        {/* Existing custom vehicles */}
        {customVehicles.length > 0 && (
          <div className="mt-5">
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Saved custom vehicles
            </p>
            <ul className="space-y-1">
              {customVehicles.map((cv) => (
                <li
                  key={cv.id}
                  className="flex items-center justify-between rounded-md border px-3 py-2 text-sm"
                >
                  <span className="truncate">
                    {cv.name}{" "}
                    <span className="text-muted-foreground">
                      — {cv.gvw_kn} kN / {cv.axles} axles
                    </span>
                  </span>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleRemove(cv.id, cv.name)}
                    aria-label={`Remove ${cv.name}`}
                    className="ml-2 shrink-0"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
