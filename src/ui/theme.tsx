/** @jsxImportSource @opentui/solid */
import type { SyntaxStyle } from "@opentui/core"
import { useRenderer } from "@opentui/solid"
import {
  generateSyntax,
  resolveThemeDocument,
  type ResolvedTheme,
  type ThemeDocument,
} from "@opencode/theme/tui"
import { createContext, createEffect, createMemo, useContext, type ParentProps } from "solid-js"
import document from "./opencode2.json"

export type ThemeMode = "dark" | "light"
type ThemeContextValue = { theme: ResolvedTheme; syntax: SyntaxStyle }
const ThemeContext = createContext<ThemeContextValue>()

export function ThemeProvider(props: ParentProps<{ mode: ThemeMode }>) {
  const renderer = useRenderer()
  const value = createMemo(() => {
    const theme = resolveThemeDocument(document as unknown as ThemeDocument, props.mode)
    return { theme, syntax: generateSyntax(theme, renderer.nativeScene) }
  })
  createEffect(() => renderer.setBackgroundColor(value().theme.background.base))
  return <ThemeContext.Provider value={value()}>{props.children}</ThemeContext.Provider>
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
