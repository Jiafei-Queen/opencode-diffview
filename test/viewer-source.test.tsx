/** @jsxImportSource @opentui/solid */
import { expect, test } from "bun:test"
import { testRender } from "@opentui/solid"
import type { DiffProvider, DiffRequest } from "../src/model"
import { addPatch, parsePatch } from "../src/provider/patch"
import { ThemeProvider } from "../src/ui/theme"
import { DiffViewer } from "../src/ui/viewer"

test("switches source and chooses a base branch", async () => {
  const requests: DiffRequest[] = []
  const provider: DiffProvider = {
    modes: ["branch", "committed", "working"],
    initialMode: "branch",
    diff: async (request) => {
      requests.push(request)
      const file = `${request.source}.txt`
      return {
        files: parsePatch(addPatch(file, `${request.base ?? "default"}\n`)),
        detail: request.source === "working" ? "vs HEAD" : `vs ${request.base ?? "main"}`,
        base: request.source === "working" ? undefined : request.base ?? "main",
      }
    },
    branches: async (search) => ["main", "develop"].filter((branch) => branch.includes(search)),
  }
  const app = await testRender(() => (
    <ThemeProvider mode="dark"><DiffViewer provider={provider} onClose={() => {}} /></ThemeProvider>
  ), { width: 100, height: 24, kittyKeyboard: true })
  try {
    await settle(app)
    app.mockInput.pressKey("d")
    await app.renderOnce()
    expect(app.captureCharFrame()).toContain("Branch commits only")
    app.mockInput.pressArrow("down")
    app.mockInput.pressEnter()
    await settle(app)
    expect(requests.at(-1)?.source).toBe("committed")

    app.mockInput.pressKey("d")
    await app.renderOnce()
    for (let index = 0; index < 3; index++) app.mockInput.pressArrow("down")
    app.mockInput.pressEnter()
    await settle(app)
    app.mockInput.typeText("dev")
    await settle(app)
    expect(app.captureCharFrame()).toContain("develop")
    app.mockInput.pressEnter()
    await settle(app)
    expect(requests.at(-1)?.source).toBe("committed")
    expect(requests.at(-1)?.base).toBe("develop")
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
