import { randomUUID } from "node:crypto"
import { mkdir, readFile, readdir, rename, rm, stat, writeFile } from "node:fs/promises"
import path from "node:path"
import type {
  DiffFile,
  DiffMode,
  DiffProvider,
  SnapshotPort,
  SnapshotSummary,
} from "../model"
import { snapshotsDirectory } from "../config/paths"

const VERSION = 1
const MAX_NAME_LENGTH = 80
const ID_PATTERN = /^[a-z0-9-]+$/

type StoredFile = {
  readonly file: string
  readonly additions: number
  readonly deletions: number
  readonly status: DiffFile["status"]
}

type StoredMeta = {
  readonly version: number
  readonly id: string
  readonly name: string
  readonly createdAt: string
  readonly updatedAt: string
  readonly cwd: string
  readonly source: string
  readonly base?: string
  readonly detail?: string
  readonly reviewed: readonly string[]
  readonly files: readonly StoredFile[]
}

type StoredDiff = { readonly version: number; readonly files: readonly DiffFile[] }

export function createSnapshotStore(directory = snapshotsDirectory()): SnapshotPort {
  async function readMeta(id: string): Promise<StoredMeta | undefined> {
    if (!ID_PATTERN.test(id)) return
    try {
      const value: unknown = JSON.parse(await readFile(path.join(directory, id, "meta.json"), "utf8"))
      return isMeta(value, id) ? value : undefined
    } catch {
      return
    }
  }

  async function directorySize(id: string) {
    const sizes = await Promise.all(["meta.json", "diff.json"].map((file) =>
      stat(path.join(directory, id, file)).then((value) => value.size).catch(() => 0)))
    return sizes.reduce((total, size) => total + size, 0)
  }

  async function allMeta(): Promise<StoredMeta[]> {
    let entries
    try {
      entries = await readdir(directory, { withFileTypes: true })
    } catch {
      return []
    }
    const metas = await Promise.all(entries
      .filter((entry) => entry.isDirectory() && ID_PATTERN.test(entry.name))
      .map((entry) => readMeta(entry.name)))
    return metas
      .filter((meta): meta is StoredMeta => meta !== undefined)
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
  }

  async function summarize(meta: StoredMeta) {
    return summary(meta, await directorySize(meta.id))
  }

  async function writeMeta(meta: StoredMeta) {
    await writeJson(path.join(directory, meta.id, "meta.json"), meta)
  }

  async function resolve(idOrName: string): Promise<StoredMeta | undefined> {
    const metas = await allMeta()
    const exact = metas.find((meta) => meta.id === idOrName)
      ?? metas.find((meta) => meta.name === idOrName)
    if (exact) return exact
    const query = idOrName.toLocaleLowerCase()
    const named = metas.filter((meta) => meta.name.toLocaleLowerCase() === query)
    if (named.length === 1) return named[0]
    const prefixed = metas.filter((meta) => meta.id.startsWith(query))
    return prefixed.length === 1 ? prefixed[0] : undefined
  }

  return {
    list: async () => Promise.all((await allMeta()).map(summarize)),

    async save(draft) {
      const name = normalizeName(draft.name)
      const metas = await allMeta()
      const duplicate = metas.find((meta) => meta.id !== draft.id
        && meta.name.toLocaleLowerCase() === name.toLocaleLowerCase())
      if (duplicate) throw new Error(`A saved review named "${duplicate.name}" already exists.`)

      const previous = draft.id ? metas.find((meta) => meta.id === draft.id) : undefined
      if (draft.id && !previous) throw new Error("The saved review no longer exists.")

      const id = previous?.id ?? newId()
      const now = new Date().toISOString()
      const files = draft.files.map((file) => ({
        file: file.file,
        additions: file.additions,
        deletions: file.deletions,
        status: file.status,
      }))
      const names = new Set(files.map((file) => file.file))
      const meta: StoredMeta = {
        version: VERSION,
        id,
        name,
        createdAt: previous?.createdAt ?? now,
        updatedAt: now,
        cwd: draft.cwd,
        source: draft.source,
        ...(draft.base === undefined ? {} : { base: draft.base }),
        ...(draft.detail === undefined ? {} : { detail: draft.detail }),
        reviewed: [...new Set(draft.reviewed)].filter((file) => names.has(file)),
        files,
      }
      const diff: StoredDiff = { version: VERSION, files: draft.files }
      await mkdir(path.join(directory, id), { recursive: true, mode: 0o700 })
      await writeJson(path.join(directory, id, "diff.json"), diff)
      await writeMeta(meta)
      return summarize(meta)
    },

    async updateProgress(id, reviewed) {
      const meta = await readMeta(id)
      if (!meta) throw new Error("The saved review no longer exists.")
      const names = new Set(meta.files.map((file) => file.file))
      await writeMeta({
        ...meta,
        updatedAt: new Date().toISOString(),
        reviewed: [...new Set(reviewed)].filter((file) => names.has(file)),
      })
    },

    async remove(idOrName) {
      const meta = await resolve(idOrName)
      if (!meta) throw new Error(`No saved review matches "${idOrName}".`)
      await rm(path.join(directory, meta.id), { recursive: true, force: true })
    },

    async open(idOrName) {
      const meta = await resolve(idOrName)
      if (!meta) throw new Error(`No saved review matches "${idOrName}".`)
      let diff: StoredDiff
      try {
        const value: unknown = JSON.parse(await readFile(path.join(directory, meta.id, "diff.json"), "utf8"))
        if (!isDiff(value)) throw new Error("invalid")
        diff = value
      } catch {
        throw new Error(`The saved review "${meta.name}" is damaged.`)
      }
      return {
        summary: await summarize(meta),
        provider: createSavedProvider(diff.files, meta.name),
      }
    },
  }
}

export function createSavedProvider(files: readonly DiffFile[], name: string): DiffProvider {
  return {
    modes: ["patch"] as readonly DiffMode[],
    initialMode: "patch",
    label: "Saved",
    diff: async ({ signal }) => {
      signal?.throwIfAborted()
      return { files, detail: name }
    },
  }
}

function newId() {
  return `${Date.now().toString(36)}-${randomUUID().slice(0, 6)}`
}

function normalizeName(input: string) {
  const name = input.trim()
  if (!name) throw new Error("A saved review needs a name.")
  if (name.length > MAX_NAME_LENGTH) {
    throw new Error(`A saved review name can be at most ${MAX_NAME_LENGTH} characters.`)
  }
  if (/[\u0000-\u001f\u007f]/.test(name)) throw new Error("A saved review name cannot contain control characters.")
  return name
}

async function writeJson(file: string, value: unknown) {
  const temporary = `${file}.${randomUUID()}.tmp`
  await writeFile(temporary, `${JSON.stringify(value, undefined, 2)}\n`, { mode: 0o600 })
  try {
    await rename(temporary, file)
  } catch {
    // Windows does not replace an existing target with rename.
    await rm(file, { force: true })
    await rename(temporary, file)
  }
}

function summary(meta: StoredMeta, bytes: number): SnapshotSummary {
  return {
    id: meta.id,
    name: meta.name,
    createdAt: meta.createdAt,
    updatedAt: meta.updatedAt,
    cwd: meta.cwd,
    source: meta.source,
    ...(meta.base === undefined ? {} : { base: meta.base }),
    ...(meta.detail === undefined ? {} : { detail: meta.detail }),
    fileCount: meta.files.length,
    reviewed: meta.reviewed,
    bytes,
  }
}

function isMeta(value: unknown, id: string): value is StoredMeta {
  if (!value || typeof value !== "object") return false
  const meta = value as Record<string, unknown>
  return meta.version === VERSION
    && meta.id === id
    && typeof meta.name === "string"
    && typeof meta.createdAt === "string"
    && typeof meta.updatedAt === "string"
    && typeof meta.cwd === "string"
    && typeof meta.source === "string"
    && (meta.base === undefined || typeof meta.base === "string")
    && (meta.detail === undefined || typeof meta.detail === "string")
    && Array.isArray(meta.reviewed) && meta.reviewed.every((file) => typeof file === "string")
    && Array.isArray(meta.files) && meta.files.every(isStoredFile)
}

function isStoredFile(value: unknown): value is StoredFile {
  if (!value || typeof value !== "object") return false
  const file = value as Record<string, unknown>
  return typeof file.file === "string"
    && typeof file.additions === "number"
    && typeof file.deletions === "number"
    && (file.status === "added" || file.status === "deleted" || file.status === "modified")
}

function isDiff(value: unknown): value is StoredDiff {
  if (!value || typeof value !== "object") return false
  const diff = value as Record<string, unknown>
  return diff.version === VERSION && Array.isArray(diff.files) && diff.files.every(isDiffFile)
}

function isDiffFile(value: unknown): value is DiffFile {
  if (!value || typeof value !== "object") return false
  const file = value as Record<string, unknown>
  return typeof file.file === "string"
    && (file.patch === undefined || typeof file.patch === "string")
    && typeof file.additions === "number"
    && typeof file.deletions === "number"
    && (file.status === "added" || file.status === "deleted" || file.status === "modified")
}
