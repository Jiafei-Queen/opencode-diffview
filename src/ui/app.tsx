/** @jsxImportSource @opentui/solid */
import { createCliRenderer } from "@opentui/core"
import { render } from "@opentui/solid"
import type { ReadStream } from "node:tty"
import type { DiffProvider } from "../model"
import { ThemeProvider, type ThemeMode } from "./theme"
import { DiffViewer, type ViewerPreferences } from "./viewer"

export async function runViewer(options: {
  provider: DiffProvider
  preferences: ViewerPreferences
  theme: ThemeMode
  stdin?: ReadStream
}) {
  const renderer = await createCliRenderer({
    stdin: options.stdin,
    targetFps: 60,
    gatherStats: false,
    exitOnCtrlC: false,
    useKittyKeyboard: {},
    autoFocus: false,
    openConsoleOnError: false,
    useMouse: true,
  })
  try {
    await render(() => (
      <ThemeProvider mode={options.theme}>
        <DiffViewer provider={options.provider} preferences={options.preferences}
          onClose={() => renderer.destroy()} />
      </ThemeProvider>
    ), renderer)
    await renderer.closed
  } finally {
    if (!renderer.isDestroyed) renderer.destroy()
    await renderer.closed.catch(() => {})
  }
}
