import { readJsonFile, writeJsonFile } from "./io"
import { settingsFile } from "./paths"
import { scrollLines, scrollWheel } from "../ui/scroll"
import { DEFAULT_THEME, hasTheme, type ThemeMode } from "../ui/themes"

export const SETTINGS_VERSION = 1

export type ViewMode = "auto" | "split" | "unified"

export type ScrollSettings = {
  readonly lines: number
  readonly wheel: number
}

export type Settings = {
  readonly version: number
  readonly theme: string
  readonly mode: ThemeMode
  readonly view: ViewMode
  readonly tree: boolean
  readonly single: boolean
  readonly scroll: ScrollSettings
}

export type SettingsOverrides = {
  readonly theme?: string
  readonly mode?: ThemeMode
  readonly view?: ViewMode
  readonly tree?: boolean
  readonly single?: boolean
  readonly scrollLines?: number
  readonly scrollWheel?: number
}

export type SettingsChange = {
  readonly theme?: string
  readonly mode?: ThemeMode
  readonly view?: ViewMode
  readonly tree?: boolean
  readonly single?: boolean
  readonly scroll?: Partial<ScrollSettings>
}

export const DEFAULT_SETTINGS: Settings = {
  version: SETTINGS_VERSION,
  theme: DEFAULT_THEME,
  mode: "dark",
  view: "auto",
  tree: true,
  single: false,
  scroll: { lines: 1, wheel: 1 },
}

export async function loadSettings(file = settingsFile()): Promise<Settings> {
  return parseSettings(await readJsonFile(file))
}

export async function saveSettings(settings: Settings, file = settingsFile()) {
  try {
    await writeJsonFile(file, settings)
    return true
  } catch {
    return false
  }
}

/** Field-by-field validation: unknown or invalid values fall back to defaults. */
export function parseSettings(value: unknown): Settings {
  if (!value || typeof value !== "object") return DEFAULT_SETTINGS
  const input = value as Record<string, unknown>
  const scroll = input.scroll && typeof input.scroll === "object"
    ? input.scroll as Record<string, unknown>
    : {}
  return {
    version: SETTINGS_VERSION,
    theme: typeof input.theme === "string" && hasTheme(input.theme) ? input.theme : DEFAULT_SETTINGS.theme,
    mode: input.mode === "light" || input.mode === "dark" ? input.mode : DEFAULT_SETTINGS.mode,
    view: input.view === "auto" || input.view === "split" || input.view === "unified"
      ? input.view
      : DEFAULT_SETTINGS.view,
    tree: typeof input.tree === "boolean" ? input.tree : DEFAULT_SETTINGS.tree,
    single: typeof input.single === "boolean" ? input.single : DEFAULT_SETTINGS.single,
    scroll: {
      lines: typeof scroll.lines === "number" ? scrollLines(scroll.lines) : DEFAULT_SETTINGS.scroll.lines,
      wheel: typeof scroll.wheel === "number" ? scrollWheel(scroll.wheel) : DEFAULT_SETTINGS.scroll.wheel,
    },
  }
}

export function applyOverrides(settings: Settings, overrides: SettingsOverrides): Settings {
  return {
    ...settings,
    ...(overrides.theme === undefined ? {} : { theme: overrides.theme }),
    ...(overrides.mode === undefined ? {} : { mode: overrides.mode }),
    ...(overrides.view === undefined ? {} : { view: overrides.view }),
    ...(overrides.tree === undefined ? {} : { tree: overrides.tree }),
    ...(overrides.single === undefined ? {} : { single: overrides.single }),
    scroll: {
      lines: overrides.scrollLines === undefined ? settings.scroll.lines : scrollLines(overrides.scrollLines),
      wheel: overrides.scrollWheel === undefined ? settings.scroll.wheel : scrollWheel(overrides.scrollWheel),
    },
  }
}

export function mergeSettings(settings: Settings, change: SettingsChange): Settings {
  return {
    ...settings,
    ...(change.theme === undefined ? {} : { theme: change.theme }),
    ...(change.mode === undefined ? {} : { mode: change.mode }),
    ...(change.view === undefined ? {} : { view: change.view }),
    ...(change.tree === undefined ? {} : { tree: change.tree }),
    ...(change.single === undefined ? {} : { single: change.single }),
    scroll: {
      lines: change.scroll?.lines === undefined ? settings.scroll.lines : scrollLines(change.scroll.lines),
      wheel: change.scroll?.wheel === undefined ? settings.scroll.wheel : scrollWheel(change.scroll.wheel),
    },
  }
}
