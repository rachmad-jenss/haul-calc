import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { NavLink, Outlet } from "react-router-dom";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import {
  IconArrowDottedRotateAnticlockwiseOutline18,
  IconChartBarTrendUpOutline18,
  IconClipboardOutline18,
  IconFileContentOutline18,
  IconFolderOpenOutline18,
  IconForkliftOutline18,
  IconGear2Outline18,
  IconLayers3Outline18,
  IconMoneyBillCoinOutline18,
  IconRefresh2Outline18,
  IconSitemap4Outline18,
  IconSquareDottedArrowBottomRightOutline18,
  IconSquarePlusOutline18,
  IconWindowChartLineOutline18,
} from "nucleo-ui-essential-outline-18";
import { nucleoIconProps, type NucleoIconComponent } from "@/lib/icons";
import { useStore } from "zustand";
import { useShallow } from "zustand/react/shallow";
import { exit } from "@tauri-apps/plugin-process";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useCalcStore } from "@/lib/store";
import { normalizePersistedFileBinding, resolveActiveFilePath } from "@/lib/file-binding";
import { saveProject, saveAsProject, openProject, openProjectFromPath } from "@/lib/project-file";
import { ThemeToggle } from "@/components/ThemeToggle";
import { TitleBar } from "@/components/TitleBar";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { useAutoUpdate } from "@/hooks/useAutoUpdate";

const NAV: { to: string; label: string; icon: NucleoIconComponent }[] = [
  { to: "/dashboard", label: "Dashboard", icon: IconWindowChartLineOutline18 },
  { to: "/fleet", label: "Fleet & Traffic", icon: IconForkliftOutline18 },
  { to: "/pavement", label: "Pavement Design", icon: IconLayers3Outline18 },
  { to: "/economics", label: "Economics", icon: IconMoneyBillCoinOutline18 },
  { to: "/reports", label: "Reports", icon: IconFileContentOutline18 },
  { to: "/sensitivity", label: "Sensitivity", icon: IconChartBarTrendUpOutline18 },
  { to: "/compare", label: "Compare", icon: IconSitemap4Outline18 },
  { to: "/settings", label: "Settings", icon: IconGear2Outline18 },
];

const FILE_BAR_ICON = nucleoIconProps({ size: 16 });
const NAV_ICON = nucleoIconProps({ size: 16 });

let closeGuardUnlisten: (() => void) | undefined;

export default function App() {
  useAutoUpdate();
  const { canUndo, canRedo, undo, redo } = useStore(
    useCalcStore.temporal,
    useShallow((s) => ({
      canUndo: s.pastStates.length > 0,
      canRedo: s.futureStates.length > 0,
      undo: s.undo,
      redo: s.redo,
    })),
  );
  const [exitConfirmOpen, setExitConfirmOpen] = useState(false);
  const [newProjectConfirmOpen, setNewProjectConfirmOpen] = useState(false);
  /** Scoped to App lifecycle — reset on effect cleanup so a stuck dialog cannot block future closes. */
  const closeConfirmInFlightRef = useRef(false);
  const isForceClosingRef = useRef(false);
  const forceExitRef = useRef<(() => Promise<void>) | null>(null);
  const exitFailOpenTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const store = useCalcStore();
  const { activeFileName, activeFilePath, recentFiles, theme, setTheme, isProjectDirty, resetProject } =
    store;
  const boundFilePath = resolveActiveFilePath({ activeFilePath, activeFileName, recentFiles });
  const hasBoundFile = Boolean(boundFilePath);

  useEffect(() => {
    const apply = () => {
      const state = useCalcStore.getState();
      const patch = normalizePersistedFileBinding(state);
      if (patch) useCalcStore.setState(patch);
    };
    apply();
    const id = window.setTimeout(apply, 0);
    return () => window.clearTimeout(id);
  }, []);

  // Open a .hcalc file passed as a CLI arg at launch (double-click in File Explorer).
  // Uses a drainable slot so React StrictMode double-invoke is safe.
  useEffect(() => {
    invoke<string | null>("take_pending_file_path")
      .then((path) => { if (path) return openProjectFromPath(path, store); })
      .catch(console.error);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Wake-up signal from single-instance plugin when second launch carries a .hcalc file.
  // Drains the same buffered slot instead of relying on the event payload.
  useEffect(() => {
    const unlisten = listen<null>("file-open", () => {
      invoke<string | null>("take_pending_file_path")
        .then((path) => { if (path) return openProjectFromPath(path, store); })
        .catch(console.error);
    });
    return () => { unlisten.then((fn) => fn()); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Native menu bar (DAS-196) — same handlers as keyboard shortcuts.
  useEffect(() => {
    const unlisten = listen<string>("menu-action", (event) => {
      const id = event.payload;
      if (id === "file_new") {
        void handleNewProject();
      } else if (id === "file_open") {
        openProject(useCalcStore.getState()).catch((err) => {
          console.error(err);
          toast.error(`Open failed: ${err instanceof Error ? err.message : String(err)}`);
        });
      } else if (id === "file_save") {
        saveProject(useCalcStore.getState()).catch((err) => {
          console.error(err);
          toast.error(`Save failed: ${err instanceof Error ? err.message : String(err)}`);
        });
      } else if (id === "file_save_as") {
        saveAsProject(useCalcStore.getState()).catch((err) => {
          console.error(err);
          toast.error(`Save As failed: ${err instanceof Error ? err.message : String(err)}`);
        });
      } else if (id === "file_exit") {
        getCurrentWindow().close().catch(console.error);
      } else if (id === "edit_undo") {
        useCalcStore.temporal.getState().undo();
      } else if (id === "edit_redo") {
        useCalcStore.temporal.getState().redo();
      }
    });
    return () => { unlisten.then((fn) => fn()); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.repeat) return;
      if (!(e.ctrlKey || e.metaKey)) return;
      const t = e.target;
      if (t instanceof HTMLElement && (t.matches("input, textarea, select") || t.isContentEditable)) return;
      const key = e.key.toLowerCase();
      if (key === "z" && !e.shiftKey) {
        e.preventDefault();
        useCalcStore.temporal.getState().undo();
      } else if (key === "y" || (key === "z" && e.shiftKey)) {
        e.preventDefault();
        useCalcStore.temporal.getState().redo();
      } else if (key === "s") {
        e.preventDefault();
        if (e.shiftKey) {
          saveAsProject(useCalcStore.getState()).catch((err) => {
            console.error(err);
            toast.error(`Save As failed: ${err instanceof Error ? err.message : String(err)}`);
          });
        } else {
          saveProject(useCalcStore.getState()).catch((err) => {
            console.error(err);
            toast.error(`Save failed: ${err instanceof Error ? err.message : String(err)}`);
          });
        }
      } else if (key === "o") {
        e.preventDefault();
        openProject(useCalcStore.getState()).catch((err) => {
          console.error(err);
          toast.error(`Open failed: ${err instanceof Error ? err.message : String(err)}`);
        });
      } else if (key === "n") {
        e.preventDefault();
        handleNewProject();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') { root.classList.add('dark'); }
    else if (theme === 'light') { root.classList.remove('dark'); }

    if (theme !== 'system') return;

    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const apply = (e: MediaQueryListEvent | MediaQueryList) => {
      if (e.matches) { root.classList.add('dark'); } else { root.classList.remove('dark'); }
    };
    apply(mq);
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, [theme]);

  // Sync window title with active file and dirty state (only when path is bound)
  useEffect(() => {
    try {
      const baseName = hasBoundFile && activeFileName ? ` - ${activeFileName}` : "";
      const dirtyStar = isProjectDirty ? " *" : "";
      getCurrentWindow().setTitle(`HaulCalc${baseName}${dirtyStar}`);
    } catch {
      // Ignore if not in Tauri
    }
  }, [activeFileName, hasBoundFile, isProjectDirty]);

  useEffect(() => {
    if (!isProjectDirty) {
      setExitConfirmOpen(false);
      if (exitFailOpenTimerRef.current) {
        clearTimeout(exitFailOpenTimerRef.current);
        exitFailOpenTimerRef.current = null;
      }
    }
  }, [isProjectDirty]);

  // Register close guard only while dirty. A permanent listener blocks WM_CLOSE on Windows
  // even when the project is clean; useLayoutEffect minimizes the attach race after edits.
  useLayoutEffect(() => {
    if (!isProjectDirty) {
      closeGuardUnlisten?.();
      closeGuardUnlisten = undefined;
      closeConfirmInFlightRef.current = false;
      return;
    }

    let cancelled = false;

    void (async () => {
      try {
        const win = getCurrentWindow();
        const unlisten = await win.onCloseRequested((event) => {
          if (isForceClosingRef.current) return;
          event.preventDefault();
          if (closeConfirmInFlightRef.current) return;
          closeConfirmInFlightRef.current = true;
          forceExitRef.current = async () => {
            isForceClosingRef.current = true;
            setExitConfirmOpen(false);
            try {
              await win.destroy();
            } catch {
              // ignore
            }
            await exit(0);
          };
          setExitConfirmOpen(true);
          if (exitFailOpenTimerRef.current) clearTimeout(exitFailOpenTimerRef.current);
          exitFailOpenTimerRef.current = setTimeout(() => {
            if (!closeConfirmInFlightRef.current) return;
            void forceExitRef.current?.();
          }, 5000);
        });
        if (cancelled) {
          unlisten();
        } else {
          closeGuardUnlisten?.();
          closeGuardUnlisten = unlisten;
        }
      } catch {
        // Not in a Tauri context (browser / tests)
      }
    })();

    return () => {
      cancelled = true;
      closeConfirmInFlightRef.current = false;
      closeGuardUnlisten?.();
      closeGuardUnlisten = undefined;
    };
  }, [isProjectDirty]);

  const startNewProject = () => {
    resetProject();
    useCalcStore.temporal.getState().clear();
  };

  const handleNewProject = () => {
    if (exitConfirmOpen || newProjectConfirmOpen) return;
    if (useCalcStore.getState().isProjectDirty) {
      setNewProjectConfirmOpen(true);
      return;
    }
    startNewProject();
  };

  const titleBarSubtitle =
    hasBoundFile && activeFileName
      ? `${activeFileName}${isProjectDirty ? " *" : ""}`
      : isProjectDirty
        ? "Unsaved project *"
        : null;

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-background text-foreground">
      <TitleBar subtitle={titleBarSubtitle} />
      <div className="flex min-h-0 flex-1 overflow-hidden">
      <aside className="flex w-60 shrink-0 flex-col border-r bg-card">
        <div className="flex h-14 flex-col justify-center gap-1.5 border-b px-3 py-2">
          <div className="flex items-center gap-2">
            <span className="text-base font-semibold tracking-tight">HaulCalc</span>
            <span className="rounded bg-muted px-1.5 py-0.5 text-2xs font-medium uppercase text-subtle">
              v{__APP_VERSION__}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-0.5">
            <button
              type="button"
              onClick={() => undo()}
              disabled={!canUndo}
              className="rounded p-1 text-subtle hover:bg-selected hover:text-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-40 disabled:pointer-events-none"
              title="Undo (Ctrl+Z)"
              aria-label="Undo"
            >
              <IconArrowDottedRotateAnticlockwiseOutline18 {...FILE_BAR_ICON} aria-hidden />
            </button>
            <button
              type="button"
              onClick={() => redo()}
              disabled={!canRedo}
              className="rounded p-1 text-subtle hover:bg-selected hover:text-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-40 disabled:pointer-events-none"
              title="Redo (Ctrl+Y)"
              aria-label="Redo"
            >
              <IconRefresh2Outline18 {...FILE_BAR_ICON} aria-hidden />
            </button>
            <button
              type="button"
              onClick={handleNewProject}
              className="rounded p-1 text-subtle hover:bg-selected hover:text-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              title="New project (Ctrl+N)"
              aria-label="New project"
            >
              <IconSquarePlusOutline18 {...FILE_BAR_ICON} aria-hidden />
            </button>
            <button
              type="button"
              onClick={() => openProject(store).catch((err) => { console.error(err); toast.error(`Open failed: ${err.message}`); })}
              className="rounded p-1 text-subtle hover:bg-selected hover:text-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              title="Open project (Ctrl+O)"
              aria-label="Open project"
            >
              <IconFolderOpenOutline18 {...FILE_BAR_ICON} aria-hidden />
            </button>
            <button
              type="button"
              onClick={() => saveProject(useCalcStore.getState()).catch((err) => { console.error(err); toast.error(`Save failed: ${err instanceof Error ? err.message : String(err)}`); })}
              className="rounded p-1 text-subtle hover:bg-selected hover:text-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              title="Save (Ctrl+S)"
              aria-label="Save project"
            >
              <IconClipboardOutline18 {...FILE_BAR_ICON} aria-hidden />
            </button>
            <button
              type="button"
              onClick={() => saveAsProject(useCalcStore.getState()).catch((err) => { console.error(err); toast.error(`Save As failed: ${err instanceof Error ? err.message : String(err)}`); })}
              className="rounded p-1 text-subtle hover:bg-selected hover:text-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              title="Save As (Ctrl+Shift+S)"
              aria-label="Save project as"
            >
              <IconSquareDottedArrowBottomRightOutline18 {...FILE_BAR_ICON} aria-hidden />
            </button>
          </div>
        </div>
        <nav className="flex-1 space-y-1 p-2">
          {NAV.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-2 rounded-md px-3 py-2 text-base font-medium transition-colors",
                  isActive
                    ? "bg-selected text-strong font-medium"
                    : "text-body hover:bg-selected/60 hover:text-strong",
                )
              }
            >
              <Icon {...NAV_ICON} aria-hidden />
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="border-t p-3 text-2xs text-subtle">
          <div className="flex items-center justify-between">
            <span>
              Powered by{" "}
              <a
                href="https://github.com/rachmad-jenss/haul-pave"
                target="_blank"
                rel="noreferrer"
                className="underline"
              >
                haul-pave
              </a>
            </span>
            <ThemeToggle
              theme={theme}
              onToggle={() => {
                const next = { light: 'dark', dark: 'system', system: 'light' } as const;
                setTheme(next[theme]);
              }}
            />
          </div>
        </div>
      </aside>

      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
      </div>

      <ConfirmDialog
        open={exitConfirmOpen}
        onOpenChange={(open) => {
          setExitConfirmOpen(open);
          if (!open) {
            if (exitFailOpenTimerRef.current) {
              clearTimeout(exitFailOpenTimerRef.current);
              exitFailOpenTimerRef.current = null;
            }
            if (!isForceClosingRef.current) {
              closeConfirmInFlightRef.current = false;
              forceExitRef.current = null;
            }
          }
        }}
        title="Unsaved Changes"
        description="You have unsaved changes. Are you sure you want to exit without saving?"
        confirmLabel="Exit without saving"
        cancelLabel="Stay"
        destructive
        onConfirm={() => {
          if (exitFailOpenTimerRef.current) {
            clearTimeout(exitFailOpenTimerRef.current);
            exitFailOpenTimerRef.current = null;
          }
          void forceExitRef.current?.();
        }}
      />
      <ConfirmDialog
        open={newProjectConfirmOpen}
        onOpenChange={setNewProjectConfirmOpen}
        title="Unsaved Changes"
        description="You have unsaved changes. Start a new project anyway?"
        confirmLabel="New project"
        cancelLabel="Cancel"
        destructive
        onConfirm={() => {
          setNewProjectConfirmOpen(false);
          startNewProject();
        }}
      />
    </div>
  );
}
