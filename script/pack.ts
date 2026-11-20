#!/usr/bin/env bun
// Packs compiled binaries from dist/ into npm packages under dist/pack and
// tarballs under dist/npm: one package per platform plus a wrapper whose
// optionalDependencies select the right binary at install time.
import { $ } from "bun"
import { mkdir, rm } from "node:fs/promises"
import path from "node:path"
import pkg from "../package.json"

const dir = path.resolve(import.meta.dir, "..")
const dist = path.join(dir, "dist")
const packRoot = path.join(dist, "pack")
const npmRoot = path.join(dist, "npm")

const TARGETS = [
  { name: "darwin-arm64", os: "darwin", cpu: "arm64" },
  { name: "darwin-x64", os: "darwin", cpu: "x64" },
  { name: "linux-arm64", os: "linux", cpu: "arm64", libc: "glibc" },
  { name: "linux-x64", os: "linux", cpu: "x64", libc: "glibc" },
  { name: "linux-arm64-musl", os: "linux", cpu: "arm64", libc: "musl" },
  { name: "linux-x64-musl", os: "linux", cpu: "x64", libc: "musl" },
  { name: "windows-arm64", os: "win32", cpu: "arm64" },
  { name: "windows-x64", os: "win32", cpu: "x64" },
] as const

const host = `${process.platform === "win32" ? "windows" : process.platform}-${process.arch}`
const available: { name: string; os: string; cpu: string; libc?: string; binary: string }[] = []
for (const target of TARGETS) {
  const executable = target.os === "win32" ? "diffview.exe" : "diffview"
  // The host build lands directly in dist/; cross builds land in dist/<target>/.
  const candidate = target.name === host
    ? path.join(dist, executable)
    : path.join(dist, target.name, executable)
  if (!(await Bun.file(candidate).exists())) continue
  available.push({ ...target, binary: candidate })
}
if (available.length === 0) throw new Error("No compiled binaries found. Run: bun run build -- --compile")

await rm(packRoot, { recursive: true, force: true })
await mkdir(npmRoot, { recursive: true })

const optionalDependencies: Record<string, string> = {}
for (const target of available) {
  const name = `${pkg.name}-${target.name}`
  const packageDir = path.join(packRoot, name)
  const executable = path.basename(target.binary)
  await mkdir(path.join(packageDir, "bin"), { recursive: true })
  await Bun.write(path.join(packageDir, "bin", executable), Bun.file(target.binary))
  if (target.os !== "win32") await $`chmod 755 ${path.join(packageDir, "bin", executable)}`.quiet()
  await Bun.write(
    path.join(packageDir, "package.json"),
    JSON.stringify(
      {
        name,
        version: pkg.version,
        license: pkg.license,
        os: [target.os],
        cpu: [target.cpu],
        ...(target.libc ? { libc: [target.libc] } : {}),
        files: ["bin"],
      },
      null,
      2,
    ) + "\n",
  )
  optionalDependencies[name] = pkg.version
}

const wrapperDir = path.join(packRoot, pkg.name)
await mkdir(path.join(wrapperDir, "bin"), { recursive: true })
await Bun.write(path.join(wrapperDir, "bin", "diffview.cjs"), launcher())
await Bun.write(path.join(wrapperDir, "LICENSE"), Bun.file(path.join(dir, "LICENSE")))
await Bun.write(path.join(wrapperDir, "NOTICE"), Bun.file(path.join(dir, "NOTICE")))
await Bun.write(
  path.join(wrapperDir, "package.json"),
  JSON.stringify(
    {
      name: pkg.name,
      version: pkg.version,
      description: pkg.description,
      license: pkg.license,
      bin: { diffview: "./bin/diffview.cjs" },
      files: ["bin", "LICENSE", "NOTICE"],
      os: ["darwin", "linux", "win32"],
      cpu: ["arm64", "x64"],
      optionalDependencies,
    },
    null,
    2,
  ) + "\n",
)

for (const entry of [...Object.keys(optionalDependencies), pkg.name]) {
  await $`bun pm pack --destination ${npmRoot}`.cwd(path.join(packRoot, entry)).quiet()
}
console.log(`Packed ${available.length} platform package(s) and the ${pkg.name} wrapper into dist/npm`)

// Node launcher: resolve the platform package installed via optionalDependencies
// and exec its binary with inherited stdio so the TUI owns the terminal.
function launcher() {
  return `#!/usr/bin/env node
const { spawnSync } = require("node:child_process")
const path = require("node:path")

const platform = process.platform === "win32" ? "windows" : process.platform
const base = \`${pkg.name}-\${platform}-\${process.arch}\`
const candidates = process.platform === "linux" && isMusl() ? [\`\${base}-musl\`, base] : [base]
const executable = process.platform === "win32" ? "diffview.exe" : "diffview"

for (const name of candidates) {
  let binary
  try {
    binary = path.join(path.dirname(require.resolve(\`\${name}/package.json\`)), "bin", executable)
  } catch {
    continue
  }
  const result = spawnSync(binary, process.argv.slice(2), { stdio: "inherit" })
  if (result.error) {
    console.error(\`diffview: \${result.error.message}\`)
    process.exit(1)
  }
  process.exit(result.status ?? 1)
}
console.error(
  \`diffview: no binary for \${platform}-\${process.arch}. Reinstall with optional dependencies enabled.\`,
)
process.exit(1)

function isMusl() {
  try {
    return !process.report.getReport().header.glibcVersionRuntime
  } catch {
    return false
  }
}
`
}
