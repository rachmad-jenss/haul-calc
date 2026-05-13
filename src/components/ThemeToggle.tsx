import { Sun, Moon, Monitor } from "lucide-react";

interface ThemeToggleProps {
  theme: 'light' | 'dark' | 'system';
  onToggle: () => void;
}

const ICONS = {
  light: Sun,
  dark: Moon,
  system: Monitor,
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
      onClick={onToggle}
      className="rounded p-0.5 text-muted-foreground hover:bg-accent hover:text-accent-foreground"
      title={TITLES[theme]}
    >
      <Icon className="h-3.5 w-3.5" />
    </button>
  );
}
