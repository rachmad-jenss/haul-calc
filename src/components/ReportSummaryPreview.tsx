import type { DesignSummary } from "@/lib/types";
import { formatNumber } from "@/lib/utils";

type StubMeta = { stub?: boolean; stubMessage?: string };

function formatScalar(value: unknown): string {
  if (value == null) return "—";
  if (typeof value === "number") return formatNumber(value, Number.isInteger(value) ? 0 : 2);
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "string") return value;
  return JSON.stringify(value);
}

function PreviewRows({ data, depth = 0 }: { data: Record<string, unknown>; depth?: number }) {
  return (
    <dl className="space-y-1.5 text-sm">
      {Object.entries(data).map(([key, value]) => {
        const label = key.replace(/_/g, " ");
        if (value != null && typeof value === "object" && !Array.isArray(value) && depth < 2) {
          return (
            <div key={key} className="space-y-1">
              <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {label}
              </dt>
              <dd className="rounded-md border bg-background/50 p-2 pl-3">
                <PreviewRows data={value as Record<string, unknown>} depth={depth + 1} />
              </dd>
            </div>
          );
        }
        return (
          <div key={key} className="flex justify-between gap-4 border-b border-border/50 py-1 last:border-0">
            <dt className="text-muted-foreground capitalize">{label}</dt>
            <dd className="max-w-[60%] text-right font-mono text-xs">{formatScalar(value)}</dd>
          </div>
        );
      })}
    </dl>
  );
}

export function ReportSummaryPreview({ summary }: { summary: DesignSummary & StubMeta }) {
  const { stub: _stub, stubMessage: _msg, ...display } = summary;
  const inputs =
    display.inputs && typeof display.inputs === "object"
      ? (display.inputs as Record<string, unknown>)
      : {};
  const results =
    display.results && typeof display.results === "object"
      ? (display.results as Record<string, unknown>)
      : {};

  const generated = display.generated_at
    ? new Date(display.generated_at).toLocaleString()
    : "—";

  return (
    <div className="max-h-[480px] space-y-4 overflow-auto text-sm" data-testid="report-summary-preview">
      <div className="space-y-1 border-b pb-3">
        <h3 className="text-base font-semibold">{display.title || "Design summary"}</h3>
        <p className="text-xs text-muted-foreground">Generated {generated}</p>
      </div>

      {Object.keys(inputs).length > 0 && (
        <section>
          <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Inputs
          </h4>
          <PreviewRows data={inputs} />
        </section>
      )}

      {Object.keys(results).length > 0 && (
        <section>
          <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Results
          </h4>
          <PreviewRows data={results} />
        </section>
      )}

      {Object.keys(inputs).length === 0 && Object.keys(results).length === 0 && (
        <p className="text-muted-foreground">
          Summary generated. Run more calculations before regenerating for fuller sections.
        </p>
      )}

      <details className="rounded-md border bg-muted/30 p-2 text-xs">
        <summary className="cursor-pointer font-medium text-muted-foreground">Raw JSON</summary>
        <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap break-all font-mono leading-relaxed">
          {JSON.stringify(display, null, 2)}
        </pre>
      </details>
    </div>
  );
}
