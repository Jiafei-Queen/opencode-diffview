import { expect, test } from "bun:test"
import { parseArguments } from "../src/cli"

test("parses Git display options", () => {
  expect(parseArguments(["--cwd", "/repo", "--base=main", "--source", "committed", "--view", "unified", "--single", "--no-tree"])).toEqual({
    type: "run", cwd: "/repo", source: "committed", base: "main", theme: "opencode2", mode: "dark",
    preferences: { view: "unified", tree: false, single: true },
  })
})

test("selects a color theme and mode", () => {
  expect(parseArguments(["--theme", "tokyonight", "--mode", "light"])).toMatchObject({
    type: "run", theme: "tokyonight", mode: "light",
  })
  expect(parseArguments(["--list-themes"])).toEqual({ type: "themes" })
  expect(() => parseArguments(["--theme", "missing"])).toThrow("Unknown theme")
  expect(() => parseArguments(["--mode", "dim"])).toThrow("--mode")
})

test("accepts stdin and patch files", () => {
  expect(parseArguments(["-"])).toMatchObject({ type: "run", patch: "-" })
  expect(parseArguments(["--patch", "a.diff"])).toMatchObject({ type: "run", patch: "a.diff" })
})

test("rejects conflicting or unknown arguments", () => {
  expect(() => parseArguments(["--patch", "a.diff", "--base", "main"])).toThrow("--base")
  expect(() => parseArguments(["--source", "turn"])).toThrow("--source")
  expect(() => parseArguments(["--unknown"])).toThrow("Unknown argument")
  expect(() => parseArguments(["--base"])).toThrow("requires a value")
})
