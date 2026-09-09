# Changelog

All notable changes to `play` will be recorded here.

## [Unreleased]

### Added

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

- Replaced the starter showcase with the playground; retained the Beast/Octane host.
- Pinned Beast 0.2.60 and added a narrow browser compiler alias plus generated,
  shared production runtime bundles. Production compiler code is unchanged.
