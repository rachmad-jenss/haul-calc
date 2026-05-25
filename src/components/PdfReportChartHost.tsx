import { forwardRef, useImperativeHandle, useMemo, useRef } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  chartCanvasToJpegDataUrl,
  renderChartToCanvas,
  waitForChartLayout,
} from "@/lib/chart-export";
import { useCalcStore } from "@/lib/store";
import { useMoneyFormatter } from "@/lib/utils";

const SCENARIO_COLORS = ["#3b82f6", "#ef4444", "#10b981", "#f59e0b", "#8b5cf6"];

const OFFSCREEN =
  "pointer-events-none fixed left-[-10000px] top-0 z-[-1] opacity-0";

export interface PdfChartImages {
  opex?: string;
  lccaCumulative?: string;
}

export interface PdfChartCaptureOptions {
  chartOpex: boolean;
  chartLccaCumulative: boolean;
}

export interface PdfReportChartHostHandle {
  capture: (options: PdfChartCaptureOptions) => Promise<PdfChartImages>;
}

export const PdfReportChartHost = forwardRef<PdfReportChartHostHandle>(
  function PdfReportChartHost(_, ref) {
    const { costResult, lccaResult, lccaInputs } = useCalcStore();
    const money = useMoneyFormatter();
    const opexRef = useRef<HTMLDivElement>(null);
    const cumulativeRef = useRef<HTMLDivElement>(null);

    const opexChartData = useMemo(
      () =>
        costResult?.scenarios.map((s) => ({
          name: s.name,
          Tires: s.tire_cost_usd_per_year,
          Fuel: s.fuel_cost_usd_per_year,
          Maintenance: s.maintenance_cost_usd_per_year,
        })) ?? [],
      [costResult],
    );

    const cumulativeData = useMemo(() => {
      if (!lccaResult) return [];
      const years = lccaInputs.analysisPeriodYears;
      const points: Record<string, number | string>[] = [];
      for (let y = 0; y <= years; y++) {
        const point: Record<string, number | string> = { year: y };
        for (const sc of lccaResult.scenarios) {
          let cum = 0;
          for (const cf of sc.cashflows) {
            if (cf.year <= y) cum += cf.pv;
          }
          point[sc.name] = Math.round(cum);
        }
        points.push(point);
      }
      return points;
    }, [lccaResult, lccaInputs.analysisPeriodYears]);

    useImperativeHandle(ref, () => ({
      async capture(options: PdfChartCaptureOptions): Promise<PdfChartImages> {
        await waitForChartLayout();
        const images: PdfChartImages = {};
        if (options.chartOpex && opexRef.current && opexChartData.length > 0) {
          try {
            const canvas = await renderChartToCanvas(opexRef.current);
            images.opex = chartCanvasToJpegDataUrl(canvas);
          } catch {
            /* graceful skip */
          }
        }
        if (options.chartLccaCumulative && cumulativeRef.current && cumulativeData.length > 0) {
          try {
            const canvas = await renderChartToCanvas(cumulativeRef.current);
            images.lccaCumulative = chartCanvasToJpegDataUrl(canvas);
          } catch {
            /* graceful skip */
          }
        }
        return images;
      },
    }));

    const yTick = (v: number) => {
      const d = money.toDisplay(v);
      if (money.currency === "IDR") {
        return d >= 1_000_000
          ? `${(d / 1_000_000).toFixed(0)}M`
          : d >= 1_000
            ? `${(d / 1_000).toFixed(0)}k`
            : money.formatGrouped(d);
      }
      return `$${(d / 1000).toFixed(0)}k`;
    };

    return (
      <div aria-hidden>
        {opexChartData.length > 0 ? (
          <div ref={opexRef} className={`${OFFSCREEN} h-[320px] w-[680px]`}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={opexChartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                <YAxis tickFormatter={yTick} tick={{ fontSize: 10 }} />
                <Tooltip formatter={(value: number) => money.formatMoney(value)} />
                <Legend wrapperStyle={{ fontSize: 10 }} />
                <Bar dataKey="Tires" stackId="a" fill="#ef4444" name="Tires" />
                <Bar dataKey="Fuel" stackId="a" fill="#f59e0b" name="Fuel" />
                <Bar dataKey="Maintenance" stackId="a" fill="#3b82f6" name="Maintenance" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : null}
        {lccaResult && cumulativeData.length > 0 ? (
          <div ref={cumulativeRef} className={`${OFFSCREEN} h-[320px] w-[680px]`}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={cumulativeData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="year" tick={{ fontSize: 10 }} />
                <YAxis tickFormatter={yTick} tick={{ fontSize: 10 }} />
                <Tooltip formatter={(value: number) => money.formatMoney(value)} />
                <Legend wrapperStyle={{ fontSize: 10 }} />
                {lccaResult.scenarios.map((s, i) => (
                  <Line
                    key={s._id}
                    type="monotone"
                    dataKey={s.name}
                    name={s.name}
                    stroke={SCENARIO_COLORS[i % SCENARIO_COLORS.length]}
                    dot={false}
                    strokeWidth={2}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : null}
      </div>
    );
  },
);
