import { Clock, Truck, Layers, Coins, FileText, FolderOpen } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { openProjectFromPath } from "@/lib/project-file";
import { useCalcStore } from "@/lib/store";
import { formatNumber } from "@/lib/utils";

export default function Dashboard() {
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

      <div className="grid flex-1 gap-4 overflow-auto p-6 sm:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center gap-2 space-y-0 pb-2">
            <Truck className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-sm font-medium">Fleet &amp; Traffic</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Vehicles in fleet</span>
              <span className="font-mono font-semibold">{totalVehicles}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Design life</span>
              <span className="font-mono font-semibold">{designLifeYears} yr</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Total CESA</span>
              <span className="font-mono font-semibold">
                {cesaResult ? formatNumber(cesaResult.cesa, 0) : "Not computed"}
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center gap-2 space-y-0 pb-2">
            <Layers className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-sm font-medium">Pavement Design</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Subgrade CBR</span>
              <span className="font-mono font-semibold">{subgradeCbr}%</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Design coverages</span>
              <span className="font-mono font-semibold">{formatNumber(coverages, 0)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">CBR method total</span>
              <span className="font-mono font-semibold">
                {cbrResult ? `${formatNumber(cbrResult.total_thickness_mm, 0)} mm` : "Not computed"}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">TRH 14 total</span>
              <span className="font-mono font-semibold">
                {trhResult ? `${formatNumber(trhResult.total_thickness_mm, 0)} mm` : "Not computed"}
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center gap-2 space-y-0 pb-2">
            <Coins className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-sm font-medium">Economics</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Cost scenarios</span>
              <span className="font-mono font-semibold">{costScenarios.length}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Best scenario</span>
              <span className="font-mono font-semibold">
                {bestScenario ? bestScenario.name : "Not computed"}
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center gap-2 space-y-0 pb-2">
            <FileText className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-sm font-medium">Reports</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Project</span>
              <span className="font-semibold truncate ml-4 max-w-[180px] text-right">
                {projectName || "—"}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Author</span>
              <span className="font-semibold truncate ml-4 max-w-[180px] text-right">
                {authorName || "—"}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Report status</span>
              <span className="font-semibold">
                {reportSummary ? "Generated" : "Not generated"}
              </span>
            </div>
          </CardContent>
        </Card>

        <Card className="sm:col-span-2">
          <CardHeader className="flex flex-row items-center gap-2 space-y-0 pb-2">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-sm font-medium">Recent Files</CardTitle>
          </CardHeader>
          <CardContent>
            {recentFiles.length === 0 ? (
              <p className="text-sm text-muted-foreground">No recent files.</p>
            ) : (
              <ul className="space-y-1">
                {recentFiles.map((filePath) => {
                  const name = filePath.replace(/\\/g, "/").split("/").pop() ?? filePath;
                  return (
                    <li key={filePath} className="flex items-center justify-between gap-2">
                      <span className="truncate text-sm" title={filePath}>{name}</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 shrink-0 gap-1 px-2 text-xs"
                        onClick={() => handleOpenRecent(filePath)}
                      >
                        <FolderOpen className="h-3 w-3" />
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
