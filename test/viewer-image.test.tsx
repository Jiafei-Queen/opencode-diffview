/** @jsxImportSource @opentui/solid */
import { expect, test } from "bun:test"
import { testRender } from "@opentui/solid"
import type { DiffProvider, DiffSource } from "../src/model"
import { ThemeProvider } from "../src/ui/theme"
import { DiffViewer } from "../src/ui/viewer"
import { diffImageFixture } from "./diff-image"

const binaryPatch = `diff --git a/assets/preview.png b/assets/preview.png
new file mode 100644
Binary files /dev/null and b/assets/preview.png differ
`

function imageProvider(initialMode: DiffSource, loadImage?: DiffProvider["loadImage"]): DiffProvider {
  return {
    modes: ["branch", "committed", "working"],
    initialMode,
    loadImage,
    diff: async () => ({
      files: [{ file: "assets/preview.png", patch: binaryPatch, additions: 0, deletions: 0, status: "added" }],
    }),
  }
}

test("working scope previews the working-tree image", async () => {
  const app = await testRender(() => (
    <ThemeProvider mode="dark">
      <DiffViewer provider={imageProvider("working", async () => diffImageFixture)} onClose={() => {}} />
    </ThemeProvider>
  ), { width: 120, height: 40, kittyKeyboard: true })
  try {
    await settle(app)
    await app.waitForFrame((frame) => frame.includes("96 x 48"))
    expect(app.captureCharFrame()).toContain("Working tree preview")
  } finally {
    app.renderer.destroy()
  }
})

test("committed scope never shows the working-tree image", async () => {
  const app = await testRender(() => (
    <ThemeProvider mode="dark">
      <DiffViewer provider={imageProvider("committed", async () => diffImageFixture)} onClose={() => {}} />
    </ThemeProvider>
  ), { width: 120, height: 40, kittyKeyboard: true })
  try {
    await settle(app)
    const frame = app.captureCharFrame()
    expect(frame).toContain("Committed image preview unavailable")
    expect(frame).not.toContain("Working tree preview")
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
