import { formatPatch, structuredPatch } from "diff"
import type { DiffFile, DiffProvider } from "../model"

export const PATCH_CONTEXT_LINES = 2_147_483_647

export function addPatch(file: string, content: string) {
  return formatPatch(structuredPatch(file, file, "", content, "", "", { context: 0 }))
}

export function countPatch(patch: string) {
  let additions = 0
  let deletions = 0
  for (const line of patch.split("\n")) {
    if (line.startsWith("+") && !line.startsWith("+++")) additions++
    if (line.startsWith("-") && !line.startsWith("---")) deletions++
  }
  return { additions, deletions }
}

export function parsePatch(input: string): DiffFile[] {
  return splitPatch(input).flatMap((chunk): DiffFile[] => {
    const file = fileFromPatchChunk(chunk)
    if (!file) return []
    const before = /^--- (.+)$/m.exec(chunk)?.[1]
    const after = /^\+\+\+ (.+)$/m.exec(chunk)?.[1]
    return [{
      file,
      patch: chunk,
      ...countPatch(chunk),
      status: before === "/dev/null" || chunk.includes("\nnew file mode ") || chunk.startsWith("new file mode ")
        ? "added"
        : after === "/dev/null" || chunk.includes("\ndeleted file mode ") || chunk.startsWith("deleted file mode ")
          ? "deleted"
          : "modified",
    }]
  })
}

export function createPatchProvider(patch: string, detail = "stdin"): DiffProvider {
  return {
    modes: ["patch"],
    initialMode: "patch",
    diff: async ({ signal }) => {
      signal?.throwIfAborted()
      const files = parsePatch(patch)
      if (files.length === 0 && patch.trim()) throw new Error("The input does not contain a recognizable unified diff.")
      return { files, detail }
    },
  }
}

export function splitPatch(patch: string) {
  const starts = [...patch.matchAll(/(?:^|\n)diff --git /g)].map((match) =>
    match[0].startsWith("\n") ? match.index + 1 : match.index,
  )
  if (starts.length > 0) return starts.map((start, index) => patch.slice(start, starts[index + 1] ?? patch.length))

  const generic = [...patch.matchAll(/(?:^|\n)--- /g)].flatMap((match) => {
    const start = match[0].startsWith("\n") ? match.index + 1 : match.index
    const end = patch.indexOf("\n", start)
    return patch.slice(end + 1).startsWith("+++ ") ? [start] : []
  })
  return generic.map((start, index) => patch.slice(start, generic[index + 1] ?? patch.length))
}

function parseQuotedPath(value: string) {
  let out = ""
  for (let index = 1; index < value.length; index++) {
    const char = value[index]!
    if (char === '"') return { value: out, end: index + 1 }
    if (char !== "\\") {
      out += char
      continue
    }
    const next = value[++index]
    if (next === "t") out += "\t"
    else if (next === "n") out += "\n"
    else if (next === "r") out += "\r"
    else if (next === '"' || next === "\\") out += next
    else out += next ?? ""
  }
}

function parsePathToken(value: string) {
  if (!value.startsWith('"')) return value.split("\t")[0]!
  return parseQuotedPath(value)?.value ?? value
}

function fileFromDiffPath(value: string | undefined) {
  if (!value || value === "/dev/null") return
  const file = parsePathToken(value)
  if (file.startsWith("a/") || file.startsWith("b/")) return file.slice(2)
  return file
}

function fileFromGitHeader(header: string) {
  if (header.startsWith('"')) {
    const first = parseQuotedPath(header)
    const second = first ? header.slice(first.end).trimStart() : undefined
    if (!second) return
    if (!second.startsWith('"')) return fileFromDiffPath(second)
    return fileFromDiffPath(parseQuotedPath(second)?.value)
  }
  const separator = header.indexOf(" b/")
  if (separator === -1) return
  return fileFromDiffPath(header.slice(separator + 1))
}

export function fileFromPatchChunk(chunk: string) {
  const next = /^\+\+\+ (.+)$/m.exec(chunk)?.[1]
  const before = /^--- (.+)$/m.exec(chunk)?.[1]
  const file = fileFromDiffPath(next) ?? fileFromDiffPath(before)
  if (file) return file
  const header = /^diff --git (.+)$/m.exec(chunk)?.[1]
  return fileFromGitHeader(header ?? "")
}
