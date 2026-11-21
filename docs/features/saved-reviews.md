# Saved reviews

`ocdiff` can freeze the current diff into a named, self-contained review
snapshot. Reopening a snapshot does not depend on the repository state, so a
review stays available after the branch moves or the working tree changes.

## Creating a review

Press `Ctrl+S` (or `S`) in the viewer. The naming dialog is prefilled with
`<repository> · <source> · <timestamp>`; enter a unique name to save. The
current `DiffFile[]` content, reviewed files, and origin metadata are written to
disk. Names are unique case-insensitively and limited to 80 characters.

After a review has been saved, toggling reviewed markers continues to update the
snapshot automatically. Progress writes only touch `meta.json`; the stored diff
never changes.

Chrome and other terminals may still reserve `Ctrl+S` for flow control. Raw mode
normally disables that, and `S` is available as a fallback.

## Opening and deleting

Press `r` to list saved reviews. The list shows the name, reviewed/total files,
size, and the last update time. `Enter` opens the selected review, `d` asks for
confirmation before deleting it, and `Esc` closes the list.

A saved review opens through a read-only `Saved` source. Diff source switching
is unavailable, image previews are limited to the stored patch placeholders, and
the viewer starts at the first file that has not been reviewed.

Opening a saved review and pressing `Ctrl+S` renames it and refreshes the
timestamp without duplicating the snapshot.

## CLI

```sh
ocdiff --list-saved
ocdiff --open "payments refactor"
```

`--open` accepts an exact name, an exact id, or a unique id prefix. It conflicts
with `--patch`, `--source`, and `--base` because the snapshot supplies those
values.

`--list-saved` prints tab-separated rows: name, update time, source, reviewed
count, and size.

## Storage

Snapshots live under the machine state directory:

```text
$OCDIFF_STATE_HOME/saved/<id>/            # when set, app root
$XDG_STATE_HOME/ocdiff/saved/<id>/        # otherwise
~/.local/state/ocdiff/saved/<id>/
  meta.json   # name, timestamps, origin, reviewed files, file summaries
  diff.json   # complete DiffFile list including patches
```

Directories are created with mode `0700` and files with `0600` because patches
can contain source code. Named reviews are user data: they are never pruned
automatically and are removed only through the list dialog or by deleting the
directory.
