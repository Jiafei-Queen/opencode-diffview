/** @jsxImportSource @opentui/solid */
import {
  BoxRenderable,
  MouseButton,
  TextAttributes,
  type InputRenderable,
  type MouseEvent,
  type ScrollBoxRenderable,
} from "@opentui/core"
import { useKeyboard, useRenderer, useTerminalDimensions } from "@opentui/solid"
import {
  createEffect,
  createMemo,
  createResource,
  createSignal,
  For,
  Match,
  onCleanup,
  Show,
  Switch,
} from "solid-js"
import {
  SOURCE_LABELS,
  type DiffFile,
  type DiffMode,
  type DiffProvider,
} from "../model"
import { filetype } from "../util/filetype"
import {
  allExpandedFileTreeDirectories,
  buildFileTree,
  fileTreeFileSelection,
  movePatchFileIndex,
  toggleFileTreeDirectory,
  type FileTreeRow,
} from "./file-tree"
import { DiffViewerFileTree } from "./file-tree-view"
import { FilePath } from "./file-path"
import { DiffViewerImage, isDiffImageFile } from "./image"
import { PatchDiff, type PatchDiffRef } from "./patch-diff"
import { useSyntax, useTheme } from "./theme"

const MIN_SPLIT_WIDTH = 100
const COMPACT_MAX_WIDTH = 87

type DialogState =
  | { type: "source" }
  | { type: "base" }
  | { type: "help" }
  | { type: "menu"; fileIndex: number }
  | { type: "image"; file: string; bytes: Uint8Array }

export type ViewerPreferences = {
  readonly tree?: boolean
  readonly single?: boolean
  readonly view?: "auto" | "split" | "unified"
}

export function DiffViewer(props: {
  provider: DiffProvider
  preferences?: ViewerPreferences
  onPreferencesChange?: (value: ViewerPreferences) => void
  onClose: () => void
}) {
  const theme = useTheme()
  const syntax = useSyntax()
  const renderer = useRenderer()
  const dimensions = useTerminalDimensions()
  const [mode, setMode] = createSignal<DiffMode>(props.provider.initialMode)
  const [base, setBase] = createSignal<string>()
  const input = createMemo(() => ({ source: mode(), base: base() }))
  const [diff] = createResource(input, async (value) => {
    const controller = new AbortController()
    onCleanup(() => controller.abort())
    return props.provider.diff({ ...value, signal: controller.signal })
  })
  const files = () => diff.loading || diff.error ? [] : (diff()?.files ?? [])
  const detail = () => diff.loading ? "Resolving diff…" : diff.error ? "Diff unavailable" : diff()?.detail
  const [dialog, setDialog] = createSignal<DialogState>()
  const [dialogIndex, setDialogIndex] = createSignal(0)
  const [query, setQuery] = createSignal("")
  const branchInput = () => dialog()?.type === "base" ? query() : false
  const [branches] = createResource(branchInput, async (search) => {
    const controller = new AbortController()
    onCleanup(() => controller.abort())
    return props.provider.branches?.(search, controller.signal) ?? []
  })
  const [treeEnabled, setTreeEnabled] = createSignal(props.preferences?.tree ?? true)
  const [single, setSingle] = createSignal(props.preferences?.single ?? false)
  const [viewOverride, setViewOverride] = createSignal<"split" | "unified">()
  const [expandedNodes, setExpandedNodes] = createSignal<ReadonlySet<number>>(new Set())
  const [selectedFile, setSelectedFile] = createSignal<number>()
  const [reviewed, setReviewed] = createSignal<ReadonlySet<string>>(new Set())
  const fileTree = createMemo(() => buildFileTree(files()))
  const compact = createMemo(() => dimensions().width <= COMPACT_MAX_WIDTH)
  const showTree = createMemo(() => !compact() && treeEnabled() && files().length > 0)
  const treeWidth = createMemo(() => Math.max(30, Math.min(40, Math.floor(dimensions().width / 4))))
  const inset = createMemo(() => compact() ? 0 : 2)
  const patchWidth = createMemo(() => dimensions().width - (showTree() ? treeWidth() : 0) - inset() * 2)
  const splitAvailable = createMemo(() => patchWidth() >= MIN_SPLIT_WIDTH)
  const view = createMemo(() => splitAvailable()
    ? viewOverride() ?? (props.preferences?.view === "unified" ? "unified" : "split")
    : "unified")
  const visibleFiles = createMemo((): { file: DiffFile; fileIndex: number }[] => {
    const all = files().map((file, fileIndex) => ({ file, fileIndex }))
    if (!single()) return all
    const current = selectedFile() ?? currentFileIndex() ?? 0
    return all.filter((entry) => entry.fileIndex === current)
  })
  const fileIndexes = createMemo(() => files().map((_, index) => index))
  const patchNodes = new Map<number, BoxRenderable>()
  const patchDiffs = new Map<number, PatchDiffRef>()
  let scroll: ScrollBoxRenderable | undefined
  let lastG = false

  createEffect(() => {
    files()
    setExpandedNodes(allExpandedFileTreeDirectories(fileTree()))
    setSelectedFile(undefined)
    scroll?.scrollTo(0)
  })

  function currentFileIndex(): number | undefined {
    const candidates = single() && selectedFile() !== undefined ? [selectedFile()!] : fileIndexes()
    if (!scroll) return selectedFile() ?? candidates[0]
    const top = scroll.scrollTop
    return candidates.findLast((fileIndex) => {
      const node = patchNodes.get(fileIndex)
      return node ? node.y - scroll!.content.y <= top + 1 : false
    }) ?? selectedFile() ?? candidates[0]
  }

  function scrollToFile(fileIndex: number | undefined) {
    if (fileIndex === undefined) return
    setSelectedFile(fileIndex)
    const selection = fileTreeFileSelection(fileTree(), fileIndex)
    if (selection) setExpandedNodes((current) => new Set([...current, ...selection.expandedNodes]))
    renderer.requestAnimationFrame(() => {
      const node = patchNodes.get(fileIndex)
      if (node && scroll) scroll.scrollTo(Math.max(0, node.y - scroll.content.y - 1))
    })
  }

  function moveFile(offset: number) {
    scrollToFile(movePatchFileIndex(fileIndexes(), currentFileIndex(), offset))
  }

  function moveHunk(offset: number) {
    if (!scroll) return
    const nodes = visibleFiles().flatMap((entry) => [...(patchDiffs.get(entry.fileIndex)?.hunks() ?? [])])
      .filter((node) => !node.isDestroyed)
      .sort((left, right) => left.y - right.y)
    const positions = nodes.map((node) => node.y - scroll!.content.y)
    const current = scroll.scrollTop + 2
    const target = offset > 0
      ? positions.find((position) => position > current)
      : positions.findLast((position) => position < current - 1)
    if (target !== undefined) scroll.scrollTo(Math.max(0, target - 1))
  }

  function page(direction: number, divisor = 1) {
    if (scroll) scroll.scrollBy(direction * Math.max(1, Math.floor(scroll.viewport.height / divisor)))
  }

  function toggleReviewed(fileIndex: number) {
    const file = files()[fileIndex]
    if (!file) return
    const wasReviewed = reviewed().has(file.file)
    setReviewed((current) => {
      const next = new Set(current)
      if (wasReviewed) next.delete(file.file)
      else next.add(file.file)
      return next
    })
    if (single() && !wasReviewed) {
      const next = movePatchFileIndex(fileIndexes(), fileIndex, 1)
      if (next !== fileIndex) scrollToFile(next)
    }
  }

  function openDialog(state: DialogState) {
    setDialogIndex(0)
    setQuery("")
    setDialog(state)
  }

  function clickRow(row: FileTreeRow) {
    if (row.kind === "directory") {
      setExpandedNodes((current) => toggleFileTreeDirectory(fileTree(), current, row.id))
      return
    }
    if (row.fileIndex !== undefined) scrollToFile(row.fileIndex)
  }

  function openFileMenu(fileIndex: number, event: MouseEvent) {
    if (event.button !== MouseButton.RIGHT) return
    event.preventDefault()
    event.stopPropagation()
    openDialog({ type: "menu", fileIndex })
  }

  function sourceOptions() {
    return [
      ...props.provider.modes.map((value) => ({
        title: SOURCE_LABELS[value].label,
        description: SOURCE_LABELS[value].description,
        select: () => {
          setMode(value)
          setDialog(undefined)
        },
      })),
      ...(props.provider.branches ? [{
        title: "Base",
        description: diff.error ? "Unavailable" : diff()?.base ?? "Choose…",
        select: () => openDialog({ type: "base" }),
      }] : []),
    ]
  }

  function closeDialog() {
    setDialog(undefined)
  }

  useKeyboard((event) => {
    const currentDialog = dialog()
    if (currentDialog) {
      if (event.name === "escape" || event.name === "q" && currentDialog.type !== "base" || (event.name === "c" && event.ctrl)) {
        event.preventDefault()
        closeDialog()
        return
      }
      if (currentDialog.type === "image") return
      if (currentDialog.type === "help") {
        if (event.name === "return" || event.name === "?") {
          event.preventDefault()
          closeDialog()
        }
        return
      }
      const count = currentDialog.type === "source" ? sourceOptions().length
        : currentDialog.type === "base" ? (branches()?.length ?? 0)
          : 2
      if (event.name === "down" || event.name === "j") {
        event.preventDefault()
        setDialogIndex((index) => Math.min(Math.max(0, count - 1), index + 1))
        return
      }
      if (event.name === "up" || event.name === "k") {
        event.preventDefault()
        setDialogIndex((index) => Math.max(0, index - 1))
        return
      }
      if (event.name === "return") {
        event.preventDefault()
        if (currentDialog.type === "source") sourceOptions()[dialogIndex()]?.select()
        if (currentDialog.type === "base") {
          const value = branches()?.[dialogIndex()]
          if (value) {
            setBase(value)
            closeDialog()
          }
        }
        if (currentDialog.type === "menu") {
          if (dialogIndex() === 0) toggleReviewed(currentDialog.fileIndex)
          closeDialog()
        }
        return
      }
      if (currentDialog.type === "base") return
      if (currentDialog.type === "source" || currentDialog.type === "menu") return
    }
    if (event.name === "escape" || event.name === "q" || (event.name === "c" && event.ctrl)) {
      event.preventDefault()
      props.onClose()
      return
    }
    if (event.name === "down" || event.name === "j") {
      event.preventDefault()
      page(1, scroll?.viewport.height ?? 1)
      return
    }
    if (event.name === "up" || event.name === "k") {
      event.preventDefault()
      page(-1, scroll?.viewport.height ?? 1)
      return
    }
    if (event.name === "pagedown" || (event.name === "f" && event.ctrl)) {
      event.preventDefault()
      page(1)
      return
    }
    if (event.name === "pageup" || (event.name === "b" && event.ctrl)) {
      event.preventDefault()
      page(-1)
      return
    }
    if (event.name === "d" && event.ctrl) {
      event.preventDefault()
      page(1, 2)
      return
    }
    if (event.name === "u" && event.ctrl) {
      event.preventDefault()
      page(-1, 2)
      return
    }
    if (event.name === "home" || event.name === "g" && !event.shift) {
      event.preventDefault()
      if (event.name === "home" || lastG) {
        scroll?.scrollTo(0)
        lastG = false
      } else {
        lastG = true
        setTimeout(() => (lastG = false), 600)
      }
      return
    }
    lastG = false
    if (event.name === "end" || event.name === "g" && event.shift) {
      event.preventDefault()
      if (scroll) scroll.scrollTo(scroll.scrollHeight)
      return
    }
    if (event.name === "]") {
      event.preventDefault()
      moveHunk(1)
      return
    }
    if (event.name === "[") {
      event.preventDefault()
      moveHunk(-1)
      return
    }
    if (event.name === "n" || event.name === "down" && event.meta) {
      event.preventDefault()
      moveFile(1)
      return
    }
    if (event.name === "p" || event.name === "up" && event.meta) {
      event.preventDefault()
      moveFile(-1)
      return
    }
    if (event.name === "b" && !compact()) {
      event.preventDefault()
      const next = !treeEnabled()
      setTreeEnabled(next)
      props.onPreferencesChange?.({ tree: next })
      return
    }
    if (event.name === "s") {
      event.preventDefault()
      const next = !single()
      if (next) setSelectedFile(currentFileIndex() ?? 0)
      setSingle(next)
      props.onPreferencesChange?.({ single: next })
      renderer.requestAnimationFrame(() => scrollToFile(currentFileIndex()))
      return
    }
    if (event.name === "d" && props.provider.modes.length > 1) {
      event.preventDefault()
      openDialog({ type: "source" })
      return
    }
    if (event.name === "v" && splitAvailable()) {
      event.preventDefault()
      const next = view() === "split" ? "unified" : "split"
      setViewOverride(next)
      props.onPreferencesChange?.({ view: next })
      return
    }
    if (event.name === "m") {
      event.preventDefault()
      const current = currentFileIndex()
      if (current !== undefined) toggleReviewed(current)
      return
    }
    if (event.name === "?" || event.name === "/" && event.shift) {
      event.preventDefault()
      openDialog({ type: "help" })
    }
  })

  const help = <text id="diff-help-shortcut" fg={theme.text.muted} selectable={false} wrapMode="none"
    onMouseUp={(event) => {
      if (event.button !== MouseButton.LEFT) return
      event.stopPropagation()
      openDialog({ type: "help" })
    }}>? help</text>

  return (
    <box width="100%" height="100%" backgroundColor={theme.background.base}>
      <Show when={!showTree()}>
        <box id="diff-source-header" paddingLeft={2} paddingRight={1} height={1} flexShrink={0}
          flexDirection="row" gap={1}>
          <box flexDirection="row" flexGrow={1} minWidth={0} onMouseUp={() => openDialog({ type: "source" })}>
            <text fg={theme.text.action.secondary.base} attributes={TextAttributes.BOLD} wrapMode="none">
              {SOURCE_LABELS[mode()].label}
            </text>
            <Show when={detail()}><text fg={theme.text.muted} wrapMode="none" truncate>{` · ${detail()}`}</text></Show>
          </box>
          <text fg={theme.text.muted}>{files().filter((file) => reviewed().has(file.file)).length}/{files().length} reviewed</text>
        </box>
      </Show>
      <box flexGrow={1} minHeight={0}>
        <Switch>
          <Match when={diff.loading}><CenteredText text="Loading diff…" /></Match>
          <Match when={diff.error}><CenteredText text={errorMessage(diff.error)} error /></Match>
          <Match when={files().length === 0}><CenteredText text="No changes to show" /></Match>
          <Match when={files().length > 0}>
            <box flexDirection="row" flexGrow={1} minHeight={0}>
              <Show when={showTree()}>
                <DiffViewerFileTree files={files()} loading={diff.loading} error={diff.error} width={treeWidth()}
                  selectedFileIndex={selectedFile() ?? currentFileIndex()} reviewedFileNames={reviewed()}
                  expandedNodes={expandedNodes()} onRowClick={clickRow} onFileContextMenu={openFileMenu}
                  source={SOURCE_LABELS[mode()].label} sourceDetail={detail()}
                  onSwitchSource={props.provider.modes.length > 1 ? () => openDialog({ type: "source" }) : undefined}
                  footer={help} />
              </Show>
              <box flexGrow={1} minWidth={0} minHeight={0}>
                <box height={1} flexShrink={0} marginLeft={inset()} marginRight={inset()}
                  backgroundColor={theme.diff.background.context} />
                <scrollbox id="diff-patches" ref={(element: ScrollBoxRenderable) => (scroll = element)}
                  flexGrow={1} minHeight={0} verticalScrollbarOptions={{ visible: false }}
                  horizontalScrollbarOptions={{ visible: false }}>
                  <For each={visibleFiles()}>{(entry, index) => {
                    const isReviewed = () => reviewed().has(entry.file.file)
                    const background = () => isReviewed() ? theme.background.raised.high : theme.diff.background.context
                    const image = () => isDiffImageFile(entry.file.file)
                    return (
                      <box ref={(node: BoxRenderable) => {
                        patchNodes.set(entry.fileIndex, node)
                        onCleanup(() => patchNodes.delete(entry.fileIndex))
                      }}>
                        <Show when={index() > 0}><box height={1} backgroundColor={theme.background.base} /></Show>
                        <box backgroundColor={background()} marginLeft={inset()} marginRight={inset()}>
                          <box id={`diff-file-header-${entry.fileIndex}`} flexDirection="row" gap={1} flexShrink={0}
                            height={2} backgroundColor={background()} paddingLeft={compact() ? 2 : 1}
                            paddingRight={1} paddingBottom={1} onMouseDown={(event) => openFileMenu(entry.fileIndex, event)}>
                            <box flexGrow={1} minWidth={0}>
                              <FilePath value={entry.file.file} maxWidth={Math.max(1, patchWidth() - 16)}
                                fg={theme.text.muted} basenameFg={isReviewed() ? theme.text.muted : theme.text.base} />
                            </box>
                            <Show when={isReviewed()}><text fg={theme.text.muted}>✓</text></Show>
                            <Show when={!image()} fallback={<text fg={theme.text.muted}>Image</text>}>
                              <text fg={isReviewed() ? theme.text.muted : theme.diff.text.added}>+{entry.file.additions}</text>
                              <text fg={isReviewed() ? theme.text.muted : theme.diff.text.removed}>-{entry.file.deletions}</text>
                            </Show>
                          </box>
                          <Show when={!isReviewed()}>
                            <Switch fallback={
                              <box paddingLeft={compact() ? 2 : 1} paddingRight={1} paddingBottom={1}>
                                <text fg={theme.text.muted}>
                                  {mode() === "committed" && image()
                                    ? "Committed image preview unavailable. The working-tree image is not shown."
                                    : entry.file.status === "deleted" && image()
                                      ? "Deleted image. The previous revision is not available for preview."
                                      : "No patch available for this file."}
                                </text>
                              </box>
                            }>
                              <Match when={mode() !== "committed" && entry.file.status !== "deleted" && image() && props.provider.loadImage}>
                                {(load) => <DiffViewerImage file={entry.file.file} load={load()}
                                  onEnlarge={(bytes) => openDialog({ type: "image", file: entry.file.file, bytes })} />}
                              </Match>
                              <Match when={!(mode() === "committed" && image()) && entry.file.patch}>
                                {(patch) => <PatchDiff ref={(component) => {
                                  patchDiffs.set(entry.fileIndex, component)
                                  onCleanup(() => patchDiffs.delete(entry.fileIndex))
                                }} diff={patch()} scroll={() => scroll} hunkFg={theme.diff.text.hunkHeader}
                                  view={entry.file.status === "modified" ? view() : "unified"}
                                  filetype={filetype(entry.file.file)} syntaxStyle={syntax} showLineNumbers
                                  gutterPadding={compact() ? 1 : 0} width="100%" wrapMode="char" fg={theme.text.base}
                                  addedBg={theme.diff.background.added} removedBg={theme.diff.background.removed}
                                  contextBg={theme.diff.background.context} addedSignColor={theme.diff.highlight.added}
                                  removedSignColor={theme.diff.highlight.removed} lineNumberFg={theme.diff.lineNumber.text}
                                  lineNumberBg={theme.diff.background.context}
                                  addedLineNumberBg={theme.diff.lineNumber.background.added}
                                  removedLineNumberBg={theme.diff.lineNumber.background.removed} />}
                              </Match>
                            </Switch>
                          </Show>
                        </box>
                      </box>
                    )
                  }}</For>
                </scrollbox>
              </box>
            </box>
          </Match>
        </Switch>
      </box>
      <Show when={compact() || !showTree()}>
        <box height={1} flexShrink={0} flexDirection="row" paddingLeft={2} paddingRight={1}>
          <text fg={theme.text.muted} flexGrow={1}>q close</text>{help}
        </box>
      </Show>
      <Show when={dialog()}>{(state) => <>
        <Show when={state().type === "source"}>
          <Picker title="Diff source" options={sourceOptions()} index={dialogIndex()}
            onSelect={(index) => setDialogIndex(index)} />
        </Show>
        <Show when={state().type === "base"}>
          <DialogFrame title="Base branch" width={72}>
            <input placeholder="Search local and remote branches" value={query()} onInput={(value) => {
              setQuery(value)
              setDialogIndex(0)
            }}
              ref={(element: InputRenderable) => queueMicrotask(() => element.focus())}
              focusedTextColor={theme.text.base} focusedBackgroundColor={theme.background.raised.base}
              placeholderColor={theme.text.muted} cursorColor={theme.text.base} />
            <box height={1} />
            <Show when={!branches.loading} fallback={<text fg={theme.text.muted}>Loading branches…</text>}>
              <Show when={!branches.error} fallback={<text fg={theme.text.feedback.error.base}>Could not load branches</text>}>
              <Show when={(branches()?.length ?? 0) > 0} fallback={<text fg={theme.text.muted}>No branches found</text>}>
                <For each={branches()}>{(branch, index) => <PickerRow title={branch}
                  selected={dialogIndex() === index()} onMouseUp={() => setDialogIndex(index())} />}</For>
              </Show>
              </Show>
            </Show>
            <text fg={theme.text.muted}>enter select · esc close</text>
          </DialogFrame>
        </Show>
        <Show when={state().type === "help"}>
          <DialogFrame title="Diff shortcuts" width={68}>
            <For each={[
              ["j/k, ↓/↑", "Scroll"], ["PgUp/PgDn, ctrl+b/f", "Page"], ["ctrl+u/d", "Half page"],
              ["gg/G, Home/End", "Start/end"], ["[/]", "Previous/next hunk"], ["n/p", "Previous/next file"],
              ["b", "Toggle file tree"], ["s", "Single file"], ["v", "Split/unified"], ["d", "Diff source"],
              ["m", "Mark reviewed"], ["q/Esc", "Close"],
            ]}>{([key, label]) => <box flexDirection="row"><text width={24} fg={theme.text.base}>{key}</text>
              <text fg={theme.text.muted}>{label}</text></box>}</For>
          </DialogFrame>
        </Show>
        <Show when={state().type === "menu"}>
          <Picker title={files()[(state() as { fileIndex: number }).fileIndex]?.file ?? "File"}
            options={[{ title: reviewed().has(files()[(state() as { fileIndex: number }).fileIndex]?.file ?? "")
              ? "Mark incomplete" : "Mark complete", description: "Toggle reviewed state", select: () => {
                toggleReviewed((state() as { fileIndex: number }).fileIndex)
                closeDialog()
              } },
              { title: "Cancel", description: "Close menu", select: closeDialog }]}
            index={dialogIndex()} onSelect={setDialogIndex} />
        </Show>
        <Show when={state().type === "image" ? (state() as Extract<DialogState, { type: "image" }>) : undefined} keyed>
          {(image) => (
            <DialogFrame title={image.file} width={Math.min(dimensions().width - 4, 100)}>
              <box width="100%" height={Math.max(6, dimensions().height - 10)}>
                <image source={image.bytes} fit="fit" protocol="auto" width="100%" height="100%" />
              </box>
              <text fg={theme.text.muted}>esc close</text>
            </DialogFrame>
          )}
        </Show>
      </>}</Show>
    </box>
  )

  function CenteredText(props: { text: string; error?: boolean }) {
    return <box flexGrow={1} padding={2}><text fg={props.error
      ? theme.text.feedback.error.base : theme.text.muted}>{props.text}</text></box>
  }

  function Picker(props: {
    title: string
    options: readonly { title: string; description: string; select: () => void }[]
    index: number
    onSelect: (index: number) => void
  }) {
    return <DialogFrame title={props.title} width={68}><For each={props.options}>{(option, index) =>
      <PickerRow title={option.title.padEnd(13)} description={option.description}
        selected={props.index === index()} onMouseUp={() => {
          props.onSelect(index())
          option.select()
        }} />
    }</For><text fg={theme.text.muted}>enter select · esc close</text></DialogFrame>
  }

  function PickerRow(props: { title: string; description?: string; selected: boolean; onMouseUp: () => void }) {
    return <box flexDirection="row" backgroundColor={props.selected ? theme.background.action.primary.focused : undefined}
      onMouseUp={props.onMouseUp}><text fg={props.selected ? theme.text.action.primary.focused : theme.text.base}>
        {props.title}</text><Show when={props.description}><text fg={theme.text.muted}>{props.description}</text></Show></box>
  }

  function DialogFrame(props: { title: string; width: number; children: import("solid-js").JSX.Element }) {
    return <box position="absolute" left={0} top={0} width={dimensions().width} height={dimensions().height}
      zIndex={3000} alignItems="center" justifyContent="center" backgroundColor={theme.background.base}>
      <box width={Math.min(props.width, Math.max(20, dimensions().width - 4))} maxHeight={dimensions().height - 2}
        border borderColor={theme.border.base} backgroundColor={theme.background.raised.base}
        paddingLeft={2} paddingRight={2} paddingTop={1} paddingBottom={1} flexDirection="column" gap={1}>
        <text attributes={TextAttributes.BOLD} fg={theme.text.base}>{props.title}</text>{props.children}
      </box>
    </box>
  }
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error)
}
