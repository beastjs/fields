# Beast Playground

A browser IDE that runs the **actual Beast → Octane → Web pipeline** in a worker.
The initial Hello World vertical slice from [MASTER_PLAN.md](MASTER_PLAN.md) is
implemented. The host also uses Beast, Octane, Rsbuild, and Tailwind.

## Run locally

```sh
bun install
bun run dev
```

Open the URL printed by Rsbuild. Edit `App.btsx` or `Counter.btsx`; compilation
starts automatically after 220 ms. Use **Run project**, **⌘/Ctrl + Enter**, or
**⌘/Ctrl + S** to compile immediately.

The actual Beast syntax is indentation-based BTSX, not the illustrative `.beast`
syntax in the master plan:

```btsx
h1 Hello World
```

## Working now

- CodeMirror editor with file tabs, independent undo history, highlighting,
  search, line numbers, and compiler markers.
- Virtual files, relative imports, extension/index resolution, reexports,
  module cycles, and literal dynamic imports.
- Actual `beast-tsrx@0.2.60` and `octane@0.2.6` compiler stages, off the UI thread.
- Debouncing, cancellation by terminating busy workers, request/revision checks,
  timeout handling, and worker recovery on the next run.
- Native browser ESM/import maps and the installed Octane runtime, bundled with
  shared chunks so imported runtime entry points share one instance.
- Isolated preview, counter events, CSS imports, responsive preview presets,
  reload, console capture, and visible runtime errors.
- Structured diagnostics with navigation to authored source; last successful
  preview remains visible during compile errors.
- Inspectable generated TSRX/JavaScript and stage timings.
- Composed Beast → Octane → JavaScript source maps for authored modules.

Supported virtual files: `.btsx`, `.tsrx`, `.ts`, `.js`, `.json`, and `.css`.
Supported runtime imports are declared in `scripts/prepare-runtime.mjs`.
Unreachable files are not compiled; import a component from the entry graph to
render or validate it.

## Verify

```sh
bun run check                  # Type checks, unit/fixture tests, production build
bunx playwright install chromium
bun run test:browser            # Production browser integration tests
```

Runtime source is generated from installed packages before builds/tests and is
ignored by Git. The browser build selects Beast's installed compiler module
with a narrow alias because its root export also includes Node filesystem APIs.
No production compiler source is copied or modified. Keep the pinned Beast
version until its browser export contract is available upstream.

## Milestone limits

Files live in memory and reset when the host page reloads. Successful builds
start a fresh iframe document and reset application state. Persistence, sharing,
state-preserving HMR, arbitrary npm dependencies, full TypeScript semantic
checking, formatting, and runtime stack-to-editor navigation remain future work.
Source maps are available to browser tooling; the console currently shows raw
runtime stacks. Import attributes/phases and computed dynamic imports are not
supported. Preview code has no network access under the initial CSP.

The sandbox blocks parent DOM/storage access; it is not a resource quota for
infinite loops or excessive memory allocation. Browser smoke tests currently
cover Chromium; cross-browser verification is a production-hardening task.

See [architecture discovery](docs/playground-architecture.md),
[API contracts](docs/playground-api.md), and
[implementation status and tickets](docs/implementation-status.md).
