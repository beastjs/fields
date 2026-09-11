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
`compilationLimitError` checks 200 files / 2 million source and path UTF-16 units
before coordinator snapshotting and again before compiler parsing. A rejected
project reports through `onError`, invalidates older work, and can recover on the
next valid schedule. These bounds differ from serialized save/share limits.

## Preview

`Preview.load(result, forceReload?)` applies a supported hot update when the
current document is live; otherwise it creates a fresh iframe document. `reload()`
always replays the last successful result in a new document. `setTheme(theme)`
changes preview defaults without recompiling. `dispose()` removes listeners and
clears the document.
The iframe is always `sandbox="allow-scripts"`, without same-origin privileges.

Host → frame: version, random document channel, build ID, `type: 'load'`, modules,
entry; `type: 'update'` carries changed modules and styles. `type: 'theme'` carries
the theme on the same document channel. Frame → host: the same envelope with
`ready`, `module-manifest`, `rendered`, `reload-required`, `console`, or
`runtime-error`. A rendered event identifies `update: 'reload' | 'hot'`.
Both ends validate source window, envelope, and payload shape.
The host checks bounded console strings and retains at most 200 entries.
The bootstrap forwards up to 100 console calls per one-second window across all
levels, then emits one suppression notice. Dropped calls skip serialization and
devtools forwarding; the next window resumes capture. Object summaries cap depth
at three, entries at 20 per object/array, traversal at 100 values per argument,
and output at 4,000 characters. Accessors are represented without invoking them.
This does not bound arbitrary user code, including proxy traps or memory use.
Opaque iframe origins require `postMessage` target `*`; the specific window and
per-document channel/build check prevent accepting unrelated messages.

User code is sent only by structured clone, never interpolated into srcdoc.
The bootstrap creates Blob modules, one import map, then imports the entry.
CSP denies remote scripts, network fetches, navigation through forms, and base
URL changes. Sandbox denies parent access, storage, popups and top navigation.
Replacing the document disposes the old realm; Blob URLs are revoked on pagehide.
Preview startup/update has a 10-second timeout. Runtime failures preserve compiler
state and force a fresh document on the next successful compilation. See
[the HMR integration](playground-hmr.md) for boundary selection and disposal.

## Runtime source navigation

Before executing the entry, the iframe sends `module-manifest` with `{ id, url }`
entries for every Blob module. The host's `RuntimeSourceMapper` accepts it
atomically only when it matches the compiled module IDs exactly, with no duplicate
IDs or URLs. A new mapper is created per preview build. Compiler maps remain on
the host; source locations supplied by preview code are never trusted as authored
navigation targets.

`mapStack(stack, fallbackPosition?)` returns bounded `RuntimeStackFrame[]` with
the original raw line, known module ID, and an optional authored `RuntimeLocation`.
It accepts V8 and Firefox/WebKit Blob stack shapes and one-based browser positions.
The optional ErrorEvent location handles errors without stacks. Each known frame
is traced through the final composed map; runtime modules, malformed or missing
maps, and unknown URLs retain raw frames. Relative map sources are resolved
against the authored module directory and must match that module's source file.

`RuntimeLocation` includes the authored snapshot. Console navigation rechecks it
against the current VFS content both when rendering and when clicked. Changed or
deleted source disables the link. The first current authored frame also becomes
a structured runtime diagnostic in Problems and the editor. During HMR,
`RuntimeSourceMapper.advance(modules)` accepts the next compilation's manifest
while retaining each older URL's original source map. Delayed old callbacks
therefore produce stale-source links rather than misleading current-source links.

## Editor keybindings

`ProjectEditor` accepts an initial `EditorKeymap` (`default` or `vim`).
`setKeymap(keymap)` reconfigures a CodeMirror compartment in both active and saved
file states, retaining document contents and undo history. Vim uses the installed
`@replit/codemirror-vim` extension, includes its mode/status panel, and binds the
editor's `:w` command to the compilation coordinator. The usual run shortcuts
remain available. Each newly opened file starts in Vim normal mode.

The host remembers the keymap under `beast-playground.editor-keymap.v1`.
Unknown values fall back to standard editing. Unavailable browser storage makes
the preference session-only; it does not prevent the editor from working. This
preference is independent of the project record and survives a project reset.

## Project persistence

`project-storage.ts` defines `SavedWorkspace` version 1:

```ts
{
  version: 1,
  project: { entry: '/src/main.ts', files: { /* authored sources */ } },
  activeFile: '/src/App.btsx',
  preview: { width: '100%' } // '100%' | '768px' | '375px'
}
```

`decodeWorkspace(string)` validates a bounded record, normalizes paths using the
existing VFS, rejects duplicate aliases, and requires a present entry. Missing or
stale active-file/viewport preferences recover to defaults without dropping valid
source. An unversioned raw `CompilationProject` snapshot is a supported migration
input; it receives version 1 and default preferences. Other versions are rejected.
`encodeWorkspace` whitelists authored state and emits deterministic sorted files.
Both directions enforce 200 files and 2,000,000 serialized UTF-16 characters.

`WorkspaceStore` receives a storage factory so restricted `localStorage` access
can be caught. `restore()` returns a workspace or a visible failure status;
`save(workspace, replace?)` returns status without throwing storage errors.
Records live at `beast-playground.project`. Failed writes retain the old record.
Unreadable/unsupported records block automatic writes. A pre-write comparison
against the last read/written string detects changes from another tab and blocks
overwrite; this is a conflict guard, not cross-tab merging or a database lock.
Only an explicit reset or confirmed import uses `replace: true` to replace a blocked record.

`connectProjectPersistence` observes changes to project snapshots, active file,
viewport, and project generation. It debounces writes for 300 ms and exposes
`flush()`/`dispose()`; compiler results, console events, and pane changes do not
trigger saves. The browser composition boundary flushes on `pagehide`, hidden
visibility, and session disposal. Abrupt browser termination before a flush can
still lose the pending edit. Restore runs before constructing the session/worker.

`PlaygroundSession.resetProject` replaces source, clears transient diagnostics,
console/build state, resets viewport, and advances `projectGeneration`. Editor
and preview adapters use that generation to discard cached documents/undo history
and the old iframe realm. Worker revision checks reject obsolete results. The
UI requires a confirmation before calling reset, and reset saves immediately.

All current project files are open tabs, so the tab list is derived from `files`.
Vim settings retain their separate existing record. URL layout, provider settings,
chat credentials/conversations, compiler output, diagnostics, editor undo/selection,
and application runtime state are not part of the project record.

## Project sharing

`project-sharing.ts` reuses `SavedWorkspace` and its existing validation without
depending on components, storage, compiler output, or session internals:

- `encodeSharedProject(workspace)` emits `v1.` plus base64url-encoded gzip JSON.
- `decodeSharedProject(payload)` checks the transport version and encoding,
  decompresses with a streaming byte limit, then validates/normalizes the workspace.
- `createProjectShareURL(workspace, base)` preserves origin/path, strips query
  parameters and URL credentials, and puts the payload in `#project=...`.
- `projectPayloadFromHash(hash)` recognizes shared-project navigation.

The transport accepts at most 64,000 payload characters and 2,000,000 decoded
UTF-8 bytes, in addition to the serializer's 200-file/2-million-character limits.
Both encoding and decoding enforce limits; decompression cancels as soon as its
byte limit is exceeded. Invalid or future-version links report a visible error.
URL fragments are not sent in HTTP requests. No project upload API is introduced.

`PlaygroundSession.exportWorkspace()` captures authored state. After explicit
review/confirmation, `importWorkspace()` replaces it in one generation change,
restores the shared active file/viewport, discards old editor/runtime state, and
saves immediately. Theme, keymap, chat, and pane layout are independent. Until
confirmation, incoming files are only displayed as text, and the existing project
continues to be the active/local project. Cancel/Escape leaves it unchanged.
Closing an import removes its fragment; late decoding results are ignored after
close or navigation. Copy failures leave a selectable link for manual copying.

## Theme

`theme.ts` provides validated `dark | light` preferences at
`beast-playground.theme.v1`. An early head script applies the same preference
before CSS paints; unavailable storage falls back to dark. Session theme changes
update the document root, a CodeMirror dark-theme compartment (including cached
file states), and a preview protocol message. No compilation is scheduled.
The project record, undo history, and preview realm are unchanged. Palette and
syntax tokens live in `styles/theme.css`; authored preview CSS can override the
bootstrap's inherited colors and color scheme.
