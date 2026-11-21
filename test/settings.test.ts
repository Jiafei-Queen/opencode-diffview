import { afterEach, expect, test } from "bun:test"
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import {
  DEFAULT_SETTINGS,
  applyOverrides,
  loadSettings,
  mergeSettings,
  parseSettings,
  saveSettings,
} from "../src/config/settings"
import { settingsFile } from "../src/config/paths"

const roots: string[] = []

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })))
})

async function temporaryFile() {
  const root = await mkdtemp(path.join(tmpdir(), "ocdiff-settings-"))
  roots.push(root)
  return path.join(root, "nested", "config.json")
}

test("falls back to defaults for missing or invalid values", () => {
  expect(parseSettings(undefined)).toEqual(DEFAULT_SETTINGS)
  expect(parseSettings("nope")).toEqual(DEFAULT_SETTINGS)
  expect(parseSettings({
    theme: "missing",
    mode: "dim",
    view: "sideways",
    tree: "yes",
    single: 1,
    scroll: { lines: Number.NaN, wheel: 100 },
  })).toEqual({
    ...DEFAULT_SETTINGS,
    scroll: { lines: DEFAULT_SETTINGS.scroll.lines, wheel: 5 },
  })
})

test("keeps valid fields and clamps scroll speed", () => {
  expect(parseSettings({
    version: 99,
    theme: "tokyonight",
    mode: "light",
    view: "unified",
    tree: false,
    single: true,
    scroll: { lines: 50, wheel: 0.1 },
  })).toEqual({
    version: 1,
    theme: "tokyonight",
    mode: "light",
    view: "unified",
    tree: false,
    single: true,
    scroll: { lines: 20, wheel: 0.25 },
  })
})

test("applies only explicit CLI overrides", () => {
  const settings = applyOverrides(DEFAULT_SETTINGS, { theme: "aura", scrollWheel: 2 })
  expect(settings.theme).toBe("aura")
  expect(settings.scroll).toEqual({ lines: 1, wheel: 2 })
  expect(settings.tree).toBe(DEFAULT_SETTINGS.tree)
  expect(applyOverrides(DEFAULT_SETTINGS, {})).toEqual(DEFAULT_SETTINGS)
})

test("merges interactive changes without dropping other fields", () => {
  const settings = mergeSettings(DEFAULT_SETTINGS, { tree: false, scroll: { wheel: 3 } })
  expect(settings.tree).toBe(false)
  expect(settings.scroll).toEqual({ lines: 1, wheel: 3 })
  expect(settings.view).toBe("auto")
})

test("round-trips settings through disk", async () => {
  const file = await temporaryFile()
  expect(await loadSettings(file)).toEqual(DEFAULT_SETTINGS)
  const settings = { ...DEFAULT_SETTINGS, theme: "nord", tree: false }
  expect(await saveSettings(settings, file)).toBe(true)
  expect(await loadSettings(file)).toEqual(settings)
})

test("resolves the config path from XDG and the app override", () => {
  expect(settingsFile({ XDG_CONFIG_HOME: "/xdg" }, "/home/user"))
    .toBe(path.join("/xdg", "ocdiff", "config.json"))
  expect(settingsFile({}, "/home/user"))
    .toBe(path.join("/home/user", ".config", "ocdiff", "config.json"))
  expect(settingsFile({ OCDIFF_CONFIG_HOME: "/custom" }, "/home/user"))
    .toBe(path.join("/custom", "config.json"))
})
