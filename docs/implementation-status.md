# Implementation status

## Milestone 1 — Hello World vertical slice

Implemented on 2026-09-09. The initial milestone uses real `.btsx` source with
`beast-tsrx@0.2.60` → native TSRX → `octane@0.2.6` → browser ESM. No compiler
fork or simplified language implementation was introduced.

The user can open the editor, edit source, compile in a worker, render it, break
syntax, see an authored-source diagnostic, fix it, and see the preview recover.
The sample includes a second component with working state/events and CSS imports.

Acceptance evidence:

- `bun run check`: TypeScript/TSRX checks, unit and compiler fixtures, and Rsbuild
  production output.
- `bun run test:browser`: Chromium tests against the **production build**, covering
  initial rendering, state/events, styles, generated output, console, edits,
  diagnostic markers, last-good-preview preservation, recovery, newly added
  components, imports, runtime errors, reload, sandbox isolation, and mobile
  overflow.
- Desktop and mobile screenshots are generated under ignored `test-results/`.
- Production compiler packages and sibling repositories are unchanged.

## Phase tickets

Each next ticket should remain a small implementation with contracts, behavior
checks, and a changelog entry, as required by the master plan.

| Phase | Ticket / acceptance | Status |
| --- | --- | --- |
| 1 | Map compiler/runtime boundaries and browser compatibility | Complete: playground-architecture.md |
| 2 | Define serializable project/results/diagnostics | Complete for milestone |
| 3 | Deterministic virtual filesystem and resolver | Complete for supported file types |
| 4 | Adapt production Beast compiler and preserve authored maps | Complete for reachable modules |
| 5 | Adapt production Octane client compiler | Complete for DOM output |
| 6 | Worker protocol, revisions, cancellation, restart | Complete for milestone |
| 7 | Sandboxed preview protocol and error recovery | Complete for milestone |
| 8 | Native ESM/import-map loader with shared runtime | Complete for supported imports |
| 9 | Editor, explorer, tabs, highlighting, diagnostic markers | Complete for milestone; formatting/completions later |
| 10 | Debounce and stale-result protection | Complete |
| 11 | Compiler diagnostics and source navigation | Complete for compiler errors; full semantic checking later |
| 12 | Responsive presets, reload, preview states | Complete for milestone; zoom/fullscreen later |
| 13 | Bounded console capture and runtime failures | Complete for milestone |
| 14 | Compose multi-stage maps; map runtime stacks to editor | Complete for authored modules; raw fallback for unmappable frames |
| 15 | Record stage timings and measure transfer overhead | Baseline complete; incremental compilation later |
| 16 | Integrate real Octane HMR, preserve component state | Complete for component/style boundaries; reload fallback for unsupported changes |
| 17 | Versioned local persistence and restore validation | Complete for current project/editor/preview settings |
| 18 | Serializable projects and sharing transport | Complete for bounded snapshot links and reviewed imports |
| 19 | Expand validated example library | Hello World/counter complete; remaining examples pending |
| 20 | Broaden browser tests and production hardening | Initial Chromium suite complete; cross-browser/resource limits pending |

## Recommended next tickets

1. Expand the example library with validated projects for props, state, events,
   nested components, and async behavior.
2. Add preview zoom/fullscreen and continue cross-browser hardening.

These are follow-on tickets, not claims that the full master plan is complete.

## Final verification snapshot

- 17 Bun unit/fixture tests passed (103 assertions).
- 5 Chromium browser tests passed against the final production bundle.
- TSRX/TypeScript checks and Rsbuild production build passed.
- Removing generated runtime-only rewrite maps reduced the sample build's
  serialized transfer from 2,973,678 bytes to approximately 442,794 bytes (85%).
  Authored source maps remain intact. These are local sample measurements, not
  a latency guarantee; timings vary by hardware and compiler warm-up.

## Milestone 2 — Runtime source navigation and Vim

Implemented on 2026-09-09. Phase 14 now connects runtime Blob stack frames to
the existing composed source maps and opens the authored BTSX/TypeScript line.
Nested component event failures and rejected promises are covered. The first
mapped frame appears as a runtime diagnostic; console entries keep their
individual stack links. Missing/malformed maps and runtime frames stay raw.
Changed/deleted source disables old links rather than navigating to a wrong line.
Per-build manifests are validated against the host's compiled module records.

Added a VIM toggle in the editor footer using `@replit/codemirror-vim@6.4.0`.
Normal/insert/visual modes, motions, undo/redo, search, and `:w` are provided by
the extension. Mode switching preserves per-file documents and undo history;
the keymap preference survives reload. Project persistence remains separate.

Verification: 23 unit/fixture tests (137 assertions), eight Chromium browser
tests, TSRX/TypeScript checks, and production build passed. New browser coverage
proves mapped nested errors, authored line navigation, stale links, async errors,
Vim edits, undo/redo, file switching, `:w`, and preference restoration.

The production gzip total increased from approximately 734 KB to 776 KB, mainly
for the Vim extension and runtime map reader in the host. Compiler/preview module
payloads are unchanged; runtime tracing is performed only when an error arrives.

## Milestone 3 — Modular workspace and resizable panes

Implemented on 2026-09-10. `src/App.btsx` now composes focused shell and pane
components. Project file operations, session/compilation state, and layout state
have separate owners. CodeMirror and the preview connect through scoped adapters
and clean up with their component lifetime. See [project structure](project-structure.md)
for the component map and extension boundaries.

Added `@octanejs/resizable-panels@0.0.10` for Files, Editor, Preview, Output, and
a reserved AI chat pane. Dividers support pointer and keyboard resizing. Each
pane has collapse/expand controls; the toolbar stays available to restore hidden
views. Reset restores initial sizes, and narrow screens stack Editor and Preview.
AI chat starts closed and displays a future-phase placeholder when opened.

Collapsed content stays mounted, becomes inert, and leaves the accessibility
tree. Editor history, console/output selection, and the running preview survive
resizing and hiding. Source navigation restores a hidden editor. A CSS guard
keeps the nested iframe from capturing pointer drags across a parent separator.

The new-file form uses `@octanejs/tanstack-form@0.0.48`. Path normalization,
duplicate/extension validation, entry protection, and fallback file selection
are handled by the independent project model. UI validation and cancellation,
active-file deletion, and editor restoration have browser coverage.

Verification: 29 Bun tests (181 assertions), 12 Chromium browser tests,
TSRX/TypeScript checks, and the production build. The browser suite covers
pointer/keyboard resizing, expansion-size restoration, layout reset, collapse
focus management, preview state and undo preservation, responsive orientation,
file form validation, and all earlier compiler/runtime/Vim behavior.

This is a workspace-organization milestone. Durable project/layout persistence,
HMR, and AI service integration remain follow-on work.

## Workspace follow-up — Styling, panel URLs, and AI chat

The subsequent workspace implementation added charcoal/orange styling, URL-backed
panel sizes/collapse state through Nuqs, file search, and streaming chat with
Cohere, OpenRouter, and custom compatible providers. Chat supports optional active
file context, stop/retry, and independent provider/model preferences; credentials
and conversation history are not persisted. These existing features are included
in the current regression suite.

## Milestone 4 — Versioned local project persistence

Implemented on 2026-09-11. Phase 17 saves project files, active file, and preview
size independently of compiler/UI internals. All current files appear as tabs;
Vim uses its existing separate preference store. Saves debounce at 300 ms and
flush on page hide, hidden visibility, and disposal. Restore precedes the first
compilation, including projects with invalid source that still need editing.

Version 1 records validate source types, paths, normalized duplicates, entry
existence, and bounds (200 files / 2 million serialized UTF-16 characters).
Unversioned raw project snapshots migrate into the versioned format. Stale
selection and preview settings fall back without losing source. Corrupt or
unsupported records remain unchanged until reset; storage failures and detected
competing-tab saves produce visible notices instead of discarding saved work.

Reset asks before replacing the project with Hello World, saves immediately,
invalidates pending builds, clears runtime/diagnostic state, and discards all
cached editor documents and undo history. Keymap/provider preferences and panel
URLs stay independent. Runtime state and undo history remain session-only.

Verification: 50 Bun unit/fixture tests, 23 Chromium browser tests against the
production build, TSRX/TypeScript checks, and Rsbuild production build passed.
New coverage proves source/addition/deletion restoration, active tab and viewport
restoration, immediate reload flushing, invalid-source recovery, reset cancellation,
editor cache invalidation, corrupt/unsupported records, quota failures, migration,
and competing-tab conflict detection. Desktop/mobile screenshots were reviewed.
The chat regression test now waits for the native settings dialog to open before
sending Escape, removing a reload timing race.

## Milestone 5 — Octane HMR and light theme

Implemented on 2026-09-11. The existing production compiler emits its Vite HMR
contract; the preview provides persistent hot data and module loading while
Octane handles component wrapper identity, hook retention, and effect cleanup.
Consecutive compatible component updates and CSS-only changes retain the running
document. Compiler errors retain the previous app. Entry/helper/import/export
changes, unaccepted boundaries, invalidations, and runtime failures use the
document-reload baseline. Explicit reload always restarts the app.

The runtime retains the changed component's own compatible hook state; parent
updates may remount descendants. Source maps track each old/new evaluation URL.
The next build after 40 component-update batches reloads to bound module retention.
Full-graph compilation remains in place. See [HMR integration](playground-hmr.md).

The sun/moon toolbar control switches between charcoal and a warm light palette,
with editor syntax, forms, chat, output, and preview defaults following the theme.
The preference applies before paint and survives reload and project reset.
Theme changes preserve documents, undo/Vim, and the preview realm. Authored CSS
remains authoritative; the starter project's colors follow the inherited scheme.

Verification: 53 Bun unit/fixture tests, 28 Chromium browser tests, TSRX/TypeScript
checks, and the production build passed. Desktop, mobile, and settings-dialog
screenshots were reviewed. No production compiler package or runtime source was
modified.

## Milestone 6 — Shareable projects and viewport containment

Implemented on 2026-09-11. Phase 18 wraps the validated workspace serializer in
a versioned gzip/base64url transport carried by the URL fragment. Share captures
files, the active tab, and preview size. It omits chat, connection credentials,
personal preferences, and generated code. The UI supports clipboard copying
and a manual-copy fallback. No project server or upload endpoint is needed.

Incoming links open a review dialog with expandable source files. Only an explicit
**Replace project** imports and immediately saves the snapshot; cancel, Escape,
bad links, and unsupported versions leave the current project unchanged. Import
invalidates cached editor documents, undo history, pending builds, and the old
preview realm. Transport limits cap both encoded input and streamed decompression.

The shell now fits the current viewport instead of forcing 640px desktop or
1,120–1,580px mobile minimum heights. Pane surfaces contain positioned descendants,
fixing a collapsed chat label that extended the document 11px beyond the screen.
Scrolling remains inside panes, compact chat controls adapt to short panels, and
layout reset uses the current responsive breakpoint. The project heading shares
the top bar, and collapsed panels hide their resize handles without interfering
with the remaining dividers' hit testing.

Verification: 58 Bun unit/fixture tests, 32 Chromium browser tests, TSRX/TypeScript
checks, and the production build passed. Coverage includes Unicode link round trips,
size/encoding/version validation, decompression bounds, atomic imports, save/undo
restoration, cancellation, clipboard success/failure, and both viewport dimensions
through chat collapse/restore/reset at 320, 390, 1024, and 1440px widths. Desktop,
mobile, import-review, and light-theme share screenshots were reviewed.
