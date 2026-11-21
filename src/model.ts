export type DiffSource = "branch" | "committed" | "working"
export type DiffMode = DiffSource | "patch"

export type DiffFile = {
  readonly file: string
  readonly patch?: string
  readonly additions: number
  readonly deletions: number
  readonly status: "added" | "deleted" | "modified"
}

export type DiffResult = {
  readonly files: readonly DiffFile[]
  readonly detail?: string
  readonly base?: string
}

export type DiffRequest = {
  readonly source: DiffMode
  readonly base?: string
  readonly signal?: AbortSignal
}

export interface DiffProvider {
  readonly modes: readonly DiffMode[]
  readonly initialMode: DiffMode
  readonly label?: string
  diff(request: DiffRequest): Promise<DiffResult>
  defaultBase?(signal?: AbortSignal): Promise<string>
  branches?(search: string, signal?: AbortSignal): Promise<readonly string[]>
  loadImage?(file: string, signal: AbortSignal): Promise<Uint8Array>
}

export type SnapshotDraft = {
  readonly name: string
  readonly id?: string
  readonly cwd: string
  readonly source: string
  readonly base?: string
  readonly detail?: string
  readonly files: readonly DiffFile[]
  readonly reviewed: readonly string[]
}

export type SnapshotSummary = {
  readonly id: string
  readonly name: string
  readonly createdAt: string
  readonly updatedAt: string
  readonly cwd: string
  readonly source: string
  readonly base?: string
  readonly detail?: string
  readonly fileCount: number
  readonly reviewed: readonly string[]
  readonly bytes: number
}

/** UI-facing boundary for saved reviews; the viewer does not touch the filesystem. */
export type SnapshotPort = {
  readonly writable?: boolean
  list(): Promise<readonly SnapshotSummary[]>
  save(draft: SnapshotDraft): Promise<SnapshotSummary>
  updateProgress(id: string, reviewed: readonly string[]): Promise<void>
  remove(id: string): Promise<void>
  open(id: string): Promise<{ summary: SnapshotSummary; provider: DiffProvider }>
}

export const SOURCE_LABELS: Record<DiffMode, { label: string; description: string }> = {
  branch: { label: "All", description: "Branch + local changes" },
  committed: { label: "Committed", description: "Branch commits only" },
  working: { label: "Uncommitted", description: "Local changes only" },
  patch: { label: "Patch", description: "Unified diff input" },
}

export function needsBase(mode: DiffMode) {
  return mode === "branch" || mode === "committed"
}
