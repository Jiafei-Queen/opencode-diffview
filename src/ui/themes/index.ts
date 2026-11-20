import {
  migrateV1,
  parseThemeDocument,
  resolveThemeDocument,
  themeModes,
  type ResolvedTheme,
  type ThemeDocument,
} from "@opencode/theme/tui"
import type { ThemeV1Json } from "@opencode/theme/tui/v1"
import aura from "./assets/aura.json"
import ayu from "./assets/ayu.json"
import carbonfox from "./assets/carbonfox.json"
import catppuccin from "./assets/catppuccin.json"
import catppuccinFrappe from "./assets/catppuccin-frappe.json"
import catppuccinMacchiato from "./assets/catppuccin-macchiato.json"
import cobalt2 from "./assets/cobalt2.json"
import cursor from "./assets/cursor.json"
import dracula from "./assets/dracula.json"
import everforest from "./assets/everforest.json"
import flexoki from "./assets/flexoki.json"
import github from "./assets/github.json"
import gruvbox from "./assets/gruvbox.json"
import kanagawa from "./assets/kanagawa.json"
import lucentOrng from "./assets/lucent-orng.json"
import material from "./assets/material.json"
import matrix from "./assets/matrix.json"
import mercury from "./assets/mercury.json"
import monokai from "./assets/monokai.json"
import nightowl from "./assets/nightowl.json"
import nord from "./assets/nord.json"
import oneDark from "./assets/one-dark.json"
import orng from "./assets/orng.json"
import osakaJade from "./assets/osaka-jade.json"
import palenight from "./assets/palenight.json"
import rosepine from "./assets/rosepine.json"
import solarized from "./assets/solarized.json"
import synthwave84 from "./assets/synthwave84.json"
import tokyonight from "./assets/tokyonight.json"
import vercel from "./assets/vercel.json"
import vesper from "./assets/vesper.json"
import zenburn from "./assets/zenburn.json"
import opencode from "./assets/v2/opencode.json"
import opencode2 from "./assets/v2/opencode2.json"

export type ThemeMode = "dark" | "light"

type ThemeSource = Record<string, unknown>
type Resolution = {
  readonly name: string
  readonly mode: ThemeMode
  readonly theme: ResolvedTheme
}

const V1_THEMES: Record<string, ThemeSource> = {
  aura,
  ayu,
  catppuccin,
  ["catppuccin-frappe"]: catppuccinFrappe,
  ["catppuccin-macchiato"]: catppuccinMacchiato,
  cobalt2,
  cursor,
  dracula,
  everforest,
  flexoki,
  github,
  gruvbox,
  kanagawa,
  ["lucent-orng"]: lucentOrng,
  material,
  matrix,
  mercury,
  monokai,
  nightowl,
  nord,
  ["one-dark"]: oneDark,
  orng,
  ["osaka-jade"]: osakaJade,
  palenight,
  rosepine,
  solarized,
  synthwave84,
  tokyonight,
  vercel,
  vesper,
  zenburn,
  carbonfox,
}

const SOURCES: Record<string, ThemeSource> = {
  ...V1_THEMES,
  opencode,
  opencode2,
}

// OpenCode's newest palettes first, then the bundled v1 presets alphabetically.
export const THEME_ORDER: readonly string[] = [
  "opencode2",
  "opencode",
  ...Object.keys(V1_THEMES).sort(),
]

export const DEFAULT_THEME = "opencode2"

const documents = new Map<string, ThemeDocument>()
const resolutions = new Map<string, Resolution>()

export function themeNames() {
  return THEME_ORDER
}

export function hasTheme(name: string) {
  return THEME_ORDER.includes(name)
}

export function themeLabel(name: string) {
  if (name === "opencode2") return "OpenCode 2"
  if (name === "opencode") return "OpenCode"
  return name
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ")
}

export function nextTheme(name: string, step: number) {
  const index = THEME_ORDER.indexOf(name)
  if (index === -1) return THEME_ORDER[0]!
  const next = (index + step) % THEME_ORDER.length
  return THEME_ORDER[(next + THEME_ORDER.length) % THEME_ORDER.length]!
}

export function resolveTheme(name: string, requested: ThemeMode): Resolution {
  const document = themeDocument(name)
  const modes = themeModes(document)
  const mode = modes.includes(requested) ? requested : (modes[0] ?? requested)
  const key = `${name}:${mode}`
  const cached = resolutions.get(key)
  if (cached) return cached
  const resolution = { name, mode, theme: resolveThemeDocument(document, mode) }
  resolutions.set(key, resolution)
  return resolution
}

function themeDocument(name: string) {
  const cached = documents.get(name)
  if (cached) return cached
  const source = SOURCES[name]
  if (!source) throw new Error(`Unknown theme: ${name}`)
  const document = "theme" in source
    ? migrateV1(source as unknown as ThemeV1Json)
    : parseThemeDocument(source, name)
  documents.set(name, document)
  return document
}
