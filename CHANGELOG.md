# Changelog

All notable changes to `play` will be recorded here.

## [Unreleased]

### Added

- Section presets as JSON documents stored in Convex: a typed node tree whose
  layout, spacing, sizing and typography are fields rather than class strings,
  with unmodelled utilities, conditional class lists and `setup` behaviour
  preserved verbatim. A parser and renderer convert between the document and
  Beast source losslessly and idempotently, proven across all 44 built-in
  templates, which still compile as part of a page. Adds `sectionPresets`,
  `themes` and `pageRecipes` tables with team scoping and full-text search,
  zod validation at the storage boundary, and an idempotent seeding script.
  Presets are stored as a flat node list rather than a tree, so they stay inside
  Convex's 16-level nesting limit at any section depth, and attributes are stored
  as an ordered array so they survive Convex normalising object key order. All 44
  presets were verified end-to-end: fetched back from the deployment, rebuilt, and
  rendered identically to their original templates. The studio still reads the
  bundled catalog; see docs/design-studio-presets.md.

- Design Studio page composer: 40 monochrome, theme-agnostic section templates
  across 14 kinds (topbar, hero, partners marquee, stats, features, guides,
  products, testimonials, pricing, FAQ, team, call to action, newsletter, footer),
  starter recipes, search, drag-to-reorder outline, live device-scaled preview that
  scrolls to the chosen section and swaps in rebuilt pages without flashing, code
  view, and an install plan that writes `src/sections/*`, `src/Page.btsx`, and
  studio styles while protecting hand edits.
  Replaces the topbar-only layout builder.

- Chat Apply & verify for explicit complete-file recommendations, with local
  compiler verification, stale-project protection, diagnostics in chat, and
  undoable editor synchronization. Failed checks leave source and preview intact.

- Optional hosted preview with a generated static bootstrap, build-time endpoint
  configuration, explicit local/hosted selection, versioned handshake, and startup
  recovery that preserves project source and editor history.
- Hosted transport browser coverage and a responsiveness probe using the generated
  document, with explicit browser-dependent containment limits.

- Native Octane HMR for compatible component and CSS edits, including consecutive
  hook-state retention, effect/module disposal, mapped errors across evaluations,
  and full reload fallback for unsupported changes or runtime recovery.
- Remembered light/dark toolbar toggle, shared palette and syntax tokens, live
  preview theme defaults, and a starter example that follows the color scheme.
- HMR boundary/source-map tests and browser coverage for retained state, cleanup,
  error recovery, theme persistence, editor undo, and mobile light-mode layout.

- Versioned local project autosave/restore for source files, active tab, and preview
  size, with validation, legacy snapshot migration, bounded storage, and save status.
- Confirmed project reset that immediately replaces the saved project and clears
  cached editor/preview state; recovery notices preserve unreadable records,
  previous saves after quota failures, and detected competing-tab edits.
- Unit and browser coverage for persistence, immediate reload, corrupt/unsupported
  data, storage failures, restoration, and reset cancellation/cache invalidation.

- `@octanejs/resizable-panels` workspace with pointer/keyboard resizing,
  collapse/expand controls, layout reset, responsive orientation, and a reserved
  collapsed AI chat pane. Layout changes retain editor and preview state.
- File-management validation and session behavior tests, plus browser coverage
  for pane resizing, restoration, file creation/deletion, and responsive changes.

- Runtime stack navigation through composed source maps, authored runtime
  diagnostic markers, stale-source checks, and validated per-build Blob manifests.
- Optional Vim editing with a status indicator, `:w` compilation, preserved
  per-file undo history, and a remembered browser preference.
- First functional Beast Playground milestone with CodeMirror, a virtual project,
  actual Beast/Octane compiler adapters, worker coordination, structured diagnostics,
  native ESM preview loading, console capture, responsive presets, and generated code.
- Multi-stage source maps, compiler timings, architecture/API documentation, and
  a phased implementation status report.
- Compiler fixtures, filesystem/coordinator/protocol tests, and Chromium integration
  tests for rendering, edits, errors, recovery, imports, and preview isolation.

### Changed

- Reduced `src/App.btsx` to component composition. Split shell, files, editor,
  preview, output, and chat views, with corresponding stylesheet modules.
- Replaced the global DOM controller with separate project/session/layout models
  and scoped CodeMirror/iframe connections. The new-file form uses the Octane
  TanStack Form binding; entry protection and path validation live in the project.
- Selected the Octane Volar compiler entry explicitly for TSRX dependency checking.

- Replaced the starter showcase with the playground; retained the Beast/Octane host.
- Pinned Beast 0.2.60 and added a narrow browser compiler alias plus generated,
  shared production runtime bundles. Production compiler code is unchanged.
