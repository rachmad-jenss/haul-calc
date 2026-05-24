/**
 * Lucide -> Nucleo Essential (outline-18) mapping for HC-VI migration waves.
 * Import target components from `nucleo-ui-essential-outline-18`.
 * Use `nucleoIconProps()` for default 1px stroke.
 */
export const LUCIDE_TO_NUCLEO_MAP = {
  AlertCircle: { nucleo: "IconCircleInfoOutline18", note: "info circle" },
  AlertTriangle: { nucleo: "IconTriangleWarningOutline18", note: "warning" },
  ArrowDownToLine: { nucleo: "IconDesktopArrowDownOutline18", note: "download/export" },
  Calculator: { nucleo: "IconGauge3Outline18", note: "compute action; no calculator glyph in Essential" },
  Check: { nucleo: "IconCheckOutline18", note: "select checkmark" },
  CheckCircle2: { nucleo: "IconCircleHalfDottedCheckOutline18", note: "success state" },
  ChevronDown: { nucleo: "IconChevronDownOutline18", note: "" },
  ChevronUp: { nucleo: "IconChevronUpOutline18", note: "" },
  Circle: { nucleo: "IconProgressBarOutline18", note: "workflow pending; approximate" },
  CircleDot: { nucleo: "IconToggle3Outline18", note: "workflow active; approximate" },
  Clock: { nucleo: "IconAlarmClockOutline18", note: "recent/history" },
  Coins: { nucleo: "IconMoneyBillCoinOutline18", note: "economics" },
  Copy: { nucleo: "IconFiles2Outline18", note: "duplicate row; no copy glyph in Essential" },
  Download: { nucleo: "IconDesktopArrowDownOutline18", note: "export/download" },
  FileJson: { nucleo: "IconFileContentOutline18", note: "structured file" },
  FileOutput: { nucleo: "IconSquareDottedArrowBottomRightOutline18", note: "save as / export" },
  FilePlus: { nucleo: "IconSquarePlusOutline18", note: "new file" },
  FileText: { nucleo: "IconFileContentOutline18", note: "reports/document" },
  FileUp: { nucleo: "IconInboxArrowDownOutline18", note: "import/upload" },
  FolderOpen: { nucleo: "IconFolderOpenOutline18", note: "" },
  GitCompareArrows: { nucleo: "IconSitemap4Outline18", note: "compare; no git-compare in Essential" },
  Layers: { nucleo: "IconLayers3Outline18", note: "pavement layers" },
  LayoutDashboard: { nucleo: "IconWindowChartLineOutline18", note: "dashboard" },
  Loader2: { nucleo: "IconLoaderOutline18", note: "spinner" },
  Monitor: { nucleo: "IconComputerOutline18", note: "system theme" },
  Moon: { nucleo: "IconDarkLightOutline18", note: "ThemeToggle uses combined dark/light icon" },
  Plus: { nucleo: "IconPlusOutline18", note: "" },
  Redo2: {
    nucleo: "IconRefresh2Outline18",
    note: "KNOWN: same glyph as RefreshCw in Essential — distinguish with label/tooltip at usage site",
  },
  RefreshCw: { nucleo: "IconRefresh2Outline18", note: "refresh/recalculate" },
  RotateCcw: { nucleo: "IconArrowDottedRotateAnticlockwiseOutline18", note: "reset" },
  Save: { nucleo: "IconClipboardOutline18", note: "save; no floppy in Essential" },
  Settings: { nucleo: "IconGear2Outline18", note: "" },
  Sun: { nucleo: "IconDarkLightOutline18", note: "ThemeToggle uses combined dark/light icon" },
  Table2: { nucleo: "IconTasks2Outline18", note: "data table view" },
  Trash2: { nucleo: "IconTrashOutline18", note: "" },
  TrendingUp: { nucleo: "IconChartBarTrendUpOutline18", note: "sensitivity" },
  Trophy: { nucleo: "IconAwardOutline18", note: "compare winner" },
  Truck: { nucleo: "IconForkliftOutline18", note: "fleet; closest haul vehicle in Essential" },
  Undo2: { nucleo: "IconArrowDottedRotateAnticlockwiseOutline18", note: "undo" },
  Upload: { nucleo: "IconInboxArrowDownOutline18", note: "CSV import" },
  UserPlus: { nucleo: "IconFacePlusOutline18", note: "add custom vehicle" },
  X: { nucleo: "IconXmarkOutline18", note: "close/remove" },
  XCircle: { nucleo: "IconXmarkOutline18", note: "error; no x-circle in Essential" },
} as const satisfies Record<
  string,
  { nucleo: string; note: string }
>;

export type LucideIconName = keyof typeof LUCIDE_TO_NUCLEO_MAP;
