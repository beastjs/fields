# Playground architecture

Discovery completed on 2026-09-09, before implementation.

This document records the initial discovery. For the current component tree,
state ownership, and resizable workspace, see [project structure](project-structure.md).
Completed milestones are tracked in [implementation status](implementation-status.md).

## Current pipeline and entry points

This repository is a Beast application starter, with no playground or tests yet.
`src/main.ts` mounts `src/App.btsx` through `octane.createRoot`.
`rsbuild.config.ts` uses the existing `beastOctane()` Rsbuild integration.
The baseline `bun run check` passes (typecheck and production build).

Installed, locked compilers:

- `beast-tsrx@0.2.60`: `compileBeastResult(source, { filename })` parses BTSX,
  generates native TSRX, and returns code, AST, source map, and diagnostics.
- `octane@0.2.6`: `compile(source, filename, { mode: 'client', hmr: false })`
  parses TSRX and emits browser ESM, source maps, and diagnostics.
- `@tsrx/core@0.1.69`: shared parser/transforms. Octane selects its Acorn browser
  parser through the `#octane/compiler-parser` package import condition.

Actual language files are `.btsx` and `.tsrx`. The master plan's `.beast` suffix
and JSX-like sample are conceptual, not accepted syntax for this compiler.
The initial example must use `h1 Hello World` in `App.btsx`.

## AST boundaries and diagnostics

Beast owns its parser/AST and generates TSRX text; Octane owns its separate AST.
The playground passes source and maps between them and never edits either AST.
Beast failures throw `BeastCompileError` with a structured `diagnostic` and
one-based span positions. Octane returns diagnostics or throws parse errors;
its source columns are zero-based. Normalize editor coordinates to one-based
and map Octane positions back through Beast's map.

## Runtime and build artifacts

`octane` and `octane/internal/client` export the actual DOM runtime and compiler
helpers. The current host is bundled by Rsbuild/Rspack, with Tailwind v4.
Package entry points also expose signals, hydration, and profiling modules.
The playground will prebundle supported runtime entries with esbuild, ESM code
splitting, and shared chunks so all entries use one runtime instance. Generated
runtime source becomes worker input, not a separately invented runtime.

## Module resolution and reusable infrastructure

Beast's project API walks the Node filesystem and cannot consume virtual files.
Its package root reexports that API, pulling in Node filesystem imports.
The installed `dist/compiler.js` is the same compiler called by production
adapters; it only needs `node:path` for component names. A narrowly scoped
browser build alias can select this module and supply `path-browserify` without
modifying or copying production compiler code. Pin Beast and document this
packaging workaround until an upstream browser/compiler export is available.

Octane's public `octane/compiler` entry is browser compatible. Its bundler API
imports Node filesystem/module/path APIs and is unsuitable inside a worker.
We can consume the production compiler output as ESM without its Node bundler.
Use `es-module-lexer` to locate imports, resolve against the virtual filesystem,
and rewrite only import specifiers to canonical bare IDs. This supports cycles
through native ESM/import maps, unlike recursive Blob URL substitution.
Unsupported dependencies and nonliteral dynamic imports need diagnostics.

## Worker and preview integration

No worker, preview, diagnostics UI, or HMR consumer exists here yet. Define
serializable compiler contracts first, then an in-memory VFS, stage adapters,
and a versioned worker protocol. Terminate obsolete synchronous compiler work
when necessary; request IDs and edit revisions must reject stale responses.

The preview uses an opaque-origin iframe with `sandbox="allow-scripts"`.
A static bootstrap receives a build over `postMessage`, creates Blob modules
and an import map, and imports the generated entry. Check `event.source`,
protocol, channel token, build ID, and message shape. Restrict network and
privileged APIs through sandbox/CSP. Capture console and runtime failures.
Keep the last successful preview visible during compiler errors.

Initial milestone: rebuild the iframe document after successful compilation,
with a fresh module graph and teardown of the previous realm. State-preserving
HMR is a later phase, after this correctness baseline. Arbitrary npm packages,
remote imports, persistence, and sharing are also deferred.

## Source maps and observability

Preserve Beast → TSRX and compose Octane → JS maps back to authored BTSX with
`@jridgewell/remapping`. Keep generated TSRX/JS inspectable and include source
maps on executable modules. Import-specifier rewriting needs its own map.
Use `magic-string` to preserve mappings through that final rewrite. Runtime
stack-to-editor navigation can build on these maps later; do not claim that
raw browser stacks already map automatically to BTSX.

Report per-stage and total timing, structured compiler diagnostics, and preview
runtime errors separately. Editor state and undo history must survive builds.

## Test infrastructure and acceptance

The baseline has no tests. Add Bun unit/fixture tests for normalization,
resolution, missing imports, compiler stages, source mapping, and stale results.
The sibling `/Users/xpriori/Code/beast/tests` supplies reference fixtures and
production compiler tests; production compiler source will remain unchanged.
Add a browser smoke test for worker → compiler → iframe, edits, compile errors,
recovery, multi-file imports, runtime errors, and preview isolation. Run
`bun run check` plus the new tests before declaring the slice complete.
