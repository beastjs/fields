# Project structure

The host application's entry point is `src/App.btsx`. It composes the shell,
view toolbar, workspace, and status bar, and owns one session for the lifetime
of the page. `fixtures/multiple-components/App.btsx` is a compiler test fixture;
it remains a small example that composes `Button`.

## Components

```text
src/App.btsx
  components/shell/
    Topbar.btsx              Run/reset actions, save status, recovery notices, branding
    ProjectHeading.btsx      Matched example title (or Your project) and project kind
    ExampleLibrary.btsx      Example selection, source review, and explicit loading
    Statusbar.btsx           Build status and stage timings
  components/layout/
    ViewToolbar.btsx         Always-visible pane toggles and reset
    Workspace.btsx           Resizable group composition and source navigation
    PaneSurface.btsx         Pane semantics and collapsed focus isolation
    CollapseButton.btsx      Collapse action and focus return
  components/files/
    FilesPane.btsx           Explorer, selection, and deletion
    NewFileForm.btsx         Typed field state and validation with TanStack Form
  components/editor/
    EditorPane.btsx          File tabs, CodeMirror mount, and Vim preference
  components/preview/
    PreviewPane.btsx         Iframe mount, viewport/zoom/fullscreen controls, and preview status
  components/output/
    OutputPane.btsx          Problems, console, and generated-code tabs
    ProblemsList.btsx        Compiler/runtime diagnostics
    ConsoleList.btsx         Console history and mapped source navigation
    GeneratedCode.btsx       Per-file TSRX and JavaScript output
  components/chat/
    ChatPane.btsx            Streaming chat, composer, and provider settings
```

`src/styles/` mirrors these concerns. `src/style.css` contains the shared reset
and imports; pane geometry and responsive rules live in `styles/workspace.css`.

## State and lifecycle boundaries

| Owner | Responsibility |
| --- | --- |
| `playground/examples.ts` | Typed example catalog and complete virtual projects, independent of UI |
| `playground/resource-limits.ts` | Shared compiler input bounds, checked before worker transfer and parsing |
| `playground/project.ts` | Virtual files, path validation, active file, creation/deletion, protected entry |
| `playground/session.ts` | Compilation requests/results, diagnostics, console, source navigation, keymap/viewport, project reset generation |
| `playground/app.ts` | Restore before session creation, inject Worker/storage, connect page lifecycle flushing |
| `playground/project-storage.ts` | Versioned serializer, validation/migration, bounded local storage and conflict handling |
| `playground/project-sharing.ts` | Bounded compressed URL transport around the project serializer |
| `playground/project-persistence.ts` | Debounced saves of authored state, flushing and immediate reset/import saves |
| `playground/hot-update.ts` | Compare builds and choose component/style updates or full reload |
| `playground/theme.ts` | Apply and remember light/dark preferences |
| `playground/workspace-layout.ts` | Panel/group handles, visibility, collapse/expand, default geometry |
| `playground/editor.ts` | CodeMirror document states, selection, per-file undo, Vim, diagnostic markers |
| `playground/editor-connection.ts` | Subscribe the editor to relevant session changes, with deferred dispatch to avoid reentrant CodeMirror updates |
| `playground/preview.ts` | Sandboxed iframe protocol, module loading, current build identity, runtime source mapping |
| `playground/preview-connection.ts` | Deliver builds, force explicit reloads, and synchronize preview theme |
| Pane components | Local presentation state such as generated-code stage and form visibility |

The session is independent of DOM and panel APIs. Components consume its stable
external-store snapshots. The layout does not compile projects, change files, or
recreate the preview. Source navigation in the workspace restores the editor
before selecting a file or focusing a diagnostic location.

The compiler, worker coordinator, VFS resolver, source maps, and sandbox retain
their existing contracts. Persistence is a separate adapter around project/session
snapshots. `chat/` owns conversation/settings/transport state; `server/` owns the
provider proxy. Neither belongs to the persisted project snapshot.

## Resizable workspace

The host uses `@octanejs/resizable-panels@0.0.10`:

```text
Workspace Group (vertical)
  Workbench
    Dock Group (horizontal)
      Files
      Center
        Main Group (horizontal on desktop, vertical on narrow screens)
          Editor
          Preview
      AI chat (initially collapsed)
  Output
```

Each separator supports pointer dragging and keyboard resizing through the
binding. Focus a separator and use its axis arrow keys to resize. The Files
separator also supports Enter to collapse/restore the preceding pane. Each pane
has a collapse button and an always-reachable toolbar toggle; keep at least one
of Editor and Preview visible. Reset layout restores the initial proportions.
Narrow screens start with Files collapsed and stack Editor above Preview.

Collapsing sets a pane to zero size while retaining its component, DOM, and
connections. Its content becomes inert and hidden from assistive technology;
the collapse button returns focus to its toolbar toggle. Editor undo history,
preview application state, console history, and selected output survive layout
changes. Successful compatible component/style compilations use native Octane
HMR; unsupported changes and explicit reload create a fresh preview document.
See [HMR integration](playground-hmr.md) for state-retention limits and disposal.

AI chat starts closed and supports streaming responses with optional active-file
context. Layout proportions and collapsed views use the URL through `panel-query.ts`
and the Nuqs binding. Project files, active tab, and preview size use localStorage;
Vim/provider preferences have independent keys. A project reset preserves layout
and these independent preferences.

The type-checker selects `octane/compiler/volar` explicitly so source-distributed
TSRX bindings use the language compiler rather than Octane's runtime entry.
`allowImportingTsExtensions` supports the binding's native `.ts` imports under
the project's existing no-emit, bundler-based configuration.
