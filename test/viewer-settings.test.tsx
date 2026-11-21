/** @jsxImportSource @opentui/solid */
import { expect, test } from "bun:test"
import { testRender } from "@opentui/solid"
import { createPatchProvider } from "../src/provider/patch"
import { ThemeProvider } from "../src/ui/theme"
import { DiffViewer, type ViewerPreferences } from "../src/ui/viewer"
import { ADDED_PATCH, MODIFIED_PATCH } from "./fixtures"

test("starts from persisted preferences", async () => {
  const app = await testRender(() => (
    <ThemeProvider mode="dark">
      <DiffViewer provider={createPatchProvider(MODIFIED_PATCH + ADDED_PATCH)}
        preferences={{ tree: false, single: true, view: "unified" }} onClose={() => {}} />
    </ThemeProvider>
  ), { width: 120, height: 30, kittyKeyboard: true })
  try {
    await settle(app)
    const frame = app.captureCharFrame()
    expect(frame).toContain("src/hello.ts")
    expect(frame).not.toContain("new.txt")
    expect(frame).not.toContain("▾ src")
  } finally {
    app.renderer.destroy()
  }
})

test("reports interactive layout changes", async () => {
  const changes: ViewerPreferences[] = []
  const app = await testRender(() => (
    <ThemeProvider mode="dark">
      <DiffViewer provider={createPatchProvider(MODIFIED_PATCH + ADDED_PATCH)}
        preferences={{ tree: true, single: false, view: "auto" }}
        onPreferencesChange={(value) => changes.push(value)} onClose={() => {}} />
    </ThemeProvider>
  ), { width: 120, height: 30, kittyKeyboard: true })
  try {
    await settle(app)
    app.mockInput.pressKey("b")
    await settle(app)
    expect(changes.at(-1)).toEqual({ tree: false })

    app.mockInput.pressKey("s")
    await settle(app)
    expect(changes.at(-1)).toEqual({ single: true })

    app.mockInput.pressKey("v")
    await settle(app)
    expect(changes.at(-1)).toEqual({ view: "unified" })
  } finally {
    app.renderer.destroy()
  }
})

async function settle(app: Awaited<ReturnType<typeof testRender>>) {
  await app.renderOnce()
  await Promise.resolve()
  await Promise.resolve()
  await app.renderOnce()
}
