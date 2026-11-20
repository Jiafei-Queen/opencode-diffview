import { expect, test } from "bun:test"
import { rgbToHex } from "@opentui/core"
import {
  DEFAULT_THEME,
  hasTheme,
  nextTheme,
  resolveTheme,
  themeLabel,
  themeNames,
} from "../src/ui/themes"

test("resolves every bundled theme in dark and light", () => {
  expect(themeNames()).toHaveLength(34)
  expect(themeNames()[0]).toBe(DEFAULT_THEME)
  for (const name of themeNames()) {
    for (const requested of ["dark", "light"] as const) {
      const { theme } = resolveTheme(name, requested)
      expect(rgbToHex(theme.background.base)).toMatch(/^#[0-9a-f]{6}/)
    }
  }
})

test("falls back when a theme only provides one mode", () => {
  for (const name of ["aura", "ayu", "catppuccin-frappe", "catppuccin-macchiato", "nightowl"]) {
    expect(resolveTheme(name, "light").mode).toBe("dark")
  }
  expect(resolveTheme("opencode2", "light").mode).toBe("light")
  expect(resolveTheme("opencode2", "dark").mode).toBe("dark")
})

test("cycles forward and backward with wrapping", () => {
  const names = themeNames()
  const last = names.at(-1)!
  expect(nextTheme(names[0]!, 1)).toBe(names[1]!)
  expect(nextTheme(names[0]!, -1)).toBe(last)
  expect(nextTheme(last, 1)).toBe(names[0]!)
  expect(nextTheme("missing", 1)).toBe(DEFAULT_THEME)
})

test("caches resolutions and labels themes", () => {
  expect(resolveTheme("tokyonight", "dark")).toBe(resolveTheme("tokyonight", "dark"))
  expect(themeLabel("opencode2")).toBe("OpenCode 2")
  expect(themeLabel("opencode")).toBe("OpenCode")
  expect(themeLabel("catppuccin-frappe")).toBe("Catppuccin Frappe")
  expect(hasTheme("tokyonight")).toBe(true)
  expect(hasTheme("missing")).toBe(false)
})
