import { openSync } from "node:fs"
import { ReadStream } from "node:tty"
import path from "node:path"
import { createGitProvider } from "./provider/git"
import { createPatchProvider } from "./provider/patch"
import { HELP, parseArguments } from "./cli"
import { applyOverrides, loadSettings, mergeSettings, saveSettings, type SettingsChange } from "./config/settings"
import type { ViewerPreferences } from "./ui/viewer"
import { createSnapshotStore, readOnlySnapshotPort } from "./store/snapshot"
import { runViewer } from "./ui/app"
import { themeLabel, themeNames } from "./ui/themes"
import { formatBytes, formatTimestamp } from "./util/format"

async function main() {
  const args = parseArguments(Bun.argv.slice(2))
  if (args.type === "help") {
    console.log(HELP)
    return
  }
  if (args.type === "version") {
    console.log("ocdiff 0.1.0")
    return
  }
  if (args.type === "themes") {
    for (const name of themeNames()) console.log(`${name}\t${themeLabel(name)}`)
    return
  }
  if (args.type === "saved") {
    const reviews = await createSnapshotStore().list()
    if (reviews.length === 0) console.log("No saved reviews.")
    for (const review of reviews) {
      console.log([
        review.name,
        formatTimestamp(review.updatedAt),
        review.source,
        `${review.reviewed.length}/${review.fileCount}`,
        formatBytes(review.bytes),
      ].join("\t"))
    }
    return
  }
  if (args.type !== "run") return
  if (!process.stdout.isTTY) throw new Error("ocdiff requires an interactive terminal on stdout.")

  const stored = await loadSettings()
  const settings = applyOverrides(stored, args.overrides)
  const cwd = path.resolve(args.cwd)
  const store = createSnapshotStore()
  const snapshots = args.noSave ? readOnlySnapshotPort(store) : store
  const opened = args.open === undefined ? undefined : await store.open(args.open)
  let patch: string | undefined
  if (opened === undefined && args.patch !== undefined) {
    patch = args.patch === "-" ? await Bun.stdin.text()
      : await Bun.file(path.resolve(cwd, args.patch)).text()
  }
  const provider = opened?.provider ?? (patch !== undefined
    ? createPatchProvider(patch, args.patch === "-" ? "stdin" : args.patch!)
    : createGitProvider(cwd, args.source, args.base))
  const snapshot = opened === undefined ? undefined : {
    id: opened.summary.id,
    name: opened.summary.name,
    reviewed: opened.summary.reviewed,
    cwd: opened.summary.cwd,
    source: opened.summary.source,
    base: opened.summary.base,
    detail: opened.summary.detail,
    opened: true,
  }
  const preferences: ViewerPreferences = {
    view: settings.view,
    tree: settings.tree,
    single: settings.single,
    scrollLines: settings.scroll.lines,
    scrollWheel: settings.scroll.wheel,
  }

  let fileSettings = stored
  let writes: Promise<unknown> = Promise.resolve()
  const noSave = args.noSave
  function persist(change: SettingsChange) {
    if (noSave) return
    fileSettings = mergeSettings(fileSettings, change)
    const next = fileSettings
    writes = writes.then(() => saveSettings(next)).catch(() => {})
  }

  const stdin = process.stdin.isTTY ? process.stdin : await openTerminalInput()
  try {
    await runViewer({
      provider,
      preferences,
      theme: settings.theme,
      mode: settings.mode,
      snapshots,
      workspace: cwd,
      snapshot,
      onThemeChange: (name) => persist({ theme: name }),
      onPreferencesChange: (value) => {
        const scroll = {
          ...(value.scrollLines === undefined ? {} : { lines: value.scrollLines }),
          ...(value.scrollWheel === undefined ? {} : { wheel: value.scrollWheel }),
        }
        persist({
          ...(value.tree === undefined ? {} : { tree: value.tree }),
          ...(value.single === undefined ? {} : { single: value.single }),
          ...(value.view === undefined ? {} : { view: value.view }),
          ...(Object.keys(scroll).length === 0 ? {} : { scroll }),
        })
      },
      stdin,
    })
  } finally {
    if (stdin !== process.stdin) stdin.destroy()
    await writes
  }
}

async function openTerminalInput() {
  const device = process.platform === "win32" ? "CONIN$" : "/dev/tty"
  const fd = openSync(device, "r")
  return new ReadStream(fd)
}

main().catch((error) => {
  console.error(`ocdiff: ${error instanceof Error ? error.message : String(error)}`)
  if (process.env.OCDIFF_DEBUG) console.error(error)
  process.exitCode = 1
})
