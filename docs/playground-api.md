# Playground API contracts

## Project and filesystem

`CompilationProject` in `src/playground/contracts.ts` contains a serializable
`files: Record<string, string>` and `entry: string`. Files are plain UTF-8 strings.
Paths normalize to project-root POSIX paths. Attempts to traverse above root,
URL/query/hash paths, and duplicate normalized initial paths are errors.

`VirtualFileSystem` provides `read`, `write`, `delete`, `exists`, `list`, `resolve`,
and `snapshot`. Lists are sorted; snapshots are copies. Resolution tries exact
paths, then BTSX/TSRX/TS/JS/JSON/CSS extensions, then directory indexes. A generated
`.tsrx` request can resolve to the corresponding authored `.btsx` file. Packages
are handled by the compiler's explicit runtime allowlist, not the filesystem.

## Compiler

`compileProject(project): Promise<CompilationResult>` traverses the entry graph.
`compileBeastModule` and `compileOctaneModule` expose independently testable
adapters around production package APIs. `linkModule` rewrites only lexer-located
import specifiers, preserves authored maps, and gives each module a canonical
`@playground` ID. Native ESM performs linking/evaluation, including cycles.

A result includes modules, CSS asset records, structured diagnostics, generated
TSRX, and metadata with total/per-stage durations in milliseconds. `entry` is
absent on compilation failure. Consumers must never execute a failed result.
Module order/code/maps are deterministic for identical input and pinned compiler
versions; wall-clock timings are intentionally observational, not deterministic.

Diagnostic coordinates are one-based UTF-16 line/column positions. Beast errors
retain their authored positions; Octane positions are traced through Beast maps.
Final JavaScript maps compose both compiler stages and the import rewrite. Plain
CSS/JSON parse errors currently have fallback file positions when the parser
provides no structured location. Runtime errors remain separate preview events.

`assets` documents CSS output; corresponding executable CSS modules inject style
text when imported, preserving module ownership and dependency order. Consumers
must not inject asset records a second time.

## Worker and coordinator

Version 1 request: `{ version: 1, type: 'compile', id, project }`.
Response: `{ version: 1, type: 'compile-result', id, result }`.
Failures use the same response shape with diagnostics and no entry.

`CompilationCoordinator` accepts a worker factory and start/result/error
callbacks. `schedule(project, immediate?)` snapshots files, increments revision
immediately, invalidates earlier results, then debounces (220 ms by default).
An obsolete busy worker is terminated because the synchronous compilers cannot
process a cancel message mid-call. Idle workers are reused. Worker errors and
15-second compilation timeouts tear down the worker; the next run recreates it.
`dispose()` cancels timers, terminates the worker, and ignores late messages.

## Preview

`Preview.load(result)` creates a fresh iframe document. `reload()` replays the
last successful result. `dispose()` removes listeners and clears the document.
The iframe is always `sandbox="allow-scripts"`, without same-origin privileges.

Host → frame: version, random channel, build ID, `type: 'load'`, modules, entry.
Frame → host: the same envelope with `ready`, `rendered`, `console`, or
`runtime-error`. Both ends validate source window, envelope, and payload shape.
The host checks bounded console strings and retains at most 200 entries.
Opaque iframe origins require `postMessage` target `*`; the specific window and
per-document channel/build check prevent accepting unrelated messages.

User code is sent only by structured clone, never interpolated into srcdoc.
The bootstrap creates Blob modules, one import map, then imports the entry.
CSP denies remote scripts, network fetches, navigation through forms, and base
URL changes. Sandbox denies parent access, storage, popups and top navigation.
Replacing the document disposes the old realm; Blob URLs are revoked on pagehide.
Preview startup has a 10-second timeout. Runtime failures preserve compiler state.
