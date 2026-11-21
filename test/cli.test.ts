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

test("parses scroll speed options", () => {
  expect(parseArguments(["--scroll-lines", "3", "--scroll-wheel", "1.5"])).toMatchObject({
    type: "run", preferences: { scrollLines: 3, scrollWheel: 1.5 },
  })
  expect(parseArguments([])).toMatchObject({ type: "run", preferences: { view: "auto", tree: true, single: false } })
  expect(() => parseArguments(["--scroll-lines", "0"])).toThrow("--scroll-lines")
  expect(() => parseArguments(["--scroll-lines", "2.5"])).toThrow("--scroll-lines")
  expect(() => parseArguments(["--scroll-wheel", "6"])).toThrow("--scroll-wheel")
  expect(() => parseArguments(["--scroll-wheel", "fast"])).toThrow("--scroll-wheel")
})

test("accepts stdin and patch files", () => {
  expect(parseArguments(["-"])).toMatchObject({ type: "run", patch: "-" })
  expect(parseArguments(["--patch", "a.diff"])).toMatchObject({ type: "run", patch: "a.diff" })
})

test("opens and lists saved reviews", () => {
  expect(parseArguments(["--list-saved"])).toEqual({ type: "saved" })
  expect(parseArguments(["--open", "my review"])).toMatchObject({ type: "run", open: "my review" })
  expect(parseArguments(["--open=my review", "--theme", "aura"])).toMatchObject({ type: "run", open: "my review", theme: "aura" })
  expect(() => parseArguments(["--open", "review", "--source", "working"])).toThrow("--open")
  expect(() => parseArguments(["--open", "review", "--base", "main"])).toThrow("--open")
  expect(() => parseArguments(["--open", "review", "--patch", "a.diff"])).toThrow("--open")
  expect(() => parseArguments(["--open", "review", "--list-saved"])).toThrow("--list-saved")
})

test("rejects conflicting or unknown arguments", () => {
  expect(() => parseArguments(["--patch", "a.diff", "--base", "main"])).toThrow("--base")
  expect(() => parseArguments(["--source", "turn"])).toThrow("--source")
  expect(() => parseArguments(["--unknown"])).toThrow("Unknown argument")
  expect(() => parseArguments(["--base"])).toThrow("requires a value")
})
