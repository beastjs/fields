# Octane HMR integration

The playground consumes the pinned production compiler and runtime; it does not
implement component replacement or hook-state migration itself.

## Inspected contracts

`octane@0.2.6` exposes `hmr: 'vite'` in `dist/compiler/index.d.ts`. Its
`dist/compiler/compile.js` emits self-accepting component modules that persist
canonical wrappers in `import.meta.hot.data.__octaneComponents`. Re-evaluation
hands the new body to the retained wrapper through `wrapper[HMR].update()` and
re-exports that wrapper. The accept callback checks wrapper identity and calls
`invalidate()` when it cannot preserve the boundary.

The installed `dist/runtime.js` owns `hmr()`, `resetHmrBlock()`, marker checks,
effect disposal, and hook retention. Resetting a component unmounts its child
blocks and reruns its effects while retaining its own hooks. Descendant state
can therefore reset when a parent component changes; arbitrary hook-layout
changes carry the runtime's usual HMR limitations.

## Module loading decision

Keep the original native ESM import map and shared runtime singletons. A changed
component gets a new Blob URL and is imported directly. Its project imports
still resolve through the original map to canonical wrappers. The compiler's
handoff updates those wrappers in place, including across consecutive updates.
The iframe exposes only a small `import.meta.hot` transport adapter with persistent
`data`, self-`accept`, `dispose`, and `invalidate` contracts.

This avoids editing resolved import-map entries, which browsers retain once
resolved, and avoids depending on multiple-map support. See the
[MDN import-map merging contract](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/script/type/importmap#merging_multiple_import_maps).

`CompiledModule.hot` carries lexer-derived imports/exports and a component/style
kind. `planHotUpdate()` rejects entry changes, added/removed modules, changed
project imports/exports, and changed non-component modules. Changes in generated
runtime helper imports are safe because every runtime module is already mapped;
a changed runtime implementation itself still requires reload.

Before evaluating replacements, the iframe verifies each old module was evaluated,
self-accepted, and exported only the components registered by Octane. Unvisited
lazy modules and mixed exports fall back to reload. Module disposal callbacks
run before replacement; the compiler/runtime handle component effect cleanup.
An invalidation or replacement-evaluation failure requests a clean reload.

CSS modules tag their owned style element with the source path. Style updates
replace its text, retaining DOM and component state without duplicate style tags.
A missing/unexecuted style module requires reload. Scoped component styles remain
owned by the production Octane runtime.

## Lifecycle, diagnostics, and bounds

The document channel persists through hot updates and the build ID increases.
An update arriving before the preceding preview settles causes a fresh document
instead of overlapping asynchronous module evaluations. Compiler revision checks
still reject stale results. Compiler errors leave the last good document running;
runtime errors display their normal mapped diagnostics and the next successful
build starts fresh. The Reload preview button always creates a new document.

New module manifests arrive before evaluation. Source maps include the injected
HMR prelude through the existing composed-map path. The host retains mappings by
evaluation URL, so an old delayed callback maps to its original authored snapshot
and the editor's stale-source check remains effective.

Blob URLs and native ESM module records must remain alive for old imports and
closures. They are released with the realm on reload/pagehide; the next build
after 40 component-update batches creates a fresh document to bound accumulation.
CSS-only and unchanged builds do not add module evaluations. Compilation itself
still traverses the full graph; incremental compilation is a separate ticket.

The sandbox, CSP, supported package allowlist, and parent-window message checks
remain in effect. No server-side module filesystem or privileged iframe API is
introduced.

## Acceptance coverage

Unit tests cover production HMR output, boundary planning, runtime-helper changes,
CSS changes, reload conditions, and old/new evaluation source maps. Browser tests
cover consecutive state-preserving component/CSS edits, explicit reload, compile
error recovery, entry-change fallback, module/effect cleanup, and mapped runtime
failures after hot replacement. Theme changes preserve the same preview realm.
