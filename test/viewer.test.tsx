/** @jsxImportSource @opentui/solid */
import { expect, test } from "bun:test"
import { testRender } from "@opentui/solid"
import { DiffRenderable, type Renderable, type ScrollBoxRenderable } from "@opentui/core"
import { createPatchProvider } from "../src/provider/patch"
import { ThemeProvider } from "../src/ui/theme"
import { DiffViewer } from "../src/ui/viewer"
import { ADDED_PATCH, MODIFIED_PATCH } from "./fixtures"

test.each([80, 160])("renders and navigates a patch at %i columns", async (width) => {
  let closed = false
  const app = await testRender(() => (
    <ThemeProvider mode="dark">
      <DiffViewer provider={createPatchProvider(MODIFIED_PATCH + ADDED_PATCH)} onClose={() => (closed = true)} />
    </ThemeProvider>
  ), { width, height: 24, kittyKeyboard: true })
  try {
    await settle(app)
    const frame = app.captureCharFrame()
    expect(frame).toContain("src/hello.ts")
    expect(frame).toContain("new.txt")
    expect(frame).toContain("Patch")
    if (width === 160) expect(frame).toContain("0/2")
    else expect(frame).toContain("0/2 reviewed")

    app.mockInput.pressKey("n")
    await app.renderOnce()
    app.mockInput.pressKey("m")
    await app.renderOnce()
    expect(app.captureCharFrame()).toContain("1/2")
    app.mockInput.pressEscape()
    expect(closed).toBe(true)
  } finally {
    app.renderer.destroy()
  }
})

test("virtualizes a large added file", async () => {
  const count = 3001
  const lines = Array.from({ length: count }, (_, index) => `+line ${index}`).join("\n")
  const patch = `diff --git a/large.txt b/large.txt\nnew file mode 100644\n--- /dev/null\n+++ b/large.txt\n@@ -0,0 +1,${count} @@\n${lines}\n`
  const app = await testRender(() => (
    <ThemeProvider mode="dark">
      <DiffViewer provider={createPatchProvider(patch)} onClose={() => {}} />
    </ThemeProvider>
  ), { width: 120, height: 24, kittyKeyboard: true })
  try {
    await settle(app)
    const diffs = findDiffs(app.renderer.root)
    expect(diffs.length).toBeGreaterThan(0)
    expect(diffs.length).toBeLessThanOrEqual(4)
  } finally {
    app.renderer.destroy()
  }
})

test("shows an error for unrecognized patch input", async () => {
  const app = await testRender(() => (
    <ThemeProvider mode="light">
      <DiffViewer provider={createPatchProvider("not a patch")} onClose={() => {}} />
    </ThemeProvider>
  ), { width: 80, height: 20, kittyKeyboard: true })
  try {
    await settle(app)
    expect(app.captureCharFrame()).toContain("does not contain a recognizable unified diff")
  } finally {
    app.renderer.destroy()
  }
})

test("scrolls by the configured keyboard step and wheel speed", async () => {
  const count = 80
  const lines = Array.from({ length: count }, (_, index) => `+line ${index}`).join("\n")
  const patch = `diff --git a/long.txt b/long.txt\nnew file mode 100644\n--- /dev/null\n+++ b/long.txt\n@@ -0,0 +1,${count} @@\n${lines}\n`
  const app = await testRender(() => (
    <ThemeProvider mode="dark">
      <DiffViewer provider={createPatchProvider(patch)} preferences={{ scrollLines: 4, scrollWheel: 2 }} onClose={() => {}} />
    </ThemeProvider>
  ), { width: 100, height: 20, kittyKeyboard: true })
  try {
    await settle(app)
    const scroll = app.renderer.root.findDescendantById("diff-patches") as ScrollBoxRenderable
    expect(scroll.scrollTop).toBe(0)
    app.mockInput.pressKey("j")
    await settle(app)
    expect(scroll.scrollTop).toBe(4)
    app.mockInput.pressKey("k")
    await settle(app)
    expect(scroll.scrollTop).toBe(0)
    await app.mockMouse.scroll(60, 10, "down")
    await settle(app)
    expect(scroll.scrollTop).toBe(2)
  } finally {
    app.renderer.destroy()
  }
})

function findDiffs(root: Renderable): DiffRenderable[] {
  return [...(root instanceof DiffRenderable ? [root] : []), ...root.getChildren().flatMap(findDiffs)]
}

async function settle(app: Awaited<ReturnType<typeof testRender>>) {
  await app.renderOnce()
  await Promise.resolve()
  await Promise.resolve()
  await app.renderOnce()
}
