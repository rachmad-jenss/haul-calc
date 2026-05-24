# HaulCalc Design System (HC-VI)

Reference for the HaulCalc desktop visual identity sprint (initiative **HC-VI**, parents DAS-224 and DAS-251). Tokens and patterns below match `src/styles/globals.css`, `tailwind.config.ts`, and `src/lib/icons/`.

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

**Migration note:** Some routes may still use default Tailwind `text-xs` / `text-sm` where equivalent to `text-2xs` / `text-md`. Prefer the HC-VI scale above for new edits; do not add arbitrary `text-[Npx]`.

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
| `text-foreground` / `text-muted-foreground` | `--foreground` / `--text-subtle` |
| `bg-card` | Sidebar and elevated surfaces |
| `border-border` | Default border (`--border` → `--border-neutral`) |
| `bg-warning` / `text-warning` | Block warning banners |

### Usage rules

- **Active sidebar item:** `bg-selected text-strong` — not `bg-primary` blue.
- **Inactive nav:** `text-body hover:bg-selected/60 hover:text-strong`.
- **Primary actions:** `bg-primary text-primary-foreground` (strong neutral on light/dark).
- **Block warnings:** `WarningBanner` / `StubBanner` use semantic `warning` tokens.
- **Inline field warnings:** `text-amber-600 dark:text-amber-400` on the field hint line.

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

`src/lib/icons/lucide-map.ts` documents Lucide → Nucleo equivalents for waves 2–3. New UI must import Nucleo directly — **do not** add `lucide-react` (removed in DAS-235).

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
- In-app theme: `dark` class on `<html>` via `App.tsx`; Tauri `setTitle` reflects file + dirty state (native window theme API is not wired yet).

## Scrollbars

Global scrollbar styling lives in `src/styles/globals.css` (`@layer base`).

### Tokens

| Variable | Role |
|----------|------|
| `--scrollbar-track` | Track background (maps to `--bg-selected`) |
| `--scrollbar-thumb` | Thumb fill (light ~78% gray; dark ~38%) |
| `--scrollbar-thumb-hover` | Thumb hover state |

### Implementation

- **Firefox:** `scrollbar-width: thin` and `scrollbar-color` on `*`.
- **WebKit:** `::-webkit-scrollbar` (10px), rounded thumb with 2px track border.

Apply to any scrollable region (`main`, tables, dialogs). Avoid nesting `overflow-auto` panels without need — double scrollbars are a common regression on Fleet and Pavement.

## Toasts (Sonner)

Configured in `src/main.tsx` (`<Toaster position="top-right" closeButton />`). Global toast chrome is in `globals.css` under `[data-sonner-toaster]` and `[data-sonner-toast]`.

### Patterns

- **Default:** `toast.success()`, `toast.error()`, `toast.info()`, `toast.warning()`, and `toast.loading()` (use `{ id }` when updating a loading toast) — RPC outcomes, import/export, validation, and long-running actions.
- **Styling:** `globals.css` sets title/description typography tokens; `toastOptions.classNames` in `main.tsx` adds surface/border classes. Do not add ad-hoc button classes inside individual `toast()` calls.
- **Typography:** Toast title uses `--text-strong` (500 weight); description uses `--text-subtle` at `text-base` scale (13px).

### Accessibility

- Toasts are announced by the live region Sonner provides; keep messages short and actionable.
- Do not rely on toast alone for field-level validation — use inline errors (see UX polish issues).

## Custom title bar

`src/components/TitleBar.tsx` replaces native window decorations (`decorations: false` in `src-tauri/tauri.conf.json`).

### Layout

- Height: `h-9` (36px), `border-b`, `bg-card`.
- **Drag region:** `data-tauri-drag-region` on the left cluster (app name + optional subtitle).
- **Window controls:** Minimize, maximize/restore, close — Nucleo @ 14px, `aria-label` on each button.
- **Test hook:** `data-testid="app-titlebar"`.

### Subtitle / dirty state

`App.tsx` passes `subtitle`:

- Bound file: `filename` + ` *` when `isProjectDirty`
- No file but dirty: `Unsaved project *`

File name in the sidebar file bar is separate (truncated display); title bar subtitle is the canonical dirty indicator in E2E.

## Confirm dialogs

Destructive or data-loss flows use `ConfirmDialog` (`src/components/ConfirmDialog.tsx`) built on Radix `Dialog` — **not** native `window.confirm` or Tauri `ask()`.

| Flow | Trigger | Copy highlights |
|------|---------|-----------------|
| Exit with unsaved changes | Close window while dirty | "Exit without saving" / "Stay" |
| New project while dirty | File bar **New project** or Ctrl+N | "New project" / "Cancel" |

### vs feature modals

- **ConfirmDialog:** binary confirm/cancel, `max-w-md`, destructive confirm uses `variant="destructive"`.
- **Feature modals** (e.g. Custom Vehicles): full `Dialog` content with forms — see `CustomVehicleModal.tsx`.

Radix overlay: `bg-background/80 backdrop-blur-sm`, content `bg-card shadow-lg` (`src/components/ui/dialog.tsx`).

## Page fidelity checklist

Use when adding or refactoring a route under `src/routes/`:

1. **Typography:** `text-base` / `text-2xs` / `text-md` / `text-lg` — no new arbitrary `text-[Npx]` or legacy `text-sm` unless matching an existing exception.
2. **Colors:** `text-strong`, `text-body`, `text-subtle`, `bg-selected`, `border-border` — no raw blue primary for nav or chips.
3. **Icons:** Nucleo via `nucleoIconProps()` — no Lucide class names in markup or tests.
4. **Spacing:** Card sections `space-y-3`; page headers consistent with sibling routes (see Dashboard, Fleet, Settings passes).
5. **Forms:** Native `<select>` only where Radix Select is not yet wired; prefer shared `Select` when available.
6. **Feedback:** Inline Zod errors on compute/save paths; block warnings via `WarningBanner` tokens.
7. **Scroll:** One primary scroll container per page; tables inside `overflow-auto` only when needed.
8. **E2E:** Add or extend `tests/smoke/` when changing shell, dialogs, or cross-route navigation.

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
| DAS-251 | Parent: UI Fidelity — Pages and Surfaces (Wave 4) |
| DAS-252 | Global scrollbar styling |
| DAS-253 | Sonner toast theme |
| DAS-254 | Dialog overlay polish |
| DAS-255 | Custom window titlebar |
| DAS-256 | Migrate `ask()` to in-app Dialog |
| DAS-257–264 | Per-route page UI passes |
| DAS-265 | E2E smoke — UI fidelity wave |
| DAS-266 | Design system docs (this file, Wave 4 surfaces) |
