import { useCallback, useEffect, useRef, useState } from "react";
import { CheckCircle2, XCircle, RefreshCw, RotateCcw, Loader2, Download } from "lucide-react";
import { check } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";
import { toast } from "sonner";
import { PageHeader } from "@/components/PageHeader";
import { Row } from "@/components/FormFields";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { haulPave, type SidecarStatus } from "@/lib/haulpave-client";
import { useCalcStore } from "@/lib/store";
import type { CallError } from "@/lib/types";
import type { UnitSystem } from "@/lib/unit-convert";

interface Status {
  loaded: boolean;
  error?: string;
  haulpaveVersion: string | null;
  bridgeVersion: string;
  sidecarStatus: SidecarStatus;
}

type UpdateState =
  | { phase: "idle" }
  | { phase: "checking" }
  | { phase: "up-to-date" }
  | { phase: "available"; version: string; date: string | undefined; body: string | undefined }
  | { phase: "downloading"; percent: number }
  | { phase: "ready" }
  | { phase: "error"; message: string };

export default function Settings() {
  const { unitSystem, setUnitSystem, autoCheckUpdates, setAutoCheckUpdates } = useCalcStore();
  const [status, setStatus] = useState<Status | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [restarting, setRestarting] = useState(false);
  const [updateState, setUpdateState] = useState<UpdateState>({ phase: "idle" });
  const [relaunching, setRelaunching] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pendingUpdate = useRef<any>(null);

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

  const checkForUpdates = async () => {
    setUpdateState({ phase: "checking" });
    pendingUpdate.current = null;
    try {
      const update = await check();
      if (!update) {
        setUpdateState({ phase: "up-to-date" });
        return;
      }
      pendingUpdate.current = update;
      setUpdateState({
        phase: "available",
        version: update.version,
        date: update.date ?? undefined,
        body: update.body ?? undefined,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setUpdateState({ phase: "error", message: msg });
      toast.error(`Update check failed: ${msg}`);
    }
  };

  const installUpdate = async () => {
    const update = pendingUpdate.current;
    if (!update) return;
    pendingUpdate.current = null;
    setUpdateState({ phase: "downloading", percent: 0 });
    try {
      let downloaded = 0;
      let total = 0;
      await update.downloadAndInstall((event: { event: string; data: { contentLength?: number; chunkLength: number } }) => {
        if (event.event === "Started") {
          total = event.data.contentLength ?? 0;
        } else if (event.event === "Progress") {
          downloaded += event.data.chunkLength;
          setUpdateState({
            phase: "downloading",
            percent: total > 0 ? Math.round((downloaded / total) * 100) : 0,
          });
        } else if (event.event === "Finished") {
          setUpdateState({ phase: "ready" });
        }
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setUpdateState({ phase: "error", message: msg });
      toast.error(`Update failed: ${msg}`);
    }
  };

  const doRelaunch = async () => {
    setRelaunching(true);
    try {
      await relaunch();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(`Restart failed: ${msg}`);
      setRelaunching(false);
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

      <div className="grid flex-1 auto-rows-min gap-4 overflow-auto p-6 lg:grid-cols-2">
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
            <CardTitle>Updates</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <UpdatePanel
              state={updateState}
              relaunching={relaunching}
              onCheck={checkForUpdates}
              onInstall={installUpdate}
              onRelaunch={doRelaunch}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Keyboard Shortcuts</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            <Row label="New project"><span className="font-mono text-foreground">Ctrl+N</span></Row>
            <Row label="Open project"><span className="font-mono text-foreground">Ctrl+O</span></Row>
            <Row label="Save project"><span className="font-mono text-foreground">Ctrl+S</span></Row>
            <Row label="Save project as"><span className="font-mono text-foreground">Ctrl+Shift+S</span></Row>
            <Row label="Undo"><span className="font-mono text-foreground">Ctrl+Z</span></Row>
            <Row label="Redo"><span className="font-mono text-foreground">Ctrl+Y</span></Row>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Conventions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <Row label="Unit system">
              <UnitSystemToggle value={unitSystem} onChange={setUnitSystem} />
            </Row>
            <Row label="Auto-check updates">
              <AutoCheckToggle value={autoCheckUpdates} onChange={setAutoCheckUpdates} />
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

        <Card>
          <CardHeader>
            <CardTitle>About</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <Row label="App version">
              <span className="font-mono font-medium text-foreground">
                {(globalThis as Record<string, unknown>).__APP_VERSION__ as string ?? "—"}
              </span>
            </Row>
            <Row label="License">
              <span className="font-medium text-foreground">MIT</span>
            </Row>
            <Row label="Source code">
              <a
                href="https://github.com/rachmad-jenss/haul-calc"
                target="_blank"
                rel="noreferrer"
                className="font-medium text-primary underline-offset-4 hover:underline"
              >
                github.com/rachmad-jenss/haul-calc
              </a>
            </Row>
            <Row label="Powered by">
              <a
                href="https://github.com/rachmad-jenss/haul-pave"
                target="_blank"
                rel="noreferrer"
                className="font-medium text-primary underline-offset-4 hover:underline"
              >
                haul-pave
              </a>
            </Row>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function AutoCheckToggle({
  value,
  onChange,
}: {
  value: boolean;
  onChange: (enabled: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2">
      <input
        type="checkbox"
        checked={value}
        onChange={(e) => onChange(e.target.checked)}
        className="accent-primary"
      />
      <span className="text-sm">Check for updates on startup</span>
    </label>
  );
}

function UnitSystemToggle({
  value,
  onChange,
}: {
  value: UnitSystem;
  onChange: (system: UnitSystem) => void;
}) {
  return (
    <div className="flex items-center gap-3">
      {(["SI", "Imperial"] as const).map((sys) => (
        <label key={sys} className="flex cursor-pointer items-center gap-1.5">
          <input
            type="radio"
            name="unit-system"
            value={sys}
            checked={value === sys}
            onChange={() => onChange(sys)}
            className="accent-primary"
          />
          <span className="font-medium text-foreground">
            {sys === "SI" ? "SI (metric)" : "Imperial"}
          </span>
        </label>
      ))}
    </div>
  );
}

function UpdatePanel({
  state,
  relaunching,
  onCheck,
  onInstall,
  onRelaunch,
}: {
  state: UpdateState;
  relaunching: boolean;
  onCheck: () => void;
  onInstall: () => void;
  onRelaunch: () => void;
}) {
  if (state.phase === "idle") {
    return (
      <Button variant="outline" onClick={onCheck} className="w-full">
        <Download className="h-4 w-4" />
        Check for Updates
      </Button>
    );
  }
  if (state.phase === "checking") {
    return (
      <div className="flex items-center gap-2 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Checking for updates…
      </div>
    );
  }
  if (state.phase === "up-to-date") {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2 text-emerald-600">
          <CheckCircle2 className="h-4 w-4" />
          You&apos;re on the latest version.
        </div>
        <Button variant="outline" size="sm" onClick={onCheck}>
          Check again
        </Button>
      </div>
    );
  }
  if (state.phase === "available") {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2 font-medium">
          <Download className="h-4 w-4 text-primary" />
          Version {state.version} available
          {state.date && (
            <span className="font-normal text-muted-foreground">
              ({new Date(state.date).toLocaleDateString()})
            </span>
          )}
        </div>
        {state.body && (
          <p className="text-xs text-muted-foreground line-clamp-3">{state.body}</p>
        )}
        <Button onClick={onInstall} className="w-full">
          <Download className="h-4 w-4" />
          Download &amp; Install
        </Button>
      </div>
    );
  }
  if (state.phase === "downloading") {
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Downloading… {state.percent > 0 ? `${state.percent}%` : ""}
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
          <div
            className="h-full bg-primary transition-all"
            style={{ width: `${state.percent}%` }}
          />
        </div>
      </div>
    );
  }
  if (state.phase === "ready") {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2 text-emerald-600">
          <CheckCircle2 className="h-4 w-4" />
          Update installed. Restart to apply.
        </div>
        <Button onClick={onRelaunch} disabled={relaunching} className="w-full">
          {relaunching ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          {relaunching ? "Restarting…" : "Restart Now"}
        </Button>
      </div>
    );
  }
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-destructive">
        <XCircle className="h-4 w-4" />
        {state.message}
      </div>
      <Button variant="outline" size="sm" onClick={onCheck}>
        Try again
      </Button>
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
