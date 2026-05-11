import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, XCircle, RefreshCw, RotateCcw, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/PageHeader";
import { Row } from "@/components/FormFields";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { haulPave, type SidecarStatus } from "@/lib/haulpave-client";
import type { CallError } from "@/lib/types";

interface Status {
  loaded: boolean;
  error?: string;
  haulpaveVersion: string | null;
  bridgeVersion: string;
  sidecarStatus: SidecarStatus;
}

export default function Settings() {
  const [status, setStatus] = useState<Status | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [restarting, setRestarting] = useState(false);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const [health, version, sidecarStatus] = await Promise.all([
        haulPave.healthCheck(),
        haulPave.getVersion(),
        haulPave.getSidecarStatus(),
      ]);
      setStatus({
        loaded: health.data.haulpave_loaded,
        haulpaveVersion: version.data.haulpave,
        bridgeVersion: version.data.bridge,
        sidecarStatus,
      });
    } catch (err) {
      const e = err as CallError;
      setStatus({
        loaded: false,
        error: e.message,
        haulpaveVersion: null,
        bridgeVersion: "—",
        sidecarStatus: "crashed",
      });
    } finally {
      setRefreshing(false);
    }
  }, []);

  const restart = async () => {
    setRestarting(true);
    try {
      await haulPave.restartSidecar();
      toast.success("Sidecar restarted");
      await refresh();
    } catch (err) {
      const e = err as CallError;
      toast.error(`Restart failed: ${e.message}`);
    } finally {
      setRestarting(false);
    }
  };

  useEffect(() => {
    refresh();
  }, [refresh]);

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        title="Settings"
        description="Sidecar status, library version, and unit system."
        actions={
          <div className="flex items-center gap-2">
            {status?.sidecarStatus === "crashed" && (
              <Button
                variant="destructive"
                onClick={restart}
                disabled={restarting}
              >
                {restarting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RotateCcw className="h-4 w-4" />
                )}
                {restarting ? "Restarting…" : "Restart Sidecar"}
              </Button>
            )}
            <Button variant="outline" onClick={refresh} disabled={refreshing || restarting}>
              <RefreshCw className="h-4 w-4" />
              Refresh
            </Button>
          </div>
        }
      />

      <div className="grid flex-1 gap-4 overflow-auto p-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Sidecar</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <Row label="Process status">
              <SidecarStatusBadge status={status?.sidecarStatus} error={status?.error} />
            </Row>
            <Row label="haul-pave loaded">
              {status?.loaded ? (
                <span className="flex items-center gap-1 text-emerald-600">
                  <CheckCircle2 className="h-4 w-4" /> Yes
                </span>
              ) : (
                <span className="flex items-center gap-1 text-amber-600">
                  <XCircle className="h-4 w-4" /> Stub mode
                </span>
              )}
            </Row>
            <Row label="haul-pave version">
              <span className="font-mono">{status?.haulpaveVersion ?? "—"}</span>
            </Row>
            <Row label="Bridge version">
              <span className="font-mono">{status?.bridgeVersion ?? "—"}</span>
            </Row>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Conventions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <Row label="Unit system">
              <span className="font-medium text-foreground">SI (locked for v1)</span>
            </Row>
            <Row label="Currency">
              <span className="font-medium text-foreground">USD</span>
            </Row>
            <Row label="Geometric design">
              <span className="font-medium text-foreground">Out of scope (v1)</span>
            </Row>
            <Row label="Haul cycle simulation">
              <span className="font-medium text-foreground">Out of scope (v1)</span>
            </Row>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function SidecarStatusBadge({
  status,
  error,
}: {
  status?: SidecarStatus;
  error?: string;
}) {
  if (!status) return <span className="text-muted-foreground">—</span>;

  if (status === "running") {
    return (
      <span className="flex items-center gap-1 text-emerald-600">
        <CheckCircle2 className="h-4 w-4" /> Running
      </span>
    );
  }
  if (status === "restarting") {
    return (
      <span className="flex items-center gap-1 text-amber-600">
        <Loader2 className="h-4 w-4 animate-spin" /> Restarting…
      </span>
    );
  }
  return (
    <span className="flex items-center gap-1 text-destructive">
      <XCircle className="h-4 w-4" />
      {error ?? "Crashed"}
    </span>
  );
}
