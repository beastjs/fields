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
| 12 | Responsive presets, reload, preview states | Complete including zoom/fullscreen controls |
| 13 | Bounded console capture and runtime failures | Complete for milestone |
| 14 | Compose multi-stage maps; map runtime stacks to editor | Complete for authored modules; raw fallback for unmappable frames |
| 15 | Record stage timings and measure transfer overhead | Baseline complete; incremental compilation later |
| 16 | Integrate real Octane HMR, preserve component state | Complete for component/style boundaries; reload fallback for unsupported changes |
| 17 | Versioned local persistence and restore validation | Complete for current project/editor/preview settings |
| 18 | Serializable projects and sharing transport | Complete for bounded snapshot links and reviewed imports |
| 19 | Expand validated example library | Eight validated projects, including reducer history, context providers, and effect cleanup |
| 20 | Broaden browser tests and production hardening | Full Chromium/Firefox/WebKit matrix; compiler input bounds and console throttling; strict runtime CPU/memory isolation remains open |

## Recommended next tickets

1. Select and deploy a dedicated preview site, then verify responsiveness against that actual deployment; the opt-in transport and loopback prototype are implemented.
2. Improve editor assistance with formatting and completions against the supported compiler syntax.

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


## Milestone 7 — Validated example library

Implemented on 2026-09-11. The top-bar **Examples** picker offers five complete
virtual projects: Hello World/counter, typed props and reusable components,
state with input/keyboard/click events and keyed lists, nested component imports
with independent state, and async loading/failure/recovery. Async requests are
simulated locally, respecting the preview's network restrictions. Example source
and descriptions live in the typed catalog, outside UI components.

The dialog exposes descriptions and expandable source files before **Load example**
replaces the project through the existing session reset contract. Cancellation
and Escape preserve edits; loading clears stale editor history and preview state,
saves immediately, and survives reload. The desktop heading identifies unchanged
examples and displays “Your project” after edits. The picker stays available on
mobile while the longer project heading is hidden.

Compiler coverage validates every example and its complete import graph with the
installed Beast and Octane compilers. Browser coverage exercises props updates,
keyboard/click events, empty and deduplicated lists, independent nested state,
async failure and recovery, source review, cancellation, undo invalidation, and
mobile restoration. Advanced recipes remain a follow-on; the core example-library
ticket is complete.

Verification: 59 Bun unit/fixture tests, 34 Chromium browser tests against the
production build, TSRX/TypeScript checks, and production build passed. The mobile
source-review screenshot was inspected for layout and readable controls.


## Milestone 8 — Preview zoom, fullscreen, and browser coverage

Implemented on 2026-09-11. The preview toolbar supports 50%, 75%, 100%, 125%,
and 150% zoom. A measured, clipped canvas scales the same iframe, preserving its
CSS viewport width and running state. The rendered height fits the stage; wide
views scroll from a reachable left edge. Desktop width tracks the pane through
resize, collapse/restore, and fullscreen. Narrow toolbars use compact labels.

Native fullscreen includes the preview toolbar, address/status, and error UI.
The exit button and browser fullscreen changes synchronize the pressed state and
return focus to the control. Unsupported browsers disable fullscreen; a rejected
request leaves a visible notice and usable app. Resize and fullscreen listeners
clean up with the preview. Zoom and fullscreen remain local view state and do not
alter saved project or share schemas.

Playwright now declares a full Chromium project plus Firefox and WebKit projects
covering examples, HMR/theme, sharing, and preview controls against production
output. New interaction tests verify zoom geometry and pointer interaction,
viewport width and running-state preservation, scroll reachability, mobile
containment, native fullscreen entry/exit and external exit, and denial recovery.
The remaining editor/layout browser matrix and runtime resource bounds remain
follow-on work.


## Milestone 9 — Full browser matrix and resource hardening

Implemented on 2026-09-11. All browser specs now run in Chromium, Firefox, and
WebKit, extending coverage to editor/Vim, source navigation, file operations,
persistence, chat, and responsive panel layouts.

Compilation checks at the coordinator and compiler boundaries reject more than
200 files or 2 million source/path UTF-16 characters before copying or parsing.
Oversized edits cancel stale builds, preserve the last good preview, and recover
when reduced. Tests also verify termination of a timed-out compiler, rejection of
its late reply, and successful restart.

Console capture limits forwarding to 100 messages per second across all levels,
reports suppression once per window, and resumes automatically. Object summaries
bound recursion and traversal and skip getters. Browser coverage verifies burst
suppression, bounded transport, later logging, working events, and reload.
These are defensive limits, not arbitrary-code CPU/memory isolation: an iframe
can still block on infinite loops, proxy traps, or excessive allocation.

Cross-browser verification exposed WebKit focus traversal reaching an opaque
iframe document proxy. The preview now exposes `contentDocument` as null to host
DOM traversal and continues to communicate through `contentWindow.postMessage`.
Dialog launchers explicitly take focus before opening; example interaction tests
assert no uncaught host errors. Compiler and runtime packages are unchanged.

Verification: 62 Bun tests (556 assertions), TSRX/TypeScript checks, and production
build passed. The final full browser run passed 113/114 cases; its remaining
WebKit reset-size assertion measured layout before it settled. After changing
that assertion to poll for the expected dimensions, the resize test passed three
consecutive runs in each engine (9/9). All 114 cases therefore have passing
coverage across the full run and focused reruns. The full suite was not repeated
after that test-only adjustment.


## Milestone 10 — Advanced example recipes

Implemented on 2026-09-11. The Examples catalog now offers eight self-contained
projects. Three new recipes demonstrate typed reducer actions with bounded
undo/redo history, context consumers with a nested provider override and an
outside-provider default, and a browser-event subscription with effect cleanup.
Each source project includes its own imported modules and stylesheet and runs
without network access or additional packages.

Browser checks exercise both history directions and discarded redo branches,
reactive context updates across an intermediate component, independent overrides,
mobile containment and reload restoration, and listener removal/reconnection
without duplicate callbacks. The existing compiler fixture validates all eight
projects and their complete import graphs. Loading still uses the existing
review, replacement, persistence, and editor-history reset contract.

Verification: all 62 unit/fixture tests passed (657 assertions), including
compilation of all eight examples. All 15 example-browser cases passed across
Chromium, Firefox, and WebKit against the production build. Typechecking and
production build passed; the mobile context screenshot was inspected. The wider
browser suite was not rerun for this catalog-only change.


## Milestone 11 — Preview resource isolation evaluation

Evaluated on 2026-09-12. Added `bun run probe:isolation`, a bounded loopback-only
experiment using the production preview bootstrap and a real compiled project.
The checked-in measurements cover 60 samples: four modes, three repetitions, and
five browser profiles (default Chromium/Firefox/WebKit plus explicit Chromium
site isolation and Firefox Fission controls). The probe performs finite CPU work,
records host scheduling delays, tests issuing worker termination, and samples
Chromium iframe targets while mounted. A supervisor closes stalled profiles.

The evaluation separates data isolation, responsiveness, and enforceable resource
limits. Default probe iframe profiles blocked a nominal 100 ms host callback for
about 600 ms. Explicit Chromium isolation kept all iframe modes responsive;
Firefox Fission kept only the cross-site iframe responsive. Workers stayed
responsive but do not provide a drop-in DOM renderer or a per-worker heap budget.

See [the decision and next implementation contract](preview-resource-isolation.md)
and [raw measurements](preview-isolation-results.json). The recommendation is an
optional dedicated-site preview transport with an explicit local fallback;
strict CPU/memory enforcement would require a separately scoped supervised runner.
Production preview behavior and the compiler/runtime packages are unchanged.

Verification: the final probe completed all 60 samples, with normal iframe
completion and no worker completion received before termination was issued.
The script passed JavaScript syntax checking and the diff passed whitespace
validation. This ticket adds a measurement harness and documentation, so the
unrelated application browser suite was not rerun.


## Milestone 12 — Optional hosted preview transport

Implemented on 2026-09-12. The build emits an independently deployable static
preview document sharing the existing local bootstrap, CSP, module loader, HMR,
console, and runtime source mapping. A build-time trusted endpoint enables the
Local/Hosted selector; local remains the default. Mode changes preserve editor
history and project source. The versioned, one-shot parent handshake transfers
builds only after readiness and validates the iframe window, fresh channel, and
build generation. Expired startup responses cannot recover a timed-out document.

Hosted startup failures stay in hosted mode with an actionable error and explicit
local fallback/retry. The UI explains browser-dependent containment without
claiming CPU/memory quotas. A small existing pane-ID type widening was corrected
so repository typechecking could run; the preview status element again carries
its stable test ID, and Reset layout has an explicit accessible label. See [setup and deployment limits](hosted-preview.md).

Production deployment and measurements against a selected endpoint remain a
follow-up ticket; this milestone implements and verifies the local prototype.

Verification: TSRX/TypeScript checks, the production build, 66 Bun tests (684
assertions), and all 15 hosted-browser cases across Chromium, Firefox, and WebKit
passed. The hosted mobile screenshot was inspected. The initial full-suite attempt
stopped at three failures: a missing Reset layout accessible label (restored in
this change), and two existing persistence tests expecting `#save-status` and a
Reset project control removed by the current UI. The persistence/sharing suites
therefore remain outside this milestone's passing browser snapshot.

The final selected regression run passed all 96 cases across the same three
browsers: `chat-layout`, `examples`, `hmr-theme`, `playground`, `preview-controls`,
`resource-limits`, and `viewport`. Together with hosted coverage, 111 targeted
browser cases passed. No production preview endpoint was deployed.

The final isolated responsiveness probe passed all 60 samples. The hosted callback
median was 101.5 ms with explicit Chromium site isolation and 101.0 ms with Firefox
Fission, versus approximately 600 ms in the default profiles. The generated static
bootstrap and handshake were used for URL modes. See
[the measured snapshot](hosted-preview-isolation-results.json).
