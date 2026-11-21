import type { DiffSource } from "./model"
import {
  SCROLL_LINES_MAX,
  SCROLL_LINES_MIN,
  SCROLL_WHEEL_MAX,
  SCROLL_WHEEL_MIN,
} from "./ui/scroll"
import { DEFAULT_THEME, hasTheme, type ThemeMode } from "./ui/themes"
import type { ViewerPreferences } from "./ui/viewer"

export type CliArguments =
  | { type: "help" }
  | { type: "version" }
  | { type: "themes" }
  | { type: "saved" }
  | {
      type: "run"
      cwd: string
      source: DiffSource
      base?: string
      patch?: string
      open?: string
      theme: string
      mode: ThemeMode
      preferences: ViewerPreferences
    }

export function parseArguments(argv: readonly string[]): CliArguments {
  let cwd = process.cwd()
  let source: DiffSource = "branch"
  let base: string | undefined
  let patch: string | undefined
  let theme = DEFAULT_THEME
  let mode: ThemeMode = "dark"
  let view: ViewerPreferences["view"] = "auto"
  let tree = true
  let single = false
  let scrollLines: number | undefined
  let scrollWheel: number | undefined
  let open: string | undefined
  let saved = false
  let sourceExplicit = false
  let help = false
  let version = false
  let themes = false

  for (let index = 0; index < argv.length; index++) {
    const argument = argv[index]!
    if (argument === "-") {
      if (patch) throw new Error("Only one patch input may be specified.")
      patch = "-"
      continue
    }
    if (argument === "--help" || argument === "-h") {
      help = true
      continue
    }
    if (argument === "--version") {
      version = true
      continue
    }
    if (argument === "--list-themes") {
      themes = true
      continue
    }
    if (argument === "--list-saved") {
      saved = true
      continue
    }
    if (argument === "--no-tree") {
      tree = false
      continue
    }
    if (argument === "--single") {
      single = true
      continue
    }
    const [flag, inline] = argument.split("=", 2)
    const value = () => {
      if (inline !== undefined) return inline
      const next = argv[++index]
      if (!next || next.startsWith("--")) throw new Error(`${flag} requires a value.`)
      return next
    }
    if (flag === "--cwd") cwd = value()
    else if (flag === "--source") {
      source = parseChoice(flag, value(), ["branch", "committed", "working"])
      sourceExplicit = true
    }
    else if (flag === "--base") base = value()
    else if (flag === "--patch") patch = value()
    else if (flag === "--open") open = value()
    else if (flag === "--theme") {
      const name = value()
      if (!hasTheme(name)) throw new Error(`Unknown theme: ${name}. Use --list-themes.`)
      theme = name
    } else if (flag === "--mode") mode = parseChoice(flag, value(), ["dark", "light"])
    else if (flag === "--view") view = parseChoice(flag, value(), ["auto", "split", "unified"])
    else if (flag === "--scroll-lines") scrollLines = parseNumber(flag, value(), SCROLL_LINES_MIN, SCROLL_LINES_MAX, true)
    else if (flag === "--scroll-wheel") scrollWheel = parseNumber(flag, value(), SCROLL_WHEEL_MIN, SCROLL_WHEEL_MAX)
    else throw new Error(`Unknown argument: ${argument}`)
  }

  if (help) return { type: "help" }
  if (version) return { type: "version" }
  if (themes) return { type: "themes" }
  if (saved) {
    if (open) throw new Error("--open cannot be used with --list-saved.")
    return { type: "saved" }
  }
  if (open && patch) throw new Error("--open cannot be used with patch input.")
  if (open && (base || sourceExplicit)) throw new Error("--open cannot be used with --base or --source.")
  if (patch && base) throw new Error("--base cannot be used with patch input.")
  if (patch && source !== "branch") throw new Error("--source cannot be used with patch input.")
  return {
    type: "run",
    cwd,
    source,
    base,
    patch,
    ...(open === undefined ? {} : { open }),
    theme,
    mode,
    preferences: {
      view,
      tree,
      single,
      ...(scrollLines === undefined ? {} : { scrollLines }),
      ...(scrollWheel === undefined ? {} : { scrollWheel }),
    },
  }
}

function parseChoice<const T extends string>(flag: string, value: string, choices: readonly T[]): T {
  if (choices.includes(value as T)) return value as T
  throw new Error(`${flag} must be one of: ${choices.join(", ")}.`)
}

function parseNumber(flag: string, value: string, min: number, max: number, integer = false) {
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || (integer && !Number.isInteger(parsed))) {
    throw new Error(`${flag} requires ${integer ? "an integer" : "a number"}.`)
  }
  if (parsed < min || parsed > max) throw new Error(`${flag} must be between ${min} and ${max}.`)
  return parsed
}

export const HELP = `ocdiff 0.1.0
A standalone terminal diff viewer extracted from OpenCode's TUI

Usage:
  ocdiff [options]
  ocdiff --patch <file>
  git diff HEAD | ocdiff -

Git options:
  --cwd <directory>          Repository directory (default: cwd)
  --base <ref>               Comparison base (default: upstream or main)
  --source <source>          branch, committed, or working (default: branch)

Input:
  --patch <file>             Read a unified diff from a file; use - for stdin
  -                          Read a unified diff from stdin

Saved reviews:
  --list-saved               List saved reviews
  --open <name|id>           Open a saved review snapshot

Display:
  --theme <name>             Color theme (default: opencode2)
  --mode <mode>              dark or light (default: dark)
  --list-themes              List available color themes
  --view <mode>              auto, split, or unified (default: auto)
  --scroll-lines <n>         Lines per j/k or arrow key (1-20, default: 1)
  --scroll-wheel <n>         Mouse wheel speed multiplier (0.25-5, default: 1)
  --no-tree                  Hide the file tree
  --single                   Show one file at a time

Other:
  -h, --help                 Show this help
  --version                  Show the version

Keys:
  j/k scroll  [/] hunks  n/p files  b tree  s single  v view
  d source  t/T theme  m reviewed  ctrl+s save  r saved  ? help
  q/Esc close
`
