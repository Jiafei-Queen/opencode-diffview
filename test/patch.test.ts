import { describe, expect, test } from "bun:test"
import { countPatch, fileFromPatchChunk, parsePatch } from "../src/provider/patch"
import { splitAddedPatch, splitPatchHunks } from "../src/util/diff"
import { ADDED_PATCH, MODIFIED_PATCH } from "./fixtures"

describe("patch provider", () => {
  test("normalizes modified and added files", () => {
    expect(parsePatch(MODIFIED_PATCH + ADDED_PATCH)).toEqual([
      { file: "src/hello.ts", patch: MODIFIED_PATCH, additions: 2, deletions: 1, status: "modified" },
      { file: "new.txt", patch: ADDED_PATCH, additions: 2, deletions: 0, status: "added" },
    ])
  })

  test("parses a generic unified patch", () => {
    const patch = MODIFIED_PATCH.slice(MODIFIED_PATCH.indexOf("--- "))
    expect(parsePatch(patch)[0]?.file).toBe("src/hello.ts")
  })

  test("recognizes generic additions and deletions through dev null", () => {
    const added = ADDED_PATCH.slice(ADDED_PATCH.indexOf("--- "))
    const deleted = added.replace("--- /dev/null", "--- a/new.txt").replace("+++ b/new.txt", "+++ /dev/null")
    expect(parsePatch(added)[0]?.status).toBe("added")
    expect(parsePatch(deleted)[0]?.status).toBe("deleted")
  })

  test("handles quoted paths and does not count file headers", () => {
    const patch = MODIFIED_PATCH.replaceAll("src/hello.ts", "src/hello world.ts")
    expect(fileFromPatchChunk(patch)).toBe("src/hello world.ts")
    expect(countPatch(patch)).toEqual({ additions: 2, deletions: 1 })
  })

  test("splits multiple hunks with a shared file prefix", () => {
    const patch = MODIFIED_PATCH + "@@ -10 +10,2 @@\n-old\n+new\n+last\n"
    const hunks = splitPatchHunks(patch)
    expect(hunks).toHaveLength(2)
    expect(hunks[1]?.patch).toContain("diff --git")
    expect(hunks[1]?.header).toBe("@@ -10 +10,2 @@")
  })

  test("splits full-file additions into valid patches", () => {
    const patch = `diff --git a/a.txt b/a.txt\n--- /dev/null\n+++ b/a.txt\n@@ -0,0 +1,3 @@\n+a\n+b\n+c`
    expect(splitAddedPatch(patch, 2)?.map((chunk) => chunk.patch)).toEqual([
      "diff --git a/a.txt b/a.txt\n--- /dev/null\n+++ b/a.txt\n@@ -0,0 +1,2 @@\n+a\n+b",
      "diff --git a/a.txt b/a.txt\n--- /dev/null\n+++ b/a.txt\n@@ -0,0 +3,1 @@\n+c",
    ])
  })
})
