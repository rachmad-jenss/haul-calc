import { useEffect, useState } from "react";
import { CheckCircle2, XCircle, RefreshCw } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { haulPave } from "@/lib/haulpave-client";
import type { CallError } from "@/lib/types";

interface Status {
  loaded: boolean;
  error?: string;
  haulpaveVersion: string | null;
  bridgeVersion: string;
}

export default function Settings() {
  const [status, setStatus] = useState<Status | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const refresh = async () => {
    setRefreshing(true);
    try {
      const [health, version] = await Promise.all([
        haulPave.healthCheck(),
        haulPave.getVersion(),
      ]);
      setStatus({
        loaded: health.data.haulpave_loaded,
        haulpaveVersion: version.data.haulpave,
        bridgeVersion: version.data.bridge,
      });
    } catch (err) {
      const e = err as CallError;
      setStatus({
        loaded: false,
        error: e.message,
        haulpaveVersion: null,
        bridgeVersion: "—",
      });
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    refresh();
  }, []);

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        title="Settings"
        description="Sidecar status, library version, and unit system."
        actions={
          <Button variant="outline" onClick={refresh} disabled={refreshing}>
            <RefreshCw className="h-4 w-4" />
            Refresh
          </Button>
        }
      />

      <div className="grid flex-1 gap-4 overflow-auto p-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Sidecar</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <Row label="Bridge process">
              {status?.error ? (
                <span className="flex items-center gap-1 text-destructive">
                  <XCircle className="h-4 w-4" /> {status.error}
                </span>
              ) : (
                <span className="flex items-center gap-1 text-emerald-600">
                  <CheckCircle2 className="h-4 w-4" /> Running
                </span>
              )}
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

function Row({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between border-b pb-2 last:border-0">
      <span className="text-muted-foreground">{label}</span>
      <span>{children}</span>
    </div>
  );
}
