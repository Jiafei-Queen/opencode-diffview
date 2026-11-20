# OpenCode upstream

This project extracts the terminal Diff Viewer from
[`anomalyco/opencode`](https://github.com/anomalyco/opencode), revision `d432a06`.
It does not use the browser-side Pierre renderer or require an OpenCode server.

## Extracted modules

- `packages/tui/src/component/patch-diff.tsx` → `src/ui/patch-diff.tsx`
- `packages/tui/src/util/diff.ts` → `src/util/diff.ts`
- `packages/tui/src/util/filetype.ts` → `src/util/filetype.ts`
- `packages/tui/src/feature-plugins/system/diff-viewer-file-tree-utils.ts` →
  `src/ui/file-tree.ts`
- `packages/tui/src/feature-plugins/system/diff-viewer-file-tree.tsx` →
  `src/ui/file-tree-view.tsx`
- `packages/tui/src/ui/file-path.tsx` → `src/ui/file-path.tsx`
- `packages/tui/src/feature-plugins/system/diff-viewer-image.tsx` →
  `src/ui/image.tsx` (the shared OpenCode image dialog is replaced by a local
  viewer dialog)
- `packages/tui/test/fixture/diff-image.ts` → `test/diff-image.ts`
- `packages/tui/src/theme/color.ts` → `src/ui/color.ts`
- `packages/tui/src/theme/assets/v2/opencode2.json` → `src/ui/opencode2.json`

The plugin, route, panel, session and OpenCode client layers are intentionally
replaced by a standalone CLI and local diff providers. The viewer context is
reduced to theme, renderer and keyboard handling. Reviewed state remains local
to the process.

When syncing upstream fixes, compare these files individually and preserve the
standalone provider boundary. Record the new source revision and behavior
changes here.
