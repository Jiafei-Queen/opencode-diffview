import { expect, test } from "bun:test"
import {
  buildFileTree,
  flattenFileTree,
  movePatchFileIndex,
  toggleFileTreeDirectory,
} from "../src/ui/file-tree"

const files = [{ file: "src/ui/view.ts" }, { file: "src/ui/theme.ts" }, { file: "README.md" }]

test("builds sorted trees and collapses unary directory chains", () => {
  const tree = buildFileTree(files)
  const rows = flattenFileTree(tree, new Set(tree.nodes.map((node) => node.id)))
  expect(rows.map((row) => row.name)).toEqual(["src/ui", "theme.ts", "view.ts", "README.md"])
  expect(rows[1]?.fileIndex).toBe(1)
})

test("collapses directories and clamps file navigation", () => {
  const tree = buildFileTree(files)
  const root = tree.roots[0]
  expect(toggleFileTreeDirectory(tree, new Set([root!]), root)).toEqual(new Set())
  expect(movePatchFileIndex([0, 1, 2], 0, -1)).toBe(0)
  expect(movePatchFileIndex([0, 1, 2], 1, 1)).toBe(2)
  expect(movePatchFileIndex([0, 1, 2], 2, 1)).toBe(2)
})
