import type { DiffSource } from "./model"
import type { ThemeMode } from "./ui/theme"
import type { ViewerPreferences } from "./ui/viewer"

export type CliArguments =
  | { type: "help" }
  | { type: "version" }
  | {
      type: "run"
      cwd: string
      source: DiffSource
      base?: string
      patch?: string
      theme: ThemeMode
      preferences: ViewerPreferences
    }

export function parseArguments(argv: readonly string[]): CliArguments {
  let cwd = process.cwd()
  let source: DiffSource = "branch"
  let base: string | undefined
  let patch: string | undefined
  let theme: ThemeMode = "dark"
  let view: ViewerPreferences["view"] = "auto"
  let tree = true
  let single = false
  let help = false
  let version = false

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
    else if (flag === "--source") source = parseChoice(flag, value(), ["branch", "committed", "working"])
    else if (flag === "--base") base = value()
    else if (flag === "--patch") patch = value()
    else if (flag === "--theme") theme = parseChoice(flag, value(), ["dark", "light"])
    else if (flag === "--view") view = parseChoice(flag, value(), ["auto", "split", "unified"])
    else throw new Error(`Unknown argument: ${argument}`)
  }

  if (help) return { type: "help" }
  if (version) return { type: "version" }
  if (patch && base) throw new Error("--base cannot be used with patch input.")
  if (patch && source !== "branch") throw new Error("--source cannot be used with patch input.")
  return { type: "run", cwd, source, base, patch, theme, preferences: { view, tree, single } }
}

function parseChoice<const T extends string>(flag: string, value: string, choices: readonly T[]): T {
  if (choices.includes(value as T)) return value as T
  throw new Error(`${flag} must be one of: ${choices.join(", ")}.`)
}

export const HELP = `diffview 0.1.0
A standalone terminal diff viewer

Usage:
  diffview [options]
  diffview --patch <file>
  git diff HEAD | diffview -

Git options:
  --cwd <directory>          Repository directory (default: cwd)
  --base <ref>               Comparison base (default: upstream or main)
  --source <source>          branch, committed, or working (default: branch)

Input:
  --patch <file>             Read a unified diff from a file; use - for stdin
  -                          Read a unified diff from stdin

Display:
  --view <mode>              auto, split, or unified (default: auto)
  --no-tree                  Hide the file tree
  --single                   Show one file at a time
  --theme <mode>             dark or light (default: dark)

Other:
  -h, --help                 Show this help
  --version                  Show the version

Keys:
  j/k scroll  [/] hunks  n/p files  b tree  s single  v view
  d source  m reviewed  ? help  q/Esc close
`
