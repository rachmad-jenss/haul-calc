import type { FC, SVGProps } from "react";
import { cn } from "@/lib/utils";
import { ICON_SIZE, ICON_STROKE_WIDTH } from "./constants";

export type NucleoIconComponent = FC<
  SVGProps<SVGSVGElement> & {
    size?: number | string;
    strokeWidth?: number | string;
  }
>;

/** Shared className + size + strokeWidth for Nucleo Essential outline icons. */
export function nucleoIconProps({
  className,
  size = ICON_SIZE,
  strokeWidth = ICON_STROKE_WIDTH,
}: {
  className?: string;
  size?: number | string;
  strokeWidth?: number | string;
} = {}) {
  return {
    size,
    strokeWidth,
    className: cn("shrink-0", className),
  };
}
