# Changelog

All notable changes to `play` will be recorded here.

## [Unreleased]

### Added

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
