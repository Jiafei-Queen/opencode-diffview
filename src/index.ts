import { openSync } from "node:fs"
import { ReadStream } from "node:tty"
import path from "node:path"
import { createGitProvider } from "./provider/git"
import { createPatchProvider } from "./provider/patch"
import { HELP, parseArguments } from "./cli"
import { createSnapshotStore } from "./store/snapshot"
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
  if (!process.stdout.isTTY) throw new Error("ocdiff requires an interactive terminal on stdout.")

  const cwd = path.resolve(args.cwd)
  const store = createSnapshotStore()
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
  const stdin = process.stdin.isTTY ? process.stdin : await openTerminalInput()
  try {
    await runViewer({
      provider,
      preferences: args.preferences,
      theme: args.theme,
      mode: args.mode,
      snapshots: store,
      workspace: cwd,
      snapshot,
      stdin,
    })
  } finally {
    if (stdin !== process.stdin) stdin.destroy()
  }
}

async function openTerminalInput() {
  const device = process.platform === "win32" ? "CONIN$" : "/dev/tty"
  const fd = openSync(device, "r")
  return new ReadStream(fd)
}

main().catch((error) => {
  console.error(`ocdiff: ${error instanceof Error ? error.message : String(error)}`)
  process.exitCode = 1
})
