import path from "node:path"
import type { DiffFile, DiffMode, DiffProvider, DiffSource } from "../model"
import { addPatch, countPatch, parsePatch } from "./patch"
import { run } from "./process"

const CONTEXT = "12"
const EMPTY_TREE = "4b825dc642cb6eb9a060e54bf8d69288fbee4904"

export function createGitProvider(cwd: string, initialMode: DiffSource, selectedBase?: string): DiffProvider {
  const git = (args: readonly string[], signal?: AbortSignal) => run(["git", ...args], { cwd, signal })

  async function resolveBase(base: string | undefined, signal?: AbortSignal) {
    if (base) return base
    const upstream = await git(["rev-parse", "--abbrev-ref", "--symbolic-full-name", "@{upstream}"], signal)
      .then((value) => value.trim())
      .catch(() => "")
    if (upstream) return upstream
    const origin = await git(["symbolic-ref", "--quiet", "--short", "refs/remotes/origin/HEAD"], signal)
      .then((value) => value.trim())
      .catch(() => "")
    if (origin) return origin
    for (const candidate of ["main", "master", "origin/main", "origin/master"]) {
      const exists = await git(["rev-parse", "--verify", "--quiet", `${candidate}^{commit}`], signal)
        .then(() => true)
        .catch(() => false)
      if (exists) return candidate
    }
    throw new Error("Could not determine a base branch. Use --base <ref> or --source working.")
  }

  async function head(signal?: AbortSignal) {
    return git(["rev-parse", "--verify", "HEAD"], signal).then((value) => value.trim()).catch(() => EMPTY_TREE)
  }

  async function diff(source: DiffMode, base: string | undefined, signal?: AbortSignal) {
    if (source === "patch") throw new Error("A patch is not a Git diff source.")
    const baseRef = source === "working" ? undefined : await resolveBase(base, signal)
    const comparison = source === "working"
      ? await head(signal)
      : (await git(["merge-base", baseRef!, "HEAD"], signal)).trim()
    const target = source === "committed" ? ["HEAD"] : []
    const args = [
      "diff",
      "--no-color",
      "--no-ext-diff",
      "--find-renames",
      `--unified=${CONTEXT}`,
      comparison,
      ...target,
      "--",
    ]
    const patch = await git(args, signal)
    const files = parsePatch(patch)
    if (source !== "committed") files.push(...await untracked(cwd, git, signal))
    return {
      files: files.sort((left, right) => left.file.localeCompare(right.file)),
      detail: source === "working" ? "vs HEAD" : `vs ${baseRef}`,
      base: baseRef,
    }
  }

  return {
    modes: ["branch", "committed", "working"],
    initialMode,
    diff: ({ source, base, signal }) => diff(source, base ?? selectedBase, signal),
    defaultBase: (signal) => resolveBase(selectedBase, signal),
    branches: async (search, signal) => {
      const output = await git([
        "for-each-ref",
        "--format=%(refname:short)",
        "refs/heads",
        "refs/remotes",
      ], signal)
      const query = search.toLocaleLowerCase()
      return [...new Set(output.split("\n").map((item) => item.trim()).filter((item) =>
        item && item !== "origin/HEAD" && item.toLocaleLowerCase().includes(query),
      ))].sort().slice(0, 100)
    },
    loadImage: async (file, signal) => {
      signal.throwIfAborted()
      const bytes = await Bun.file(path.resolve(cwd, file)).bytes()
      signal.throwIfAborted()
      return bytes
    },
  }
}

async function untracked(
  cwd: string,
  git: (args: readonly string[], signal?: AbortSignal) => Promise<string>,
  signal?: AbortSignal,
) {
  const output = await git(["ls-files", "--others", "--exclude-standard", "-z"], signal)
  const files = output.split("\0").filter(Boolean)
  return Promise.all(files.map(async (file): Promise<DiffFile> => {
    signal?.throwIfAborted()
    const bytes = await Bun.file(path.join(cwd, file)).bytes()
    signal?.throwIfAborted()
    if (bytes.includes(0)) {
      return {
        file,
        patch: `diff --git a/${file} b/${file}\nnew file mode 100644\nBinary files /dev/null and b/${file} differ\n`,
        additions: 0,
        deletions: 0,
        status: "added",
      }
    }
    const patch = addPatch(file, new TextDecoder().decode(bytes))
    return { file, patch, ...countPatch(patch), status: "added" }
  }))
}
