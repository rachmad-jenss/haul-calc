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
  TrendingUp,
  LayoutDashboard,
  GitCompareArrows,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useCalcStore } from "@/lib/store";
import { saveProject, openProject, openProjectFromPath } from "@/lib/project-file";
import { ThemeToggle } from "@/components/ThemeToggle";

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
  const store = useCalcStore();
  const { activeFileName, theme, setTheme } = store;

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
      } else if (e.key === "s") {
        e.preventDefault();
        saveProject(useCalcStore.getState()).catch(console.error);
      } else if (e.key === "o") {
        e.preventDefault();
        openProject(useCalcStore.getState()).catch(console.error);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
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

  const displayName = activeFileName
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
              onClick={() => openProject(store).catch(console.error)}
              className="rounded p-0.5 text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              title="Open project"
            >
              <FolderOpen className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => saveProject(store).catch(console.error)}
              className="rounded p-0.5 text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              title="Save project"
            >
              <Save className="h-3.5 w-3.5" />
            </button>
            {displayName && (
              <span className="truncate text-[10px] text-muted-foreground" title={activeFileName ?? undefined}>
                {displayName}
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
