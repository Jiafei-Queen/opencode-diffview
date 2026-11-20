import { openSync } from "node:fs"
import { ReadStream } from "node:tty"
import path from "node:path"
import { createGitProvider } from "./provider/git"
import { createPatchProvider } from "./provider/patch"
import { HELP, parseArguments } from "./cli"
import { runViewer } from "./ui/app"
import { themeLabel, themeNames } from "./ui/themes"

async function main() {
  const args = parseArguments(Bun.argv.slice(2))
  if (args.type === "help") {
    console.log(HELP)
    return
  }
  if (args.type === "version") {
    console.log("diffview 0.1.0")
    return
  }
  if (args.type === "themes") {
    for (const name of themeNames()) console.log(`${name}\t${themeLabel(name)}`)
    return
  }
  if (!process.stdout.isTTY) throw new Error("diffview requires an interactive terminal on stdout.")

  const cwd = path.resolve(args.cwd)
  const patch = args.patch === "-" ? await Bun.stdin.text()
    : args.patch ? await Bun.file(path.resolve(cwd, args.patch)).text()
      : undefined
  const provider = patch !== undefined
    ? createPatchProvider(patch, args.patch === "-" ? "stdin" : args.patch!)
    : createGitProvider(cwd, args.source, args.base)
  const stdin = process.stdin.isTTY ? process.stdin : await openTerminalInput()
  try {
    await runViewer({ provider, preferences: args.preferences, theme: args.theme, mode: args.mode, stdin })
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
  console.error(`diffview: ${error instanceof Error ? error.message : String(error)}`)
  process.exitCode = 1
})
