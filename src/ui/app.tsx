/** @jsxImportSource @opentui/solid */
import { createCliRenderer } from "@opentui/core"
import { render } from "@opentui/solid"
import type { ReadStream } from "node:tty"
import type { DiffProvider, SnapshotPort } from "../model"
import { ThemeProvider, type ThemeMode } from "./theme"
import { DiffViewer, type OpenSnapshot, type ViewerPreferences } from "./viewer"

export async function runViewer(options: {
  provider: DiffProvider
  preferences: ViewerPreferences
  theme: string
  mode: ThemeMode
  snapshots?: SnapshotPort
  workspace?: string
  snapshot?: OpenSnapshot
  onThemeChange?: (name: string) => void
  onPreferencesChange?: (value: ViewerPreferences) => void
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
      <ThemeProvider mode={options.mode} theme={options.theme} onChange={options.onThemeChange}>
        <DiffViewer provider={options.provider} preferences={options.preferences}
          snapshots={options.snapshots} workspace={options.workspace} snapshot={options.snapshot}
          onPreferencesChange={options.onPreferencesChange}
          onClose={() => renderer.destroy()} />
      </ThemeProvider>
    ), renderer)
    await renderer.closed
  } finally {
    if (!renderer.isDestroyed) renderer.destroy()
    await renderer.closed.catch(() => {})
  }
}
