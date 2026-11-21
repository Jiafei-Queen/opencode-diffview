/** @jsxImportSource @opentui/solid */
import { expect, test } from "bun:test"
import { testRender } from "@opentui/solid"
import type { DiffFile, SnapshotDraft, SnapshotPort, SnapshotSummary } from "../src/model"
import { addPatch, createPatchProvider, parsePatch } from "../src/provider/patch"
import { createSavedProvider } from "../src/store/snapshot"
import { ThemeProvider } from "../src/ui/theme"
import { DiffViewer } from "../src/ui/viewer"
import { ADDED_PATCH, MODIFIED_PATCH } from "./fixtures"

function memoryPort() {
  const records = new Map<string, { summary: SnapshotSummary; files: readonly DiffFile[] }>()
  const drafts: SnapshotDraft[] = []
  const updates: { id: string; reviewed: readonly string[] }[] = []
  const removed: string[] = []
  let counter = 0
  const port: SnapshotPort = {
    list: async () => [...records.values()].map((record) => record.summary),
    async save(draft) {
      drafts.push(draft)
      const id = draft.id ?? `saved-${++counter}`
      const now = new Date().toISOString()
      const summary: SnapshotSummary = {
        id,
        name: draft.name,
        createdAt: now,
        updatedAt: now,
        cwd: draft.cwd,
        source: draft.source,
        ...(draft.base === undefined ? {} : { base: draft.base }),
        fileCount: draft.files.length,
        reviewed: [...draft.reviewed],
        bytes: 512,
      }
      records.set(id, { summary, files: draft.files })
      return summary
    },
    async updateProgress(id, reviewed) {
      updates.push({ id, reviewed })
      const record = records.get(id)
      if (record) record.summary = { ...record.summary, reviewed: [...reviewed] }
    },
    async remove(id) {
      removed.push(id)
      records.delete(id)
    },
    async open(id) {
      const record = records.get(id)
      if (!record) throw new Error("missing")
      return { summary: record.summary, provider: createSavedProvider(record.files, record.summary.name) }
    },
  }
  return { port, drafts, updates, removed }
}

test("saves a review and keeps recording progress", async () => {
  const memory = memoryPort()
  const app = await testRender(() => (
    <ThemeProvider mode="dark">
      <DiffViewer provider={createPatchProvider(MODIFIED_PATCH + ADDED_PATCH)}
        snapshots={memory.port} workspace="/tmp/demo" onClose={() => {}} />
    </ThemeProvider>
  ), { width: 120, height: 30, kittyKeyboard: true })
  try {
    await settle(app)
    app.mockInput.pressKey("m")
    await settle(app)
    expect(app.captureCharFrame()).toContain("1/2")

    app.mockInput.pressKey("s", { ctrl: true })
    await settle(app)
    const dialog = app.captureCharFrame()
    expect(dialog).toContain("Save review")
    expect(dialog).toContain("demo · Patch")

    app.mockInput.pressEnter()
    await settle(app)
    expect(memory.drafts).toHaveLength(1)
    expect(memory.drafts[0]!.reviewed).toEqual(["src/hello.ts"])
    expect(app.captureCharFrame()).toContain("Saved")

    app.mockInput.pressKey("m")
    await app.renderOnce()
    await Bun.sleep(250)
    await settle(app)
    expect(memory.updates.at(-1)?.reviewed).toEqual([])

    app.mockInput.pressKey("m")
    await app.renderOnce()
    await Bun.sleep(250)
    await settle(app)
    expect(memory.updates.at(-1)?.reviewed).toEqual(["src/hello.ts"])
  } finally {
    app.renderer.destroy()
  }
})

test("help lists the review shortcuts", async () => {
  const app = await testRender(() => (
    <ThemeProvider mode="dark">
      <DiffViewer provider={createPatchProvider(MODIFIED_PATCH)} onClose={() => {}} />
    </ThemeProvider>
  ), { width: 100, height: 30, kittyKeyboard: true })
  try {
    await settle(app)
    app.mockInput.pressKey("?")
    await settle(app)
    const frame = app.captureCharFrame()
    expect(frame).toContain("Save review")
    expect(frame).toContain("Saved reviews")
  } finally {
    app.renderer.destroy()
  }
})

test("refuses to save a read-only review port", async () => {
  const memory = memoryPort()
  const app = await testRender(() => (
    <ThemeProvider mode="dark">
      <DiffViewer provider={createPatchProvider(MODIFIED_PATCH)}
        snapshots={{ ...memory.port, writable: false }} workspace="/tmp/demo" onClose={() => {}} />
    </ThemeProvider>
  ), { width: 120, height: 30, kittyKeyboard: true })
  try {
    await settle(app)
    app.mockInput.pressKey("s", { ctrl: true })
    await settle(app)
    expect(app.captureCharFrame()).toContain("Saving disabled")
    expect(memory.drafts).toEqual([])
  } finally {
    app.renderer.destroy()
  }
})

test("lists, opens, and deletes a saved review", async () => {
  const memory = memoryPort()
  const app = await testRender(() => (
    <ThemeProvider mode="dark">
      <DiffViewer provider={createPatchProvider(MODIFIED_PATCH + ADDED_PATCH)}
        snapshots={memory.port} workspace="/tmp/demo" onClose={() => {}} />
    </ThemeProvider>
  ), { width: 120, height: 30, kittyKeyboard: true })
  try {
    await settle(app)
    app.mockInput.pressKey("m")
    await settle(app)
    app.mockInput.pressKey("s", { ctrl: true })
    await settle(app)
    app.mockInput.pressEnter()
    await settle(app)
    const name = memory.drafts[0]!.name

    app.mockInput.pressKey("r")
    await settle(app)
    expect(app.captureCharFrame()).toContain("Saved reviews")
    expect(app.captureCharFrame()).toContain(name)

    app.mockInput.pressEnter()
    await settle(app)
    expect(app.captureCharFrame()).toContain("Saved")
    expect(app.captureCharFrame()).toContain("1/2")

    app.mockInput.pressKey("r")
    await settle(app)
    app.mockInput.pressKey("d")
    await settle(app)
    expect(app.captureCharFrame()).toContain("Delete")
    app.mockInput.pressEnter()
    await settle(app)
    await Bun.sleep(20)
    await settle(app)
    expect(memory.removed).toEqual(["saved-1"])
    app.mockInput.pressKey("r")
    await settle(app)
    expect(app.captureCharFrame()).toContain("No saved reviews yet")
  } finally {
    app.renderer.destroy()
  }
})

test("opens a review at its first unreviewed file", async () => {
  const memory = memoryPort()
  const files = Array.from({ length: 12 }, (_, index) =>
    parsePatch(addPatch(`file-${index}.txt`, "value\n"))[0]!)
  await memory.port.save({
    name: "Many files",
    cwd: "/tmp/demo",
    source: "patch",
    files,
    reviewed: files.slice(0, 11).map((file) => file.file),
  })
  const app = await testRender(() => (
    <ThemeProvider mode="dark">
      <DiffViewer provider={createPatchProvider(files[0]!.patch ?? "")}
        snapshots={memory.port} workspace="/tmp/demo" onClose={() => {}} />
    </ThemeProvider>
  ), { width: 120, height: 20, kittyKeyboard: true })
  try {
    await settle(app)
    app.mockInput.pressKey("r")
    await settle(app)
    app.mockInput.pressEnter()
    await settle(app)
    await Bun.sleep(20)
    await settle(app)
    const scroll = app.renderer.root.findDescendantById("diff-patches") as unknown as { scrollTop: number }
    expect(scroll.scrollTop).toBeGreaterThan(0)

    app.mockInput.pressKey("m")
    await app.renderOnce()
    await Bun.sleep(250)
    await settle(app)
    expect(memory.updates.at(-1)?.reviewed).toContain("file-11.txt")
  } finally {
    app.renderer.destroy()
  }
})

async function settle(app: Awaited<ReturnType<typeof testRender>>) {
  for (let pass = 0; pass < 4; pass++) {
    await app.renderOnce()
    await Promise.resolve()
  }
}
