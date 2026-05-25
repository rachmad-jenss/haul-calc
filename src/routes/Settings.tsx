import { useCallback, useEffect, useRef, useState } from "react";
import {
  IconArrowDottedRotateAnticlockwiseOutline18,
  IconCircleHalfDottedCheckOutline18,
  IconDesktopArrowDownOutline18,
  IconLoaderOutline18,
  IconRefresh2Outline18,
  IconXmarkOutline18,
} from "nucleo-ui-essential-outline-18";
import { nucleoIconProps } from "@/lib/icons";
import { check } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";
import { toast } from "sonner";
import { PageHeader } from "@/components/PageHeader";
import { Row } from "@/components/FormFields";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { haulPave, type SidecarStatus } from "@/lib/haulpave-client";
import { useCalcStore, type DisplayCurrency } from "@/lib/store";
import type { CallError } from "@/lib/types";
import type { UnitSystem } from "@/lib/unit-convert";

interface Status {
  loaded: boolean;
  error?: string;
  haulpaveVersion: string | null;
  bridgeVersion: string;
  sidecarStatus: SidecarStatus;
}

const ICON_16 = nucleoIconProps({ size: 16 });
const ICON_16_SPIN = nucleoIconProps({ size: 16, className: "animate-spin" });
const ICON_16_SUCCESS = nucleoIconProps({ size: 16, className: "text-emerald-600" });
const ICON_16_AMBER = nucleoIconProps({ size: 16, className: "text-amber-600" });
const ICON_16_MUTED = nucleoIconProps({ size: 16, className: "text-muted-foreground" });
const ICON_16_DESTRUCTIVE = nucleoIconProps({ size: 16, className: "text-destructive" });
const ICON_16_PRIMARY = nucleoIconProps({ size: 16, className: "text-primary" });

type UpdateState =
  | { phase: "idle" }
  | { phase: "checking" }
  | { phase: "up-to-date" }
  | { phase: "available"; version: string; date: string | undefined; body: string | undefined }
  | { phase: "downloading"; percent: number }
  | { phase: "ready" }
  | { phase: "error"; message: string };

export default function Settings() {
  const {
    unitSystem,
    setUnitSystem,
    autoCheckUpdates,
    setAutoCheckUpdates,
    currency,
    setCurrency,
    usdToIdrRate,
    setUsdToIdrRate,
  } = useCalcStore();
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
      const sidecarStatus = await haulPave.getSidecarStatus();
      try {
        const [health, version] = await Promise.all([
          haulPave.healthCheck(),
          haulPave.getVersion(),
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
          sidecarStatus,
        });
      }
    } catch {
      setStatus({
        loaded: false,
        error: "Unable to read sidecar status",
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
                  <IconLoaderOutline18 {...ICON_16_SPIN} aria-hidden />
                ) : (
                  <IconArrowDottedRotateAnticlockwiseOutline18 {...ICON_16} aria-hidden />
                )}
                {restarting ? "Restarting…" : "Restart Sidecar"}
              </Button>
            )}
            <Button variant="outline" onClick={refresh} disabled={refreshing || restarting}>
              <IconRefresh2Outline18 {...ICON_16} aria-hidden />
              Refresh
            </Button>
          </div>
        }
      />

      <div className="grid flex-1 auto-rows-min gap-4 overflow-auto p-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-md font-medium">Sidecar</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Row label="Process status">
              <SidecarStatusBadge status={status?.sidecarStatus} error={status?.error} />
            </Row>
            <Row label="haul-pave loaded">
              {status?.loaded ? (
                <span className="flex items-center gap-1 text-base text-emerald-600">
                  <IconCircleHalfDottedCheckOutline18 {...ICON_16_SUCCESS} aria-hidden /> Yes
                </span>
              ) : (
                <span className="flex items-center gap-1 text-base text-amber-600">
                  <IconXmarkOutline18 {...ICON_16_AMBER} aria-hidden /> Stub mode
                </span>
              )}
            </Row>
            <Row label="haul-pave version">
              <span className="font-mono text-base text-strong">
                {status?.haulpaveVersion ?? "—"}
              </span>
            </Row>
            <Row label="Bridge version">
              <span className="font-mono text-base text-strong">
                {status?.bridgeVersion ?? "—"}
              </span>
            </Row>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-md font-medium">Updates</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
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
            <CardTitle className="text-md font-medium">Keyboard Shortcuts</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Row label="New project">
              <span className="font-mono text-base text-strong">Ctrl+N</span>
            </Row>
            <Row label="Open project">
              <span className="font-mono text-base text-strong">Ctrl+O</span>
            </Row>
            <Row label="Save project">
              <span className="font-mono text-base text-strong">Ctrl+S</span>
            </Row>
            <Row label="Save project as">
              <span className="font-mono text-base text-strong">Ctrl+Shift+S</span>
            </Row>
            <Row label="Undo">
              <span className="font-mono text-base text-strong">Ctrl+Z</span>
            </Row>
            <Row label="Redo">
              <span className="font-mono text-base text-strong">Ctrl+Y</span>
            </Row>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-md font-medium">Conventions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Row label="Unit system">
              <UnitSystemToggle value={unitSystem} onChange={setUnitSystem} />
            </Row>
            <Row label="Auto-check updates">
              <AutoCheckToggle value={autoCheckUpdates} onChange={setAutoCheckUpdates} />
            </Row>
            <Row label="Currency">
              <CurrencySettings
                currency={currency}
                usdToIdrRate={usdToIdrRate}
                onCurrencyChange={setCurrency}
                onRateChange={setUsdToIdrRate}
              />
            </Row>
            <Row label="Geometric design">
              <span className="text-base text-subtle">Out of scope (v1)</span>
            </Row>
            <Row label="Haul cycle simulation">
              <span className="text-base text-subtle">Out of scope (v1)</span>
            </Row>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-md font-medium">About</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Row label="App version">
              <span className="font-mono text-base font-medium text-strong">
                {__APP_VERSION__}
              </span>
            </Row>
            <Row label="License">
              <span className="text-base font-medium text-strong">MIT</span>
            </Row>
            <Row label="Source code">
              <a
                href="https://github.com/rachmad-jenss/haul-calc"
                target="_blank"
                rel="noreferrer"
                className="text-base font-medium text-primary underline-offset-4 hover:underline"
              >
                github.com/rachmad-jenss/haul-calc
              </a>
            </Row>
            <Row label="Powered by">
              <a
                href="https://github.com/rachmad-jenss/haul-pave"
                target="_blank"
                rel="noreferrer"
                className="text-base font-medium text-primary underline-offset-4 hover:underline"
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

function CurrencySettings({
  currency,
  usdToIdrRate,
  onCurrencyChange,
  onRateChange,
}: {
  currency: DisplayCurrency;
  usdToIdrRate: number;
  onCurrencyChange: (currency: DisplayCurrency) => void;
  onRateChange: (rate: number) => void;
}) {
  const [rateText, setRateText] = useState(String(usdToIdrRate));
  const [rateError, setRateError] = useState<string | null>(null);

  useEffect(() => {
    setRateText(String(usdToIdrRate));
    setRateError(null);
  }, [usdToIdrRate]);

  const commitRate = () => {
    const parsed = Number(rateText.replace(/,/g, ""));
    if (!Number.isFinite(parsed) || parsed <= 0) {
      setRateError("Enter a positive number");
      return;
    }
    setRateError(null);
    onRateChange(parsed);
    setRateText(String(parsed));
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-3">
        {(["USD", "IDR"] as const).map((code) => (
          <label key={code} className="flex cursor-pointer items-center gap-1.5">
            <input
              type="radio"
              name="display-currency"
              value={code}
              checked={currency === code}
              onChange={() => onCurrencyChange(code)}
              className="accent-primary"
            />
            <span className="text-base font-medium text-strong">{code}</span>
          </label>
        ))}
      </div>
      {currency === "IDR" && (
        <div className="space-y-1">
          <label className="flex flex-wrap items-center gap-2 text-base text-subtle">
            <span>USD to IDR rate</span>
            <input
              type="text"
              inputMode="decimal"
              value={rateText}
              onChange={(e) => {
                setRateText(e.target.value);
                setRateError(null);
              }}
              onBlur={commitRate}
              onKeyDown={(e) => {
                if (e.key === "Enter") commitRate();
              }}
              className="w-32 rounded-md border border-border bg-background px-2 py-1 font-mono text-strong"
              aria-invalid={rateError != null}
            />
          </label>
          {rateError && (
            <p className="text-sm text-destructive" role="alert">
              {rateError}
            </p>
          )}
        </div>
      )}
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
      <span className="text-base text-strong">Check for updates on startup</span>
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
          <span className="text-base font-medium text-strong">
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
        <IconDesktopArrowDownOutline18 {...ICON_16} aria-hidden />
        Check for Updates
      </Button>
    );
  }
  if (state.phase === "checking") {
    return (
      <div className="flex items-center gap-2 text-base text-subtle">
        <IconLoaderOutline18 {...ICON_16_SPIN} aria-hidden />
        Checking for updates…
      </div>
    );
  }
  if (state.phase === "up-to-date") {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2 text-base text-emerald-600">
          <IconCircleHalfDottedCheckOutline18 {...ICON_16_SUCCESS} aria-hidden />
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
        <div className="flex flex-wrap items-center gap-2 text-base font-medium text-strong">
          <IconDesktopArrowDownOutline18 {...ICON_16_PRIMARY} aria-hidden />
          Version {state.version} available
          {state.date && (
            <span className="font-normal text-subtle">
              ({new Date(state.date).toLocaleDateString()})
            </span>
          )}
        </div>
        {state.body && (
          <p className="line-clamp-3 text-2xs text-subtle">{state.body}</p>
        )}
        <Button onClick={onInstall} className="w-full">
          <IconDesktopArrowDownOutline18 {...ICON_16} aria-hidden />
          Download &amp; Install
        </Button>
      </div>
    );
  }
  if (state.phase === "downloading") {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2 text-base text-subtle">
          <IconLoaderOutline18 {...ICON_16_SPIN} aria-hidden />
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
        <div className="flex items-center gap-2 text-base text-emerald-600">
          <IconCircleHalfDottedCheckOutline18 {...ICON_16_SUCCESS} aria-hidden />
          Update installed. Restart to apply.
        </div>
        <Button onClick={onRelaunch} disabled={relaunching} className="w-full">
          {relaunching ? <IconLoaderOutline18 {...ICON_16_SPIN} aria-hidden /> : null}
          {relaunching ? "Restarting…" : "Restart Now"}
        </Button>
      </div>
    );
  }
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-base text-destructive">
        <IconXmarkOutline18 {...ICON_16_DESTRUCTIVE} aria-hidden />
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
  if (!status) return <span className="text-base text-subtle">—</span>;

  if (status === "running") {
    return (
      <span className="flex items-center gap-1 text-base text-emerald-600">
        <IconCircleHalfDottedCheckOutline18 {...ICON_16_SUCCESS} aria-hidden /> Running
      </span>
    );
  }
  if (status === "restarting") {
    return (
      <span className="flex items-center gap-1 text-base text-amber-600">
        <IconLoaderOutline18 {...ICON_16_SPIN} aria-hidden /> Restarting…
      </span>
    );
  }
  if (status === "killed") {
    return (
      <span className="flex items-center gap-1 text-base text-subtle">
        <IconXmarkOutline18 {...ICON_16_MUTED} aria-hidden /> Stopped
      </span>
    );
  }
  return (
    <span className="flex items-center gap-1 text-base text-destructive">
      <IconXmarkOutline18 {...ICON_16_DESTRUCTIVE} aria-hidden />
      {error ?? "Crashed"}
    </span>
  );
}
