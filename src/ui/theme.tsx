/** @jsxImportSource @opentui/solid */
import type { SyntaxStyle } from "@opentui/core"
import { useRenderer } from "@opentui/solid"
import { generateSyntax } from "@opencode/theme/tui"
import {
  createContext,
  createEffect,
  createMemo,
  createSignal,
  onCleanup,
  useContext,
  type Accessor,
  type ParentProps,
} from "solid-js"
import { createComponentTheme, type ComponentTheme } from "./theme-component"
import {
  DEFAULT_THEME,
  hasTheme,
  nextTheme,
  resolveTheme,
  themeLabel,
  type ThemeMode,
} from "./themes"

export type { ThemeMode } from "./themes"

type ThemeContextValue = {
  readonly theme: ComponentTheme
  readonly syntax: Accessor<SyntaxStyle>
  readonly name: Accessor<string>
  readonly label: Accessor<string>
  readonly cycleTheme: (step: number) => void
}

const ThemeContext = createContext<ThemeContextValue>()

export function ThemeProvider(props: ParentProps<{ mode: ThemeMode; theme?: string; onChange?: (name: string) => void }>) {
  const renderer = useRenderer()
  const [name, setName] = createSignal(
    props.theme !== undefined && hasTheme(props.theme) ? props.theme : DEFAULT_THEME,
  )
  const selection = createMemo(() => resolveTheme(name(), props.mode))
  const theme = createComponentTheme(() => selection().theme)
  const syntax = createSyntaxStyleMemo(() => generateSyntax(selection().theme, renderer.nativeScene))
  createEffect(() => renderer.setBackgroundColor(selection().theme.background.base))

  const value: ThemeContextValue = {
    theme,
    syntax,
    name,
    label: () => {
      const resolved = selection()
      const label = themeLabel(resolved.name)
      return resolved.mode === props.mode ? label : `${label} (${resolved.mode})`
    },
    cycleTheme: (step) => {
      const next = nextTheme(name(), step)
      setName(next)
      props.onChange?.(next)
    },
  }

  return <ThemeContext.Provider value={value}>{props.children}</ThemeContext.Provider>
}

export function useTheme() {
  const value = useContext(ThemeContext)
  if (!value) throw new Error("ThemeProvider is missing")
  return value.theme
}

export function useSyntax() {
  const value = useContext(ThemeContext)
  if (!value) throw new Error("ThemeProvider is missing")
  return value.syntax
}

export function useThemeControls() {
  const value = useContext(ThemeContext)
  if (!value) throw new Error("ThemeProvider is missing")
  return value
}

// Replacing the syntax style invalidates native resources. Keep the previous
// style alive until the renderer is idle so mounted renderables stop using it.
function createSyntaxStyleMemo(factory: () => SyntaxStyle) {
  const renderer = useRenderer()
  const retained = new Set<SyntaxStyle>()
  let current: SyntaxStyle | undefined

  const release = (style: SyntaxStyle) => {
    retained.add(style)
    void renderer
      .idle()
      .catch(() => {})
      .finally(() => {
        if (!retained.delete(style)) return
        style.destroy()
      })
  }

  onCleanup(() => {
    if (current) release(current)
  })

  return createMemo(() => {
    const previous = current
    current = factory()
    if (previous) release(previous)
    return current
  })
}
