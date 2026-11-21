# Configuration

`ocdiff` stores display defaults in a single JSON file:

```text
$OCDIFF_CONFIG_HOME/config.json          # when set
$XDG_CONFIG_HOME/ocdiff/config.json      # otherwise
~/.config/ocdiff/config.json             # fallback
```

```json
{
  "version": 1,
  "theme": "opencode2",
  "mode": "dark",
  "view": "auto",
  "tree": true,
  "single": false,
  "scroll": { "lines": 1, "wheel": 1 }
}
```

## Fields

| Field | Values | Default |
| --- | --- | --- |
| `theme` | any name from `--list-themes` | `opencode2` |
| `mode` | `dark`, `light` | `dark` |
| `view` | `auto`, `split`, `unified` | `auto` |
| `tree` | boolean | `true` |
| `single` | boolean | `false` |
| `scroll.lines` | integer 1–20 | `1` |
| `scroll.wheel` | number 0.25–5 | `1` |

Validation is per field: unknown or invalid values fall back to the default
without discarding the rest of the file. Scroll values are clamped to their
range. `version` is informational and written on every save.

## Precedence and writes

1. Explicit command-line flags.
2. The config file.
3. Built-in defaults.

Only interactive changes are written back: cycling themes with `t` / `T`,
toggling the tree with `b`, single-file mode with `s`, and the layout with `v`.
Command-line values such as `--theme`, `--mode`, `--view`, `--no-tree`,
`--single`, `--scroll-lines`, and `--scroll-wheel` apply to the current run only.
Scroll speed has no in-viewer control; set it in the file or with the flags.

`source`, `base`, and the working directory are deliberately not persisted;
silently reopening a different comparison would be surprising. `ocdiff` never
creates config files inside the repository.

`--no-save` disables config writes and every saved-review write while still
allowing configuration and saved reviews to be read.

## Failure handling

Missing files use defaults. A malformed file is treated as empty. If the file or
its directory cannot be written, `ocdiff` keeps running with in-memory settings
for the session; the viewer does not print errors over the TUI. Set
`OCDIFF_DEBUG=1` to include the stack trace when a fatal error is printed.
