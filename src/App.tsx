import { NavLink, Outlet } from "react-router-dom";
import {
  Truck,
  Layers,
  Coins,
  FileText,
  Settings as SettingsIcon,
  FolderOpen,
  Save,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useCalcStore } from "@/lib/store";
import { saveProject, openProject } from "@/lib/project-file";

const NAV = [
  { to: "/fleet", label: "Fleet & Traffic", icon: Truck },
  { to: "/pavement", label: "Pavement Design", icon: Layers },
  { to: "/economics", label: "Economics", icon: Coins },
  { to: "/reports", label: "Reports", icon: FileText },
  { to: "/settings", label: "Settings", icon: SettingsIcon },
] as const;

export default function App() {
  const store = useCalcStore();
  const { activeFileName, loadFromSnapshot } = store;

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
              v0.1
            </span>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => openProject(loadFromSnapshot).catch(console.error)}
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
          Powered by{" "}
          <a
            href="https://github.com/rachmad-jenss/haul-pave"
            target="_blank"
            rel="noreferrer"
            className="underline"
          >
            haul-pave
          </a>
        </div>
      </aside>

      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}
