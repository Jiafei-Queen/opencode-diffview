import { afterEach, expect, test } from "bun:test"
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import type { DiffFile } from "../src/model"
import { createSnapshotStore } from "../src/store/snapshot"

const roots: string[] = []

async function store() {
  const root = await mkdtemp(path.join(tmpdir(), "ocdiff-snapshot-"))
  roots.push(root)
  return { root, snapshots: createSnapshotStore(root) }
}

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })))
})

function files(): DiffFile[] {
  return [
    { file: "src/a.ts", patch: "diff --git a/src/a.ts b/src/a.ts\n", additions: 2, deletions: 1, status: "modified" },
    { file: "src/b.ts", patch: "diff --git a/src/b.ts b/src/b.ts\n", additions: 5, deletions: 0, status: "added" },
  ]
}

test("saves, lists, and reopens a review", async () => {
  const { snapshots } = await store()
  const saved = await snapshots.save({
    name: "Payments refactor",
    cwd: "/repo",
    source: "branch",
    base: "main",
    detail: "vs main",
    files: files(),
    reviewed: ["src/a.ts", "src/missing.ts"],
  })
  expect(saved.reviewed).toEqual(["src/a.ts"])
  expect(saved.fileCount).toBe(2)

  const list = await snapshots.list()
  expect(list).toHaveLength(1)
  expect(list[0]!.name).toBe("Payments refactor")
  expect(list[0]!.bytes).toBeGreaterThan(0)

  const opened = await snapshots.open("Payments refactor")
  expect(opened.summary.id).toBe(saved.id)
  expect(opened.provider.label).toBe("Saved")
  const result = await opened.provider.diff({ source: "patch" })
  expect(result.files.map((file) => file.file)).toEqual(["src/a.ts", "src/b.ts"])
  expect(result.detail).toBe("Payments refactor")
})

test("resolves reviews by id and unique id prefix", async () => {
  const { snapshots } = await store()
  const saved = await snapshots.save({
    name: "Review",
    cwd: "/repo",
    source: "working",
    files: files(),
    reviewed: [],
  })
  expect((await snapshots.open(saved.id)).summary.name).toBe("Review")
  expect((await snapshots.open(saved.id.slice(0, 8))).summary.name).toBe("Review")
})

test("rejects duplicate names case-insensitively", async () => {
  const { snapshots } = await store()
  const draft = { name: "Review", cwd: "/repo", source: "branch", files: files(), reviewed: [] }
  await snapshots.save(draft)
  await expect(snapshots.save({ ...draft, name: "  review " })).rejects.toThrow("already exists")
})

test("updates progress and removes a review", async () => {
  const { snapshots } = await store()
  const saved = await snapshots.save({
    name: "Review",
    cwd: "/repo",
    source: "branch",
    files: files(),
    reviewed: [],
  })
  await snapshots.updateProgress(saved.id, ["src/b.ts", "src/missing.ts"])
  expect((await snapshots.open(saved.id)).summary.reviewed).toEqual(["src/b.ts"])

  await snapshots.remove(saved.id)
  expect(await snapshots.list()).toEqual([])
  await expect(snapshots.open(saved.id)).rejects.toThrow("No saved review matches")
})

test("updates an existing review by id", async () => {
  const { snapshots } = await store()
  const saved = await snapshots.save({
    name: "First",
    cwd: "/repo",
    source: "branch",
    files: files(),
    reviewed: ["src/a.ts"],
  })
  const updated = await snapshots.save({
    id: saved.id,
    name: "Second",
    cwd: "/repo",
    source: "branch",
    files: files(),
    reviewed: ["src/a.ts", "src/b.ts"],
  })
  expect(updated.id).toBe(saved.id)
  expect(updated.createdAt).toBe(saved.createdAt)
  expect(updated.name).toBe("Second")
  expect(updated.reviewed).toEqual(["src/a.ts", "src/b.ts"])
  expect(await snapshots.list()).toHaveLength(1)
})

test("ignores damaged metadata and reports a damaged diff", async () => {
  const { root, snapshots } = await store()
  await mkdir(path.join(root, "broken"), { recursive: true })
  await writeFile(path.join(root, "broken", "meta.json"), "{not json")
  expect(await snapshots.list()).toEqual([])

  const saved = await snapshots.save({
    name: "Review",
    cwd: "/repo",
    source: "branch",
    files: files(),
    reviewed: [],
  })
  await writeFile(path.join(root, saved.id, "diff.json"), "null")
  await expect(snapshots.open(saved.id)).rejects.toThrow("damaged")
})

test("validates names", async () => {
  const { snapshots } = await store()
  const draft = { name: " ", cwd: "/repo", source: "branch", files: files(), reviewed: [] }
  await expect(snapshots.save(draft)).rejects.toThrow("needs a name")
  await expect(snapshots.save({ ...draft, name: "x".repeat(81) })).rejects.toThrow("at most 80")
})
