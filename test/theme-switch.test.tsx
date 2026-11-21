/** @jsxImportSource @opentui/solid */
import { expect, test } from "bun:test"
import { rgbToHex, type CapturedFrame } from "@opentui/core"
import { testRender } from "@opentui/solid"
import { createEffect, createSignal } from "solid-js"
import type { DiffProvider } from "../src/model"
import { addPatch, parsePatch } from "../src/provider/patch"
import { ThemeProvider, useSyntax, useTheme, useThemeControls } from "../src/ui/theme"
import { nextTheme, resolveTheme, themeLabel } from "../src/ui/themes"
import { DiffViewer } from "../src/ui/viewer"

function Probe() {
  const theme = useTheme()
  const syntax = useSyntax()
  const controls = useThemeControls()
  const [generations, setGenerations] = createSignal(0)
  let current: unknown
  createEffect(() => {
    const style = syntax()
    if (style === current) return
    current = style
    setGenerations((count) => count + 1)
  })
  return (
    <text id="theme-probe">
      {`${controls.name()}|${rgbToHex(theme.background.base)}|${generations()}`}
    </text>
  )
}

function branchProvider(): DiffProvider {
  return {
    modes: ["branch", "working"],
    initialMode: "branch",
    diff: async ({ source }) => ({
      files: parsePatch(addPatch(`${source}.txt`, "value\n")),
      detail: source,
    }),
    branches: async () => ["main"],
  }
}

test("t cycles themes and refreshes colors, syntax, and the footer", async () => {
  const app = await testRender(() => (
    <ThemeProvider mode="dark">
      <Probe />
      <DiffViewer provider={branchProvider()} onClose={() => {}} />
    </ThemeProvider>
  ), { width: 120, height: 30, kittyKeyboard: true })
  try {
    await settle(app)
    const first = probeValue(app.captureCharFrame())
    expect(first.name).toBe("opencode2")
    expect(first.hex).toBe(hex("opencode2", "dark"))
    expect(app.captureCharFrame()).toContain("OpenCode 2")
    const firstSpan = spanColors(app.captureSpans(), "branch.txt")

    app.mockInput.pressKey("t")
    await settle(app)
    const second = probeValue(app.captureCharFrame())
    const next = nextTheme("opencode2", 1)
    expect(second.name).toBe(next)
    expect(second.hex).toBe(hex(next, "dark"))
    expect(second.generations).toBeGreaterThan(first.generations)
    expect(app.captureCharFrame()).toContain(themeLabel(next))
    expect(spanColors(app.captureSpans(), "branch.txt")).not.toEqual(firstSpan)

    app.mockInput.pressKey("t", { shift: true })
    await settle(app)
    expect(probeValue(app.captureCharFrame()).name).toBe("opencode2")
  } finally {
    app.renderer.destroy()
  }
})

test("starts from the requested theme and reports a mode fallback", async () => {
  const app = await testRender(() => (
    <ThemeProvider mode="light" theme="aura">
      <Probe />
      <DiffViewer provider={branchProvider()} onClose={() => {}} />
    </ThemeProvider>
  ), { width: 120, height: 30, kittyKeyboard: true })
  try {
    await settle(app)
    expect(probeValue(app.captureCharFrame()).name).toBe("aura")
    expect(app.captureCharFrame()).toContain("Aura (dark)")
  } finally {
    app.renderer.destroy()
  }
})

test("theme changes keep reviewed state", async () => {
  const app = await testRender(() => (
    <ThemeProvider mode="dark">
      <DiffViewer provider={branchProvider()} onClose={() => {}} />
    </ThemeProvider>
  ), { width: 120, height: 30, kittyKeyboard: true })
  try {
    await settle(app)
    app.mockInput.pressKey("m")
    await settle(app)
    expect(app.captureCharFrame()).toContain("1/1")
    app.mockInput.pressKey("t")
    await settle(app)
    expect(app.captureCharFrame()).toContain("1/1")
  } finally {
    app.renderer.destroy()
  }
})

test("typing t in the base search does not switch themes", async () => {
  const app = await testRender(() => (
    <ThemeProvider mode="dark">
      <Probe />
      <DiffViewer provider={branchProvider()} onClose={() => {}} />
    </ThemeProvider>
  ), { width: 100, height: 28, kittyKeyboard: true })
  try {
    await settle(app)
    app.mockInput.pressKey("d")
    await settle(app)
    app.mockInput.pressArrow("down")
    app.mockInput.pressArrow("down")
    app.mockInput.pressEnter()
    await settle(app)
    app.mockInput.typeText("t")
    await settle(app)
    expect(probeValue(app.captureCharFrame()).name).toBe("opencode2")
    expect(app.captureCharFrame()).toContain("main")
  } finally {
    app.renderer.destroy()
  }
})

test("reports theme changes to the host", async () => {
  const names: string[] = []
  const app = await testRender(() => (
    <ThemeProvider mode="dark" onChange={(name) => names.push(name)}>
      <DiffViewer provider={branchProvider()} onClose={() => {}} />
    </ThemeProvider>
  ), { width: 120, height: 30, kittyKeyboard: true })
  try {
    await settle(app)
    app.mockInput.pressKey("t")
    await settle(app)
    expect(names).toEqual([nextTheme("opencode2", 1)])
    app.mockInput.pressKey("t", { shift: true })
    await settle(app)
    expect(names).toEqual([nextTheme("opencode2", 1), "opencode2"])
  } finally {
    app.renderer.destroy()
  }
})

function probeValue(frame: string) {
  const match = /(opencode2|opencode|[a-z][a-z0-9-]*)\|(#[0-9a-f]{6,8})\|(\d+)/.exec(frame)
  if (!match) throw new Error("Theme probe not found")
  return { name: match[1]!, hex: match[2]!, generations: Number(match[3]) }
}

function hex(name: string, mode: "dark" | "light") {
  return rgbToHex(resolveTheme(name, mode).theme.background.base)
}

function spanColors(frame: CapturedFrame, text: string) {
  for (const line of frame.lines) {
    const span = line.spans.find((item) => item.text.includes(text))
    if (span) return { fg: rgbToHex(span.fg), bg: rgbToHex(span.bg) }
  }
  throw new Error(`Span not found: ${text}`)
}

async function settle(app: Awaited<ReturnType<typeof testRender>>) {
  await app.renderOnce()
  await Promise.resolve()
  await Promise.resolve()
  await app.renderOnce()
}
