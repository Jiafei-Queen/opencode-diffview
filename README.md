# diffview

A standalone terminal Diff Viewer extracted from OpenCode's TUI. It renders local
Git comparisons and unified patches with OpenTUI, Solid, and Tree-sitter syntax
highlighting. It does not start or require an OpenCode server.

## Features

- File tree, addition/deletion counts, and reviewed markers
- Split and unified layouts with narrow-terminal fallback
- File and hunk navigation, paging, and single-file mode
- Branch, committed, and working-tree comparisons
- Unified diff files and stdin input
- Working-tree image previews with click-to-enlarge
- Large added-file virtualization
- Dark and light themes

## Install from source

Bun 1.4 or later and Git are required for development. Git is only needed at
runtime for repository comparisons, not for patch-file input.

```sh
bun install
bun run build -- --compile
./dist/diffview --help
```

## Usage

```sh
# Branch commits and local changes relative to the detected base
diffview

# Select the comparison explicitly
diffview --base main --source committed

# Staged, unstaged, and untracked changes relative to HEAD
diffview --source working

# Read a patch file
diffview --patch changes.diff

# Pipe a patch; keyboard input is reconnecting to the controlling terminal
git diff HEAD | diffview -
```

Display options include `--view auto|split|unified`, `--no-tree`, `--single`, and
`--theme dark|light`.

## Keys

| Key | Action |
| --- | --- |
| `j` / `k`, arrows | Scroll |
| `PgUp` / `PgDn`, `Ctrl+B` / `Ctrl+F` | Page up/down |
| `Ctrl+U` / `Ctrl+D` | Half-page up/down |
| `gg` / `G`, `Home` / `End` | Start/end |
| `[` / `]` | Previous/next hunk |
| `n` / `p` | Previous/next file |
| `b` | Toggle file tree |
| `s` | Toggle single-file mode |
| `v` | Toggle split/unified view |
| `d` | Choose source or base |
| `m` | Mark file reviewed |
| `?` | Help |
| `q`, `Esc`, `Ctrl+C` | Close |

Reviewed state and source/base selections last only for the current process.
Image previews show the working tree only; committed and deleted images are
never substituted with working-tree content. OpenCode session-based “Last turn”
diffs are outside this tool's scope.

## npm packages

```sh
bun run build -- --compile            # host binary
bun run build -- --compile --target linux-x64   # optional cross targets
bun run pack                          # dist/npm/*.tgz
```

`pack` produces one package per compiled platform plus a `diffview` wrapper
whose optional dependencies select the right binary at install time.

## Development

```sh
bun run typecheck
bun test --timeout 30000
bun run build
```

See [the architecture guide](docs/development/architecture.md),
[build and release notes](docs/development/release.md), and
[upstream provenance](docs/development/upstream.md).

## License

MIT. This project includes adapted OpenCode source and theme assets; see
[NOTICE](NOTICE).
