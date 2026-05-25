import { useEffect, useState, type ReactNode } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import {
  IconAspectRatioSquare2Outline18,
  IconWindowExpandBottomRightOutline18,
  IconXmarkOutline18,
} from "nucleo-ui-essential-outline-18";
import { AppLogoMark } from "@/components/AppLogoMark";
import { nucleoIconProps } from "@/lib/icons";
import { cn } from "@/lib/utils";

const CHROME_ICON = nucleoIconProps({ size: 14 });
const TITLEBAR_HEIGHT = "h-9";

type TitleBarProps = {
  subtitle?: string | null;
};

function ChromeButton({
  label,
  onClick,
  className,
  children,
}: {
  label: string;
  onClick: () => void;
  className?: string;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className={cn(
        "inline-flex h-9 w-10 items-center justify-center text-subtle transition-colors",
        "hover:bg-selected hover:text-strong",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset",
        className,
      )}
    >
      {children}
    </button>
  );
}

export function TitleBar({ subtitle }: TitleBarProps) {
  const [isMaximized, setIsMaximized] = useState(false);

  useEffect(() => {
    let unlisten: (() => void) | undefined;
    void (async () => {
      try {
        const win = getCurrentWindow();
        setIsMaximized(await win.isMaximized());
        unlisten = await win.onResized(async () => {
          setIsMaximized(await win.isMaximized());
        });
      } catch {
        // Not in Tauri (browser / tests)
      }
    })();
    return () => {
      unlisten?.();
    };
  }, []);

  const runWindowAction = (action: () => Promise<void>) => {
    void action().catch(console.error);
  };

  return (
    <header
      className={cn(
        "flex shrink-0 items-center border-b bg-card",
        TITLEBAR_HEIGHT,
      )}
      data-testid="app-titlebar"
    >
      <div
        className="flex min-w-0 flex-1 items-center gap-2 px-3"
        data-tauri-drag-region
      >
        <span className="inline-flex shrink-0" role="img" aria-label="HaulCalc">
          <AppLogoMark className="h-5 w-5 text-strong" />
        </span>
        {subtitle ? (
          <span className="min-w-0 truncate text-2xs text-subtle" title={subtitle}>
            {subtitle}
          </span>
        ) : null}
      </div>
      <div className="flex shrink-0">
        <ChromeButton
          label="Minimize"
          onClick={() => runWindowAction(() => getCurrentWindow().minimize())}
        >
          <span className="block h-px w-3 rounded-full bg-current" aria-hidden />
        </ChromeButton>
        <ChromeButton
          label={isMaximized ? "Restore" : "Maximize"}
          onClick={() => runWindowAction(() => getCurrentWindow().toggleMaximize())}
        >
          {isMaximized ? (
            <IconAspectRatioSquare2Outline18 {...CHROME_ICON} aria-hidden />
          ) : (
            <IconWindowExpandBottomRightOutline18 {...CHROME_ICON} aria-hidden />
          )}
        </ChromeButton>
        <ChromeButton
          label="Close"
          className="hover:bg-destructive hover:text-destructive-foreground"
          onClick={() => runWindowAction(() => getCurrentWindow().close())}
        >
          <IconXmarkOutline18 {...CHROME_ICON} aria-hidden />
        </ChromeButton>
      </div>
    </header>
  );
}
