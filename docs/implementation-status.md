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
| 16 | Integrate real Octane HMR, preserve component state | Pending; depends on stable reload baseline |
| 17 | Versioned local persistence and restore validation | Pending |
| 18 | Serializable projects and sharing transport | Pending |
| 19 | Expand validated example library | Hello World/counter complete; remaining examples pending |
| 20 | Broaden browser tests and production hardening | Initial Chromium suite complete; cross-browser/resource limits pending |

## Recommended next tickets

1. Versioned local persistence: add a separate serializer/store for files,
   active tab, and preview settings. Test corrupt records, schema migration,
   reload restoration, and explicit reset.
2. Investigate production Octane HMR contracts without modifying the compiler.
   Prove style-only and component updates, state retention, error recovery, and
   disposal before replacing the fresh-document baseline.

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
