import { useEffect, useRef } from "react";
import { check, type Update } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
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
            <div className="text-base font-medium text-strong">Update available: v{info.version}</div>
            {info.date && (
              <div className="text-2xs text-subtle">
                Released: {new Date(info.date).toLocaleDateString()}
              </div>
            )}
            <div className="flex gap-2 pt-1">
              <Button
                size="sm"
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
              >
                Update now
              </Button>
              <Button size="sm" variant="secondary" onClick={() => toast.dismiss("auto-update")}>
                Later
              </Button>
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
