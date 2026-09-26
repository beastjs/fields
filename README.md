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
Preview and initially collapse Files. The shell fits the viewport at every size;
editor, preview, output, and chat scroll inside their own panes. Hidden panes
also hide their resize handles.

The preview toolbar offers desktop/tablet/mobile widths, **50–150% zoom**, and
**fullscreen**. Zoom scales the view while keeping the selected CSS viewport width;
wide views scroll inside the pane with their left edge reachable. Fullscreen keeps
the running app and zoom, and exits through its toolbar button or the browser's
Escape control. Unsupported browsers disable the button; denied requests show a
message. Zoom and fullscreen are session-only view controls, excluded from shares.

Open **Examples** in the top bar to browse eight self-contained projects: Hello
World/counter, props/components, state/events, nested components, async
loading/recovery, reducer undo/redo, nested context providers, and effect cleanup. Inspect their source before choosing **Load example**; loading
replaces the current files, saved copy, undo history, and running preview. Cancel
or Escape keeps your work. Save a Share link first if you want to return to it.
The async example uses a local simulated request and works without network access.

Open **Design Studio** in the top bar to compose a page from 40 ready-made
sections across 14 kinds: topbar, hero, partners marquee, stats, features, guides,
products, testimonials, pricing, FAQ, team, call to action, newsletter, and footer.
Start from a recipe or pick sections one by one, drag them into order, and swap
designs while a live preview follows along at desktop, tablet, or mobile width.
Nothing changes until **Add page to project**, which writes each section to
`src/sections/`, composes them in `src/Page.btsx`, and renders the page from
`App.btsx` (replacing the untouched starter). Sections are monochrome and follow
the surrounding theme. Reopen the studio to update the page; sections you edited
by hand are kept, and the studio warns before replacing edits.

Open **Design Studio → Fullstack → Form Supply** for a complete store example.
Explore 36 illustrated products across six collections, search and filter, inspect
product details, and try the persistent guest bag and server-calculated demo checkout.
**Use this app** loads editable Beast frontend and Convex backend files after a
replacement confirmation. Recipes remain a separate catalog. Checkout records only
a simulated order; it takes no payment or personal details.

**Design Studio → Fullstack → Margin Notes** adds an independent bookshop inspired
by Money in Check: 24 fictional books, original covers and reading samples, search,
category/price filters, a persistent reading shelf, and a guest bag with demo checkout.
Its backend and tables are separate from Form Supply. After deploying the backend,
run `bunx convex run marginDemo:seed` on the intended deployment to populate it.
The exported project includes its own backend and setup README.

The example uses `PUBLIC_CONVEX_URL`. Seed its deployment with
`bunx convex run storeDemo:seed` after deploying the functions. Both the local
preview and generated `public/preview.html` allow only that deployment's query
and mutation endpoints. Rebuild the hosted preview when changing deployments.
The example's included README explains running it with its own backend.

Use **Share** to create and copy a snapshot link. It includes project files, the
active tab, and preview size; chat, connection credentials, and personal settings
are excluded. The project travels in a compressed URL fragment without a project
server. Anyone with the link can read its files. A recipient can inspect the files
and choose **Replace project**, or keep their existing work. Opening a link alone
does not replace the saved project or execute its code. Later edits require a new
share link.

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

For file recommendations, leave **Include active file** enabled and ask for a
change. Complete replacement recommendations offer **Apply & verify** with the
target filename. The playground compiles the proposed project in a separate
worker before updating the file, reports errors in chat, and preserves the current
source on failure or stale context. Successful edits refresh the preview, autosave,
and can be undone in the editor. This checks compilation, not runtime correctness.

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
bunx playwright install chromium firefox webkit
bun run test:browser            # Full Chromium, Firefox, and WebKit suites
bun run test:browser --project=chromium # Chromium only
bun run probe:isolation          # Bounded CPU-isolation experiment; fresh browsers
```

Runtime source is generated from installed packages before builds/tests and is
ignored by Git. The browser build selects Beast's installed compiler module
with a narrow alias because its root export also includes Node filesystem APIs.
No production compiler source is copied or modified. Keep the pinned Beast
version until its browser export contract is available upstream.

## Optional hosted preview

The default preview runs locally. Set `PLAYGROUND_PREVIEW_URL` at build time to
add an explicit Hosted preview option. The build emits a standalone
`dist/preview.html` for a trusted separate site. Source stays in the editor;
builds transfer to the iframe after a versioned handshake. Startup failures offer
reload or deliberate local fallback, and isolation remains browser-dependent.
See [configuration, deployment, and tests](docs/hosted-preview.md).

## Milestone limits

Projects are saved in localStorage on the current browser origin, with a limit
of 200 files and 2 million serialized UTF-16 characters. Clearing site data removes
the saved project. Failed writes retain the previous save; corrupt or unsupported
records are preserved until explicitly reset or replaced by an imported project. A detected save from another tab
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

Share payloads are limited to 64,000 URL characters and 2,000,000 decoded UTF-8
bytes, alongside the existing project limits. Large projects may not fit a link;
some messaging services also truncate long links. Server-hosted short links,
arbitrary npm dependencies, full TypeScript semantic
checking, and formatting remain future work.
Source maps are available to browser tooling and console navigation. Frames with
missing maps or unsupported stack formats remain raw. Import attributes/phases
and computed dynamic imports are not supported. Preview network access is restricted to the configured `PUBLIC_CONVEX_URL` query and mutation endpoints. With no deployment configured, network access is blocked. Remote scripts remain blocked.

Compilation rejects projects exceeding 200 files or 2 million source/path UTF-16
characters before worker transfer and parsing. Oversized edits retain the last
working preview; reducing the project allows compilation again. This is separate
from the serialized local-save and share limits. Hung compiler workers terminate
after 15 seconds and can restart on the next Run.

Preview console forwarding allows 100 messages per second across all levels,
with one suppression notice per window. Object summaries cap depth, entries, and
string length and skip property getters; later logs resume automatically.
The host retains the latest 200 entries. The sandbox blocks parent DOM/storage
access but cannot enforce CPU or memory quotas on arbitrary preview JavaScript;
infinite loops, custom proxy traps, and excessive allocation remain limitations.
The [resource isolation evaluation](docs/preview-resource-isolation.md) records
browser measurements and the proposed separate-site preview transport. It does
not add production CPU or memory quotas.

The complete browser suite runs against production output in Chromium, Firefox,
and WebKit, including editor/Vim, layout, persistence, chat, examples, HMR,
sharing, preview controls, and console burst recovery.

See [architecture discovery](docs/playground-architecture.md),
[component structure and state ownership](docs/project-structure.md),
[HMR integration and limits](docs/playground-hmr.md),
[API contracts](docs/playground-api.md), and
[implementation status and tickets](docs/implementation-status.md).
