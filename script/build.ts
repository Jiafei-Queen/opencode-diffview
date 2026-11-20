import { createSolidTransformPlugin } from "@opentui/solid/bun-plugin"
import path from "node:path"

const TARGETS = new Set([
  "darwin-arm64", "darwin-x64",
  "linux-arm64", "linux-x64", "linux-arm64-musl", "linux-x64-musl",
  "windows-arm64", "windows-x64",
])
const args = Bun.argv.slice(2)
const compile = args.includes("--compile")
const targetIndex = args.indexOf("--target")
const inlineTarget = args.find((arg) => arg.startsWith("--target="))?.slice("--target=".length)
const requestedTarget = inlineTarget ?? (targetIndex === -1 ? undefined : args[targetIndex + 1])
if (targetIndex !== -1 && !requestedTarget) throw new Error("--target requires a value.")
if (requestedTarget && !TARGETS.has(requestedTarget)) {
  throw new Error(`Unsupported target: ${requestedTarget}. Choose one of ${[...TARGETS].join(", ")}.`)
}
if (requestedTarget && !compile) throw new Error("--target requires --compile.")

const outdir = path.resolve(import.meta.dir, "../dist")
const target = requestedTarget ?? `${process.platform}-${process.arch}`
const windows = requestedTarget?.startsWith("windows") ?? process.platform === "win32"
const executable = windows ? "ocdiff.exe" : "ocdiff"
const output = requestedTarget ? path.join(outdir, requestedTarget) : outdir
const result = await Bun.build({
  entrypoints: [path.resolve(import.meta.dir, "../src/index.ts")],
  plugins: [createSolidTransformPlugin()],
  format: "esm",
  target: "bun",
  minify: true,
  sourcemap: compile ? "none" : "external",
  ...(compile ? {
    compile: {
      autoloadBunfig: false,
      autoloadDotenv: false,
      autoloadTsconfig: false,
      autoloadPackageJson: false,
      target: `bun-${target.replace(/^windows/, "win32")}` as Bun.Build.CompileTarget,
      outfile: path.join(output, executable),
      execArgv: ["--smol", "--no-warnings", "--"],
    },
  } : { outdir }),
})
if (!result.success) {
  for (const log of result.logs) console.error(log)
  process.exit(1)
}
console.log(compile ? `Built ${path.join(output, executable)}` : "Built dist/index.js")
