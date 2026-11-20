# Architecture

## Data flow

```text
CLI arguments / stdin
  → GitProvider or PatchProvider
  → DiffFile[]
  → DiffViewer controller
  → OpenTUI + Solid renderables
```

Both providers implement the small `DiffProvider` interface in `src/model.ts`.
The viewer does not import Git, filesystem, HTTP, OpenCode client, or session
code. A result contains only file paths, unified patches, change counts, status,
and display metadata.

`GitProvider` executes the system Git binary with `Bun.spawn`. `branch` compares
the merge base with the working copy, `committed` compares it with `HEAD`, and
`working` compares `HEAD` with the working copy. Working comparisons also add
untracked files. Binary untracked files receive a placeholder rather than being
decoded as text.

`PatchProvider` splits Git and generic unified patches into the same model. It
can read a file or stdin. For piped input, the CLI opens the controlling TTY for
keyboard input after consuming the patch.

## Viewer boundary

The upstream plugin context is intentionally absent. `DiffViewer` owns local
signals for source, base, selection, reviewed files, layout, and dialogs. It uses
OpenTUI keyboard handling directly. There is no router, panel host, plugin
registry, background service, updater, or persistent OpenCode configuration.

`PatchDiff` retains the upstream multi-hunk rendering and large-addition
virtualization. Files over 3000 added lines are split into 128-line chunks;
only the visible chunks and one chunk on either side are mounted. Highlighting
runs against the whole file before highlights are sliced into chunks.

## Themes

`src/ui/themes/index.ts` registers all 34 bundled OpenCode palettes: the two v2
documents and 32 v1 presets. V1 sources are migrated with `migrateV1`; v2
sources are parsed with `parseThemeDocument`. Documents and resolved palettes
are cached lazily per `name` and mode. Themes that only provide one mode fall
back to it, and the footer shows the effective mode.

`ThemeProvider` keeps the active name and mode in signals. It exposes the
resolved palette through `createComponentTheme`, whose getters read the active
selection, so components can keep `const theme = useTheme()` and still repaint
when the theme changes. `useSyntax()` returns an accessor because replacing the
palette regenerates the OpenTUI `SyntaxStyle`; the previous style is destroyed
after the renderer goes idle.

`t` and `T` cycle palettes in `THEME_ORDER`, preserving the requested mode.
Switching does not remount the viewer, so reviewed state, scroll position, and
layout survive. The footer always shows the active theme; `--theme` and
`--mode` select the initial values, and `--list-themes` prints the names.

Image files in working comparisons render a working-tree thumbnail through the
provider's `loadImage`; clicking it opens a local enlarge dialog. Committed
comparisons never show the working-tree image, and deleted images have no
previous-revision preview.

## Lifecycle

`src/ui/app.tsx` owns the OpenTUI renderer. Closing the viewer destroys the
renderer and restores the terminal. A non-interactive stdout is rejected. Patch
input may use a non-TTY stdin, but the process must be able to open `/dev/tty`
(or `CONIN$` on Windows) for interactive keys.

## Testing

- `test/patch.test.ts`: patch parsing, counts, paths, hunks, and chunking
- `test/git.test.ts`: real temporary Git repositories and source semantics
- `test/file-tree.test.ts`: pure tree and navigation algorithms
- `test/cli.test.ts`: argument validation
- `test/viewer.test.tsx`: real OpenTUI frames, layouts, review, errors, and
  large-file mount counts
- `test/viewer-source.test.tsx`: source/base keyboard workflows
- `test/themes.test.ts`: theme resolution, mode fallback, labels, and cycling
- `test/theme-switch.test.tsx`: real frames, syntax replacement, footer labels,
  reviewed-state retention, and base-search input isolation
- `test/image.test.tsx`, `test/viewer-image.test.tsx`: image decode, abort,
  error recovery, and the committed-image constraint

Run checks from the project root with `bun run check`.
