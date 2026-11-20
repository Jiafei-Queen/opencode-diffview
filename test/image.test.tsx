/** @jsxImportSource @opentui/solid */
import { expect, test } from "bun:test"
import { ImageRenderable, type Renderable } from "@opentui/core"
import { testRender } from "@opentui/solid"
import { createSignal, Show } from "solid-js"
import { DiffViewerImage, isDiffImageFile } from "../src/ui/image"
import { ThemeProvider } from "../src/ui/theme"
import { diffImageFixture } from "./diff-image"

test("recognizes only supported image file extensions", () => {
  for (const extension of ["png", "jpg", "jpeg", "webp", "gif", "PNG", "JPEG"]) {
    expect(isDiffImageFile(`assets/preview.${extension}`)).toBe(true)
  }
  for (const file of ["assets/preview.svg", "preview.avif", "image.png.ts", "png", "image.png/file"]) {
    expect(isDiffImageFile(file)).toBe(false)
  }
})

test("renders a real image and reports its size", async () => {
  const app = await testRender(() => (
    <ThemeProvider mode="dark">
      <DiffViewerImage file="assets/landscape.png" load={async () => diffImageFixture} />
    </ThemeProvider>
  ), { width: 120, height: 40, kittyKeyboard: true })
  try {
    await settle(app)
    await app.waitForFrame((frame) => frame.includes("96 x 48"))
    expect(app.captureCharFrame()).toContain("Working tree preview")
    const image = findImage(app.renderer.root)!
    expect(image.image?.width).toBe(96)
    expect(image.image?.height).toBe(48)
  } finally {
    app.renderer.destroy()
  }
})

test("pending image reads abort when the preview unmounts", async () => {
  const pending = Promise.withResolvers<Uint8Array>()
  const [visible, setVisible] = createSignal(true)
  const signals: AbortSignal[] = []
  const app = await testRender(() => (
    <ThemeProvider mode="dark">
      <Show when={visible()}>
        <DiffViewerImage file="a.png" load={(_, signal) => {
          signals.push(signal)
          return pending.promise
        }} />
      </Show>
    </ThemeProvider>
  ), { width: 80, height: 24, kittyKeyboard: true })
  try {
    await app.renderOnce()
    expect(signals[0]?.aborted).toBe(false)
    setVisible(false)
    await app.renderOnce()
    expect(signals[0]?.aborted).toBe(true)
  } finally {
    app.renderer.destroy()
    pending.resolve(diffImageFixture)
  }
})

test("recovers from a decode error when the file changes", async () => {
  const [file, setFile] = createSignal("broken.png")
  const app = await testRender(() => (
    <ThemeProvider mode="dark">
      <DiffViewerImage file={file()} load={async (name) =>
        name === "broken.png" ? new Uint8Array([1, 2, 3]) : diffImageFixture} />
    </ThemeProvider>
  ), { width: 80, height: 24, kittyKeyboard: true })
  try {
    await settle(app)
    expect(app.captureCharFrame()).toContain("Could not decode image")
    setFile("landscape.png")
    await settle(app)
    expect(app.captureCharFrame()).not.toContain("Could not")
  } finally {
    app.renderer.destroy()
  }
})

function findImage(root: Renderable): ImageRenderable | undefined {
  if (root instanceof ImageRenderable) return root
  return root.getChildren().reduce<ImageRenderable | undefined>((found, child) => found ?? findImage(child), undefined)
}

async function settle(app: Awaited<ReturnType<typeof testRender>>) {
  await app.renderOnce()
  await Promise.resolve()
  await Promise.resolve()
  await app.renderOnce()
}
