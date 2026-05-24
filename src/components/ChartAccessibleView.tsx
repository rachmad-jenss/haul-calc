import type { ReactNode } from "react";
import { Table2 } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Accessible chart + data table pattern (DAS-199).
 *
 * Keyboard focus order when the data table is shown:
 * 1. "Data table" toggle (toolbar)
 * 2. Optional toolbar actions (export buttons), left to right
 * 3. Data table region (Tab once; use screen reader table navigation between cells)
 *
 * The Recharts SVG is decorative (`aria-hidden`); exact values live in the table.
 * Series/colors are described in `seriesDescription` because the chart relies on color.
 */
export function ChartAccessibleView({
  id,
  showData,
  onShowDataChange,
  seriesDescription,
  chart,
  table,
  toolbar,
}: {
  id: string;
  showData: boolean;
  onShowDataChange: (show: boolean) => void;
  seriesDescription: string;
  chart: ReactNode;
  table: ReactNode;
  toolbar?: ReactNode;
}) {
  const tableId = `${id}-data-table`;

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground" id={`${id}-series-desc`}>
        {seriesDescription} Chart colors distinguish series; use the data table for exact
        values (color-only encoding).
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant={showData ? "secondary" : "outline"}
          size="sm"
          className="h-8 gap-1.5 text-xs"
          aria-pressed={showData}
          aria-controls={tableId}
          aria-expanded={showData}
          aria-describedby={`${id}-series-desc`}
          onClick={() => onShowDataChange(!showData)}
        >
          <Table2 className="h-3.5 w-3.5" aria-hidden />
          {showData ? "Hide data table" : "Show data table"}
        </Button>
        {toolbar}
      </div>
      <div aria-hidden="true" tabIndex={-1}>
        {chart}
      </div>
      {showData ? (
        <div
          id={tableId}
          className="overflow-x-auto rounded-md border focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          tabIndex={0}
          role="region"
          aria-label="Chart data table"
        >
          {table}
        </div>
      ) : null}
    </div>
  );
}
