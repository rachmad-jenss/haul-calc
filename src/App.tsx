import { useEffect } from "react";
import { NavLink, Outlet } from "react-router-dom";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import {
  Truck,
  Layers,
  Coins,
  FileText,
  Settings as SettingsIcon,
  FolderOpen,
  Save,
  FileOutput,
  TrendingUp,
  LayoutDashboard,
  GitCompareArrows,
} from "lucide-react";
import { ask } from "@tauri-apps/plugin-dialog";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useCalcStore } from "@/lib/store";
import { normalizePersistedFileBinding, resolveActiveFilePath } from "@/lib/file-binding";
import { saveProject, saveAsProject, openProject, openProjectFromPath } from "@/lib/project-file";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useAutoUpdate } from "@/hooks/useAutoUpdate";

const NAV = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/fleet", label: "Fleet & Traffic", icon: Truck },
  { to: "/pavement", label: "Pavement Design", icon: Layers },
  { to: "/economics", label: "Economics", icon: Coins },
  { to: "/reports", label: "Reports", icon: FileText },
  { to: "/sensitivity", label: "Sensitivity", icon: TrendingUp },
  { to: "/compare", label: "Compare", icon: GitCompareArrows },
  { to: "/settings", label: "Settings", icon: SettingsIcon },
] as const;

export default function App() {
  useAutoUpdate();

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

    // Sync native window title bar with the selected theme.
    // Pass null for 'system' so Tauri defers to the OS setting.
    try {
      const nativeTheme = theme === 'system' ? null : theme;
      getCurrentWindow().setTheme(nativeTheme);
    } catch {
      // Not in a Tauri context (e.g. browser / test env) — ignore.
    }

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
      getCurrentWindow().setTitle(`Haul-Calc${baseName}${dirtyStar}`);
    } catch {
      // Ignore if not in Tauri
    }
  }, [activeFileName, hasBoundFile, isProjectDirty]);

  // Intercept window close only when the project has unsaved edits.
  useEffect(() => {
    let unlisten: (() => void) | undefined;
    let cancelled = false;

    void (async () => {
      try {
        const win = getCurrentWindow();
        // Sync handler only — an `async` listener makes Tauri wait for the promise and can block
        // WM_CLOSE even when the project is clean (X appears to do nothing).
        unlisten = await win.onCloseRequested((event) => {
          const dirty = useCalcStore.getState().isProjectDirty;
          if (!dirty) return;

          event.preventDefault();
          void (async () => {
            const failOpen = () => win.destroy();
            try {
              const confirmed = await new Promise<boolean>((resolve, reject) => {
                const timeoutId = window.setTimeout(
                  () => reject(new Error("close dialog timeout")),
                  5000,
                );
                void ask(
                  "You have unsaved changes. Are you sure you want to exit without saving?",
                  { title: "Unsaved Changes", kind: "warning" },
                ).then(
                  (value) => {
                    window.clearTimeout(timeoutId);
                    resolve(value);
                  },
                  (err) => {
                    window.clearTimeout(timeoutId);
                    reject(err);
                  },
                );
              });
              if (confirmed) await failOpen();
            } catch (err) {
              console.error("Close confirmation failed:", err);
              await failOpen();
            }
          })();
        });
        if (cancelled) {
          unlisten();
          unlisten = undefined;
        }
      } catch {
        // Not in a Tauri context (browser / tests)
      }
    })();

    return () => {
      cancelled = true;
      unlisten?.();
    };
  }, []);

  const handleNewProject = async () => {
    if (useCalcStore.getState().isProjectDirty) {
      const confirmed = await ask("You have unsaved changes. Start a new project anyway?", {
        title: "Unsaved Changes",
        kind: "warning",
      });
      if (!confirmed) return;
    }
    resetProject();
    useCalcStore.temporal.getState().clear();
  };

  const displayName =
    hasBoundFile && activeFileName
      ? activeFileName.length > 20
        ? activeFileName.slice(0, 20) + "…"
        : activeFileName
      : null;

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-background text-foreground">
      <aside className="flex w-60 shrink-0 flex-col border-r bg-card">
        <div className="flex h-14 flex-col justify-center border-b px-4 gap-1">
          <div className="flex items-center">
            <span className="text-base font-semibold tracking-tight">Haul Calc</span>
            <span className="ml-2 rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium uppercase text-muted-foreground">
              v{__APP_VERSION__}
            </span>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={handleNewProject}
              className="rounded p-0.5 text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              title="New project (Ctrl+N)"
            >
              <FileText className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => openProject(store).catch((err) => { console.error(err); toast.error(`Open failed: ${err.message}`); })}
              className="rounded p-0.5 text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              title="Open project (Ctrl+O)"
            >
              <FolderOpen className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => saveProject(useCalcStore.getState()).catch((err) => { console.error(err); toast.error(`Save failed: ${err instanceof Error ? err.message : String(err)}`); })}
              className="rounded p-0.5 text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              title="Save (Ctrl+S)"
            >
              <Save className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => saveAsProject(useCalcStore.getState()).catch((err) => { console.error(err); toast.error(`Save As failed: ${err instanceof Error ? err.message : String(err)}`); })}
              className="rounded p-0.5 text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              title="Save As (Ctrl+Shift+S)"
            >
              <FileOutput className="h-3.5 w-3.5" />
            </button>
            {displayName && (
              <span className="truncate text-[10px] text-muted-foreground" title={activeFileName ?? undefined}>
                {displayName}{isProjectDirty ? " *" : ""}
              </span>
            )}
          </div>
        </div>
        <nav className="flex-1 space-y-1 p-2">
          {NAV.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-primary text-primary-foreground"
                    : "text-foreground/80 hover:bg-accent hover:text-accent-foreground",
                )
              }
            >
              <Icon className="h-4 w-4" />
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="border-t p-3 text-[11px] text-muted-foreground">
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
  );
}
