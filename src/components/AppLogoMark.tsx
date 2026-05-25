import { cn } from "@/lib/utils";

/** Transparent haul-road mark for chrome surfaces; uses `currentColor` for theme contrast. */
export function AppLogoMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 512 512"
      className={cn("shrink-0", className)}
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <path
        fill="currentColor"
        fillOpacity={0.14}
        d="M120 372 L256 176 L392 372Z"
      />
      <g
        fill="none"
        stroke="currentColor"
        strokeWidth="32"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M120 372 L256 176 L392 372" />
        <path d="M104 408 H408" />
      </g>
      <g
        fill="none"
        stroke="currentColor"
        strokeWidth="18"
        strokeLinecap="round"
        strokeOpacity={0.55}
      >
        <path d="M168 332 L256 244 L344 332" />
      </g>
    </svg>
  );
}
