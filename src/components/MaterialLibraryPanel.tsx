import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Loader2 } from "lucide-react";
import { StubBanner } from "@/components/StubBanner";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { haulPave } from "@/lib/haulpave-client";
import type { MaterialTemplate } from "@/lib/types";
import type { CallError } from "@/lib/types";

interface Props {
  onPickTemplate: (template: MaterialTemplate) => void;
}

export function MaterialLibraryPanel({ onPickTemplate }: Props) {
  const [templates, setTemplates] = useState<MaterialTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stubMessage, setStubMessage] = useState<string | undefined>();
  const [query, setQuery] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await haulPave.materialLibrary();
        if (!cancelled) {
          setTemplates(res.data);
          setStubMessage(res.stub ? res.stubMessage : undefined);
        }
      } catch (err) {
        if (!cancelled) {
          const e = err as CallError;
          setError(e.message);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return templates;
    return templates.filter(
      (t) =>
        t.name.toLowerCase().includes(q) ||
        t.material_class.toLowerCase().includes(q) ||
        t.source.toLowerCase().includes(q),
    );
  }, [templates, query]);

  const formatCbrRange = (range: MaterialTemplate["cbr_range"]) => {
    const [lo, hi] = range;
    if (hi == null) return `≥ ${lo}%`;
    return `${lo}–${hi}%`;
  };

  return (
    <div className="space-y-3 rounded-md border bg-muted/30 p-3">
      <div>
        <p className="text-sm font-medium">Material catalog</p>
        <p className="text-xs text-muted-foreground">
          TRH 14 and USACE reference templates — indicative values only; verify with site testing.
        </p>
      </div>

      {stubMessage ? <StubBanner message={stubMessage} /> : null}

      <p className="flex items-start gap-1.5 text-[11px] text-amber-700 dark:text-amber-400">
        <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
        Templates are non-normative guidance. Do not use for final design without laboratory verification.
      </p>

      <Input
        placeholder="Search name, class, source…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        aria-label="Search material catalog"
      />

      {loading ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading catalog…
        </p>
      ) : null}

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      {!loading && !error ? (
        <ul className="max-h-48 space-y-2 overflow-y-auto pr-1">
          {filtered.map((t) => (
            <li
              key={`${t.material_class}-${t.name}`}
              className="rounded-md border bg-background p-2 text-sm"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-medium leading-tight">{t.name}</p>
                  <p className="text-xs text-muted-foreground">
                    Class {t.material_class} · CBR {formatCbrRange(t.cbr_range)} · E ≈{" "}
                    {t.typical_modulus_mpa} MPa
                  </p>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  className="shrink-0"
                  onClick={() => onPickTemplate(t)}
                >
                  Use
                </Button>
              </div>
            </li>
          ))}
          {filtered.length === 0 ? (
            <li className="text-sm text-muted-foreground">No templates match your search.</li>
          ) : null}
        </ul>
      ) : null}
    </div>
  );
}
