import { IconTriangleWarningOutline18 } from "nucleo-ui-essential-outline-18";
import { nucleoIconProps } from "@/lib/icons";

export function WarningBanner({ message }: { message?: string }) {
  return (
    <div
      role="alert"
      aria-live="polite"
      className="flex items-start gap-3 rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-md text-warning-foreground"
    >
      <IconTriangleWarningOutline18
        {...nucleoIconProps({ size: 16, className: "mt-0.5 text-warning" })}
        aria-hidden
      />
      <div>
        <span className="font-medium">Warning.</span>{" "}
        <span className="text-warning-foreground/80">
          {message ?? "An issue was detected with the calculation inputs."}
        </span>
      </div>
    </div>
  );
}
