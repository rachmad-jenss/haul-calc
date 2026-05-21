import { useEffect, useRef } from "react";
import { check, type Update } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";
import { toast } from "sonner";
import { useCalcStore } from "@/lib/store";

interface UpdateInfo {
  version: string;
  date?: string;
  body?: string;
}

export function useAutoUpdate() {
  const { autoCheckUpdates } = useCalcStore();
  const hasChecked = useRef(false);

  useEffect(() => {
    if (!autoCheckUpdates || hasChecked.current) return;
    hasChecked.current = true;

    let pendingUpdate: Update | null = null;

    const doCheck = async () => {
      try {
        const update = await check();
        if (!update) return;

        pendingUpdate = update;
        const info: UpdateInfo = {
          version: update.version,
          date: update.date ?? undefined,
          body: update.body ?? undefined,
        };

        toast.info(
          <div className="space-y-2">
            <div className="font-medium">Update available: v{info.version}</div>
            {info.date && (
              <div className="text-xs text-muted-foreground">
                Released: {new Date(info.date).toLocaleDateString()}
              </div>
            )}
            <div className="flex gap-2 pt-1">
              <button
                onClick={async () => {
                  toast.dismiss("auto-update");
                  if (!pendingUpdate) return;
                  toast.loading("Downloading update…", { id: "update-download" });
                  try {
                    await pendingUpdate.downloadAndInstall((event) => {
                      if (event.event === "Finished") {
                        toast.success("Update installed. Restarting…", { id: "update-download" });
                      }
                    });
                    await relaunch();
                  } catch (err) {
                    const msg = err instanceof Error ? err.message : String(err);
                    toast.error(`Update failed: ${msg}`, { id: "update-download" });
                  }
                }}
                className="rounded bg-primary px-3 py-1 text-xs font-medium text-primary-foreground hover:bg-primary/90"
              >
                Update now
              </button>
              <button
                onClick={() => toast.dismiss("auto-update")}
                className="rounded bg-muted px-3 py-1 text-xs font-medium hover:bg-muted/80"
              >
                Later
              </button>
            </div>
          </div>,
          {
            id: "auto-update",
            duration: Infinity,
          }
        );
      } catch {
        // Silently ignore auto-check failures on startup
      }
    };

    // Delay slightly to avoid blocking app startup
    const timer = setTimeout(doCheck, 3000);
    return () => clearTimeout(timer);
  }, [autoCheckUpdates]);
}
