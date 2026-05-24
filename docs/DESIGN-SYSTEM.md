# HaulCalc Design System (HC-VI)

Reference for the HaulCalc desktop visual identity sprint (initiative **HC-VI**, parent issue DAS-224). Tokens and patterns below match `src/styles/globals.css`, `tailwind.config.ts`, and `src/lib/icons/`.

## Typography

### Font family

- **UI default:** Google Sans Flex Variable (`@fontsource-variable/google-sans-flex`), loaded in the app entry.
- **CSS stack:** `"Google Sans Flex Variable", "Google Sans Flex", system-ui, sans-serif` on `body` (`globals.css`).
- **Tailwind:** `font-sans` maps to the same stack (`tailwind.config.ts`).

### Type scale

Use Tailwind size utilities — do not add arbitrary `text-[Npx]` except documented engineering exceptions (see DAS-234).

| Token   | Size / line-height | Typical use                          |
|---------|--------------------|--------------------------------------|
| `text-2xs` | 12px / 16px     | Footer, captions, section labels     |
| `text-base` | 13px / 18px    | Body copy (default on `body`)        |
| `text-md`   | 14px / 20px    | Slightly emphasized body             |
| `text-lg`   | 16px / 24px    | Subheadings, nav labels              |
| `text-xl`   | 18px / 28px    | Page titles                          |
| `text-2xl`  | 24px / 32px    | Hero / major headings                |

Weights: `font-normal` (400), `font-medium` (500).

### Monospace (`font-mono`)

Reserve for **engineering data** only:

- BoQ tables and numeric columns
- JSON / file previews
- Cross-section dimension labels
- Any value where character alignment aids scanning

Do not use mono for general UI labels or navigation.

## Color tokens

Semantic neutrals replace the legacy blue primary. Components should prefer semantic utilities (`text-strong`, `bg-selected`, etc.) over raw HSL.

### Light mode (`:root`)

| Token | Role |
|-------|------|
| `--text-strong` | Primary text, primary buttons |
| `--text-default` | Body text (`text-body`) |
| `--text-subtle` | Secondary / muted labels |
| `--bg-selected` | Selected nav pill, secondary surfaces |
| `--border-neutral` | Borders and inputs |
| `--background` / `--foreground` | Page background and default text |
| `--destructive` / `--warning` | Error and warning states |

### Dark mode (`.dark`)

Same token names; values invert for readable contrast on `~8%` background. Card surfaces use slightly elevated grays (`--card`).

### Tailwind mapping

| Utility | CSS variable |
|---------|----------------|
| `text-strong` | `--text-strong` |
| `text-body` | `--text-default` |
| `text-subtle` | `--text-subtle` |
| `bg-selected` | `--bg-selected` |
| `bg-background` | `--background` |
| `text-primary` | `--primary` (neutral strong, not blue) |

### Usage rules

- **Active sidebar item:** `bg-selected text-strong` — not `bg-primary` blue.
- **Primary actions:** `bg-primary text-primary-foreground` (strong neutral on light/dark).
- **Warnings:** `text-amber-*` for inline field warnings; `WarningBanner` / `StubBanner` for blocks.

## Icons (Nucleo Essential)

Package: `nucleo-ui-essential-outline-18`.

### Defaults

```tsx
import { IconGear2Outline18 } from "nucleo-ui-essential-outline-18";
import { nucleoIconProps } from "@/lib/icons";

<IconGear2Outline18 {...nucleoIconProps({ size: 16 })} aria-hidden />
```

- **Stroke width:** `1` via `nucleoIconProps()` (`ICON_STROKE_WIDTH` in `src/lib/icons/constants.ts`). Overrides Nucleo’s 1.5px default.
- **Default size:** 18px; nav uses 16px; compact chrome uses 14px.
- **Spinner:** `IconLoaderOutline18` with `className: "animate-spin"`.

### Lucide migration map

`src/lib/icons/lucide-map.ts` documents Lucide → Nucleo equivalents for waves 2–3. New UI must import Nucleo directly — **do not** add `lucide-react`.

### Accessibility

- Decorative icons: `aria-hidden`
- Icon-only buttons: `aria-label` + `title` (see `ThemeToggle`, file bar in `App.tsx`)

## Shell and navigation

Layout: fixed left sidebar (`aside`) + scrollable `main` (`App.tsx`).

### Sidebar nav

- `NavLink` with pill active state: `bg-selected text-strong font-medium`
- Inactive: `text-body hover:bg-selected/60`
- Icons: 16px Nucleo, label `text-base font-medium`

### File bar (top of sidebar)

Icon-only actions with `aria-label` and shortcuts in `title`: New, Open, Save, Save As.

### Theme toggle

Footer control cycles **light → dark → system → light**. Uses `IconDarkLightOutline18` (light/dark) and `IconComputerOutline18` (system). Persists via `useCalcStore` `theme`; applies `dark` class on `<html>` when needed.

## Dark mode

- Strategy: `darkMode: "class"` in Tailwind; toggle adds/removes `dark` on `document.documentElement`.
- System theme: listens to `prefers-color-scheme` when `theme === 'system'`.
- Native title bar: synced via Tauri when not in system mode (`App.tsx`).

## Related issues

| Issue | Focus |
|-------|--------|
| DAS-225 | Font + scale foundation |
| DAS-226 | Semantic palette |
| DAS-227 | Nucleo infrastructure |
| DAS-228–233 | Shell, components, icon migration |
| DAS-234 | Remove ad-hoc font sizes |
| DAS-235 | Remove `lucide-react` dependency |
| DAS-236 | E2E smoke for visual identity |
