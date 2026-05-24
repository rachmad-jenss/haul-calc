import {
  IconComputerOutline18,
  IconDarkLightOutline18,
} from "nucleo-ui-essential-outline-18";
import { nucleoIconProps, type NucleoIconComponent } from "@/lib/icons";

interface ThemeToggleProps {
  theme: 'light' | 'dark' | 'system';
  onToggle: () => void;
}

const ICONS: Record<ThemeToggleProps["theme"], NucleoIconComponent> = {
  light: IconDarkLightOutline18,
  dark: IconDarkLightOutline18,
  system: IconComputerOutline18,
} as const;

const TITLES = {
  light: 'Light mode',
  dark: 'Dark mode',
  system: 'System theme',
} as const;

export function ThemeToggle({ theme, onToggle }: ThemeToggleProps) {
  const Icon = ICONS[theme];
  return (
    <button
      type="button"
      onClick={onToggle}
      className="rounded p-0.5 text-subtle hover:bg-selected hover:text-strong"
      title={TITLES[theme]}
      aria-label={TITLES[theme]}
    >
      <Icon {...nucleoIconProps({ size: 14 })} aria-hidden />
    </button>
  );
}
