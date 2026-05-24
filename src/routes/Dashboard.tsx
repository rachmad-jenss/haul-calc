import type { ReactNode } from "react";
import {
  IconAlarmClockOutline18,
  IconFileContentOutline18,
  IconFolderOpenOutline18,
  IconForkliftOutline18,
  IconLayers3Outline18,
  IconMoneyBillCoinOutline18,
} from "nucleo-ui-essential-outline-18";
import { NavLink } from "react-router-dom";
import { toast } from "sonner";
import { PageHeader } from "@/components/PageHeader";
import { WorkflowGuidanceBanner } from "@/components/WorkflowGuidanceBanner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { nucleoIconProps } from "@/lib/icons";
import { openProjectFromPath } from "@/lib/project-file";
import { useCalcStore } from "@/lib/store";
import { formatNumber } from "@/lib/utils";

const ICON_16_MUTED = nucleoIconProps({ size: 16, className: "text-subtle" });
const ICON_12 = nucleoIconProps({ size: 12 });

export default function Dashboard() {
  if (window.__HAULCALC_E2E_SHOULD_THROW__) {
    throw new Error("E2E render error");
  }

  const store = useCalcStore();
  const {
    fleet,
    designLifeYears,
    cesaResult,
    subgradeCbr,
    coverages,
    cbrResult,
    trhResult,
    costScenarios,
    costResult,
    projectName,
    authorName,
    reportSummary,
    recentFiles,
  } = store;

  const totalVehicles = fleet.reduce((sum, entry) => sum + entry.count, 0);

  const bestScenario = costResult
    ? costResult.scenarios.reduce<{ name: string; total: number } | null>((best, s) => {
        const total =
          s.tire_cost_usd_per_year +
          s.fuel_cost_usd_per_year +
          s.maintenance_cost_usd_per_year;
        if (!best || total < best.total) return { name: s.name, total };
        return best;
      }, null)
    : null;

  const handleOpenRecent = (filePath: string) => {
    openProjectFromPath(filePath, store).catch((err) => {
      toast.error(`Failed to open: ${(err as Error).message}`);
    });
  };

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        title="Dashboard"
        description="Summary of the current project state across all modules."
      />

      <WorkflowGuidanceBanner />

      <div className="grid flex-1 gap-4 overflow-auto p-6 sm:grid-cols-2">
        <DashboardNavCard to="/fleet">
          <CardHeader className="flex flex-row items-center gap-2 space-y-0 pb-2">
            <IconForkliftOutline18 {...ICON_16_MUTED} aria-hidden />
            <CardTitle className="text-md font-medium">Fleet &amp; Traffic</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            <div className="flex justify-between text-base">
              <span className="text-subtle">Vehicles in fleet</span>
              <span className="font-mono font-semibold">{totalVehicles}</span>
            </div>
            <div className="flex justify-between text-base">
              <span className="text-subtle">Design life</span>
              <span className="font-mono font-semibold">{designLifeYears} yr</span>
            </div>
            <div className="flex justify-between text-base">
              <span className="text-subtle">Total CESA</span>
              <span className="font-mono font-semibold">
                {cesaResult ? formatNumber(cesaResult.cesa, 0) : "Not computed"}
              </span>
            </div>
          </CardContent>
        </DashboardNavCard>

        <DashboardNavCard to="/pavement">
          <CardHeader className="flex flex-row items-center gap-2 space-y-0 pb-2">
            <IconLayers3Outline18 {...ICON_16_MUTED} aria-hidden />
            <CardTitle className="text-md font-medium">Pavement Design</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            <div className="flex justify-between text-base">
              <span className="text-subtle">Subgrade CBR</span>
              <span className="font-mono font-semibold">{subgradeCbr}%</span>
            </div>
            <div className="flex justify-between text-base">
              <span className="text-subtle">Design coverages</span>
              <span className="font-mono font-semibold">{formatNumber(coverages, 0)}</span>
            </div>
            <div className="flex justify-between text-base">
              <span className="text-subtle">CBR method total</span>
              <span className="font-mono font-semibold">
                {cbrResult ? `${formatNumber(cbrResult.total_thickness_mm, 0)} mm` : "Not computed"}
              </span>
            </div>
            <div className="flex justify-between text-base">
              <span className="text-subtle">TRH 14 total</span>
              <span className="font-mono font-semibold">
                {trhResult ? `${formatNumber(trhResult.total_thickness_mm, 0)} mm` : "Not computed"}
              </span>
            </div>
          </CardContent>
        </DashboardNavCard>

        <DashboardNavCard to="/economics">
          <CardHeader className="flex flex-row items-center gap-2 space-y-0 pb-2">
            <IconMoneyBillCoinOutline18 {...ICON_16_MUTED} aria-hidden />
            <CardTitle className="text-md font-medium">Economics</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            <div className="flex justify-between text-base">
              <span className="text-subtle">Cost scenarios</span>
              <span className="font-mono font-semibold">{costScenarios.length}</span>
            </div>
            <div className="flex justify-between text-base">
              <span className="text-subtle">Best scenario</span>
              <span className="font-mono font-semibold">
                {bestScenario ? bestScenario.name : "Not computed"}
              </span>
            </div>
          </CardContent>
        </DashboardNavCard>

        <DashboardNavCard to="/reports">
          <CardHeader className="flex flex-row items-center gap-2 space-y-0 pb-2">
            <IconFileContentOutline18 {...ICON_16_MUTED} aria-hidden />
            <CardTitle className="text-md font-medium">Reports</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            <div className="flex justify-between text-base">
              <span className="text-subtle">Project</span>
              <span className="font-semibold truncate ml-4 max-w-[180px] text-right">
                {projectName || "—"}
              </span>
            </div>
            <div className="flex justify-between text-base">
              <span className="text-subtle">Author</span>
              <span className="font-semibold truncate ml-4 max-w-[180px] text-right">
                {authorName || "—"}
              </span>
            </div>
            <div className="flex justify-between text-base">
              <span className="text-subtle">Report status</span>
              <span className="font-semibold">
                {reportSummary ? "Generated" : "Not generated"}
              </span>
            </div>
          </CardContent>
        </DashboardNavCard>

        <Card className="sm:col-span-2">
          <CardHeader className="flex flex-row items-center gap-2 space-y-0 pb-2">
            <IconAlarmClockOutline18 {...ICON_16_MUTED} aria-hidden />
            <CardTitle className="text-md font-medium">Recent Files</CardTitle>
          </CardHeader>
          <CardContent>
            {recentFiles.length === 0 ? (
              <p className="text-base text-subtle">No recent files.</p>
            ) : (
              <ul className="space-y-1">
                {recentFiles.map((filePath) => {
                  const name = filePath.replace(/\\/g, "/").split("/").pop() ?? filePath;
                  return (
                    <li key={filePath} className="flex items-center justify-between gap-2">
                      <span className="truncate text-base" title={filePath}>{name}</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 shrink-0 gap-1 px-2 text-2xs"
                        onClick={() => handleOpenRecent(filePath)}
                      >
                        <IconFolderOpenOutline18 {...ICON_12} aria-hidden />
                        Open
                      </Button>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function DashboardNavCard({ to, children }: { to: string; children: ReactNode }) {
  const label =
    to === "/fleet"
      ? "Open Fleet and Traffic"
      : to === "/pavement"
        ? "Open Pavement Design"
        : to === "/economics"
          ? "Open Economics"
          : "Open Reports";
  return (
    <NavLink
      to={to}
      aria-label={label}
      className="block rounded-lg outline-none transition-colors hover:bg-accent/40 focus-visible:ring-2 focus-visible:ring-ring"
    >
      <Card className="h-full border-transparent shadow-none hover:border-border">{children}</Card>
    </NavLink>
  );
}
