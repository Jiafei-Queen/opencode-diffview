import { afterEach, beforeEach, expect, test } from "bun:test"
import { mkdtemp, rm } from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { createGitProvider } from "../src/provider/git"
import { run } from "../src/provider/process"

let directory: string

beforeEach(async () => {
  directory = await mkdtemp(path.join(os.tmpdir(), "diffview-git-test-"))
  const git = (...args: string[]) => run(["git", ...args], { cwd: directory })
  await git("init", "-b", "main")
  await git("config", "user.email", "diffview@example.com")
  await git("config", "user.name", "Diffview Test")
  await Bun.write(path.join(directory, "tracked.txt"), "base\n")
  await git("add", "tracked.txt")
  await git("commit", "-m", "base")
  await git("checkout", "-b", "feature")
  await Bun.write(path.join(directory, "committed.txt"), "committed\n")
  await git("add", "committed.txt")
  await git("commit", "-m", "feature")
  await Bun.write(path.join(directory, "tracked.txt"), "working\n")
  await Bun.write(path.join(directory, "untracked.txt"), "new\n")
})

afterEach(async () => {
  await rm(directory, { recursive: true, force: true })
})

test("working includes local and untracked changes", async () => {
  const result = await createGitProvider(directory, "working").diff({ source: "working" })
  expect(result.files.map((file) => [file.file, file.status])).toEqual([
    ["tracked.txt", "modified"], ["untracked.txt", "added"],
  ])
  expect(result.detail).toBe("vs HEAD")
})

test("untracked binary files have a placeholder instead of decoded text", async () => {
  await Bun.write(path.join(directory, "image.png"), new Uint8Array([0, 1, 2, 3]))
  const result = await createGitProvider(directory, "working").diff({ source: "working" })
  const image = result.files.find((file) => file.file === "image.png")
  expect(image?.status).toBe("added")
  expect(image?.patch).toContain("Binary files")
  expect(image?.additions).toBe(0)
})

test("committed uses the merge base and excludes working changes", async () => {
  const result = await createGitProvider(directory, "committed", "main").diff({ source: "committed" })
  expect(result.files.map((file) => file.file)).toEqual(["committed.txt"])
  expect(result.base).toBe("main")
})

test("branch combines committed and local changes", async () => {
  const result = await createGitProvider(directory, "branch", "main").diff({ source: "branch" })
  expect(result.files.map((file) => file.file)).toEqual(["committed.txt", "tracked.txt", "untracked.txt"])
  expect(result.base).toBe("main")
})

test("lists local and remote branches with filtering", async () => {
  const branches = await createGitProvider(directory, "working").branches?.("feat")
  expect(branches).toEqual(["feature"])
})
