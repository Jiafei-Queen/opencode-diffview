# opencode-diffview

> **Unofficial project.** This is a community project, not an official OpenCode
> product. It is not affiliated with, endorsed by, or maintained by OpenCode or
> its authors. The "OpenCode" name is used only to describe the origin of the
> adapted Diff Viewer code and theme assets. See [NOTICE](NOTICE) for upstream
> attribution.

A standalone terminal Diff Viewer extracted from OpenCode's TUI. It renders local
Git comparisons and unified patches with OpenTUI, Solid, and Tree-sitter syntax
highlighting. It does not start or require an OpenCode server.

The command is `ocdiff`; the project is named after the OpenCode Diff Viewer it
was extracted from.

## Features

- File tree, addition/deletion counts, and reviewed markers
- Split and unified layouts with narrow-terminal fallback
- File and hunk navigation, paging, and single-file mode
- Branch, committed, and working-tree comparisons
- Unified diff files and stdin input
- Working-tree image previews with click-to-enlarge
- Large added-file virtualization
- All 34 bundled OpenCode color themes with runtime `t` / `T` switching
- Dark and light modes

## Install from source

Bun 1.4 or later and Git are required for development. Git is only needed at
runtime for repository comparisons, not for patch-file input.

```sh
bun install
bun run build -- --compile
./dist/ocdiff --help
```

## Usage

```sh
# Branch commits and local changes relative to the detected base
ocdiff

# Select the comparison explicitly
ocdiff --base main --source committed

# Staged, unstaged, and untracked changes relative to HEAD
ocdiff --source working

# Read a patch file
ocdiff --patch changes.diff

# Pipe a patch; keyboard input is reconnecting to the controlling terminal
git diff HEAD | ocdiff -

# Start with a bundled theme and color mode
ocdiff --theme tokyonight --mode light

# Discover theme names
ocdiff --list-themes
```

Display options include `--theme <name>` (default `opencode2`),
`--mode dark|light`, `--view auto|split|unified`, `--no-tree`, and `--single`.

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
| `t` / `T` | Next/previous color theme |
| `m` | Mark file reviewed |
| `?` | Help |
| `q`, `Esc`, `Ctrl+C` | Close |

Reviewed state, source/base, and the active theme last only for the current
process. Image previews show the working tree only; committed and deleted images
are never substituted with working-tree content. OpenCode session-based “Last
turn” diffs are outside this tool's scope.

## npm packages

```sh
bun run build -- --compile            # host binary
bun run build -- --compile --target linux-x64   # optional cross targets
bun run pack                          # dist/npm/*.tgz
```

`pack` produces one package per compiled platform plus an `opencode-diffview`
wrapper whose optional dependencies select the right binary at install time and
expose the `ocdiff` command.

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
