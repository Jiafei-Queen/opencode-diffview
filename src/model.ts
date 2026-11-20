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
  diff(request: DiffRequest): Promise<DiffResult>
  defaultBase?(signal?: AbortSignal): Promise<string>
  branches?(search: string, signal?: AbortSignal): Promise<readonly string[]>
  loadImage?(file: string, signal: AbortSignal): Promise<Uint8Array>
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
