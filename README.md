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

Enable **VIM** in the editor footer for modal editing. Use `i` to insert, `Esc`
for normal mode, `v` for visual selection, `u` to undo, and `:w` to run the
project. The mode indicator appears below the editor. The toggle preserves
file contents and undo history and remembers your preference on this browser.

Use the **sun/moon button** in the top bar to switch between dark and light mode.
The theme is remembered before the next page paints. Editor, panels, chat, and
preview defaults follow it without recompiling or resetting the running app.
Explicit colors/color-scheme in your project CSS remain authoritative; the
starter example follows the selected theme.

Drag the dividers to resize **Files**, **Editor**, **Preview**, and **Output**.
Use a pane's **−** button to collapse it and its toolbar button to reopen it.
Focus a divider for arrow-key resizing; **Reset layout** restores the default
sizes. Collapsing preserves editor history and the running preview. Pane sizes
and collapsed views are recorded in the URL. Narrow screens stack Editor and
Preview and initially collapse Files.

Project files, the active tab, and the preview size save automatically in this
browser after 300 ms. Reload restores the project before compiling it, including
unfinished source with compiler errors. All files remain available as tabs.
**Saved locally** confirms a successful write; a visible notice explains any
storage or restore failure. **Reset project** asks before replacing files and the
saved copy with Hello World. It clears editor history and the running preview,
while retaining the Vim preference, panel layout, and chat settings.

**AI chat** supports Cohere, OpenRouter, and a custom compatible endpoint, with
optional active-file context and stop/retry controls. Provider/model settings
are remembered; keys and conversations are not saved in browser storage.

Runtime errors appear in the console with clickable source locations. Click a
frame such as `Counter.btsx:3:5` to open the authored file and highlight the line.
Frames from changed or deleted files are marked **source changed** and cannot
navigate into a different version of the code.

The actual Beast syntax is indentation-based BTSX, not the illustrative `.beast`
syntax in the master plan:

```btsx
h1 Hello World
```

## Working now

- CodeMirror editor with file tabs, independent undo history, highlighting,
  search, line numbers, and compiler markers.
- Optional Vim keybindings, a mode indicator, and a remembered editor preference.
- Modular BTSX pane components with resizable, collapsible workspace views.
- Versioned local project persistence, restoration, save status, and explicit reset.
- Remembered light/dark themes with readable editor syntax and preview defaults.
- Native Octane HMR for component and stylesheet updates, with reload fallback.
- URL-backed panel layout and configurable streaming AI chat.
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
- Runtime stack mapping and navigation to authored BTSX/TSRX/TypeScript/JavaScript,
  with raw fallbacks for runtime or unmappable frames.

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

Projects are saved in localStorage on the current browser origin, with a limit
of 200 files and 2 million serialized UTF-16 characters. Clearing site data removes
the saved project. Failed writes retain the previous save; corrupt or unsupported
records are preserved until explicitly reset. A detected save from another tab
pauses this tab's writes rather than overwriting it. Copy any unsaved edits before
reloading to restore that tab's saved version. Undo history and preview application
state do not survive a page reload; preview size and Vim preference do.

Component-only BTSX/TSRX edits use Octane's own HMR to preserve that component's
hook state. CSS edits replace the existing stylesheet. **Live · HMR** identifies
a hot update. Parent component updates may remount descendants, as defined by
Octane's runtime. Changes to project imports, mixed exports, entry/helper modules,
or unsupported boundaries use a full reload. Runtime failures recover with a
fresh document on the next successful build. **Reload preview** always restarts
the app; after 40 component-update batches the next build also reloads to bound
the browser's retained module cache. Compilation still processes the full graph.

Sharing, arbitrary npm dependencies, full TypeScript semantic
checking, and formatting remain future work.
Source maps are available to browser tooling and console navigation. Frames with
missing maps or unsupported stack formats remain raw. Import attributes/phases
and computed dynamic imports are not supported. Preview code has no network
access under the initial CSP.

The sandbox blocks parent DOM/storage access; it is not a resource quota for
infinite loops or excessive memory allocation. Browser smoke tests currently
cover Chromium; cross-browser verification is a production-hardening task.

See [architecture discovery](docs/playground-architecture.md),
[component structure and state ownership](docs/project-structure.md),
[HMR integration and limits](docs/playground-hmr.md),
[API contracts](docs/playground-api.md), and
[implementation status and tickets](docs/implementation-status.md).
