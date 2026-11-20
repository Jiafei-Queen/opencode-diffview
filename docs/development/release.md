# Build and release

## JavaScript bundle

```sh
bun install --os="*" --cpu="*" --libc="*"
bun run build
```

The OpenTUI platform packages must be installed before bundling. The output is
`dist/index.js`; `bin/diffview.js` runs it with Bun.

## Standalone executable

Build for the current platform:

```sh
bun run build -- --compile
```

Or select a Bun compile target:

```sh
bun run build -- --compile --target darwin-arm64
bun run build -- --compile --target linux-x64
bun run build -- --compile --target windows-x64
```

A selected target is written to `dist/<target>/`. The current-platform build is
written directly to `dist/`. Compiled binaries disable Bunfig, dotenv, tsconfig,
and package-json autoloading so development preloads are not required on user
machines.

Every release target should pass `--help`, `--version`, and a real renderer
smoke test. Help alone does not validate native OpenTUI and Tree-sitter assets.
On macOS, a local pseudo-TTY smoke test is:

```sh
(sleep 2; printf 'q') | script -q /dev/null ./dist/diffview --patch test/fixture.diff
```

## npm distribution

```sh
bun run pack
```

`script/pack.ts` collects every compiled binary in `dist/` (host build in
`dist/`, cross builds in `dist/<target>/`) and produces tarballs in `dist/npm`:

- `diffview-<target>`: one package per platform, restricted by `os`/`cpu`/`libc`
- `diffview`: a wrapper whose `optionalDependencies` pull in the matching
  platform package; its Node launcher execs the binary with inherited stdio

Verify the install chain locally without publishing:

```sh
tmp=$(mktemp -d) && cd "$tmp"
npm install /path/to/dist/npm/diffview-0.1.0.tgz /path/to/dist/npm/diffview-darwin-arm64-0.1.0.tgz
./node_modules/.bin/diffview --version
```

Publish platform packages before the wrapper. Signing, notarization,
checksums, and npm provenance remain release-infrastructure work; no packages
are published by the local build scripts. Do not substitute a Node SEA build
without also implementing OpenTUI native asset extraction.
