# Project structure

The host application's entry point is `src/App.btsx`. It composes the shell,
view toolbar, workspace, and status bar, and owns one session for the lifetime
of the page. `fixtures/multiple-components/App.btsx` is a compiler test fixture;
it remains a small example that composes `Button`.

## Components

```text
src/App.btsx
  components/shell/
    Topbar.btsx              Run action and branding
    ProjectHeading.btsx      Project title and compiler pipeline
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
    PreviewPane.btsx         Iframe mount, viewport presets, and preview status
  components/output/
    OutputPane.btsx          Problems, console, and generated-code tabs
    ProblemsList.btsx        Compiler/runtime diagnostics
    ConsoleList.btsx         Console history and mapped source navigation
    GeneratedCode.btsx       Per-file TSRX and JavaScript output
  components/chat/
    ChatPane.btsx            Reserved future AI chat view
```

`src/styles/` mirrors these concerns. `src/style.css` contains the shared reset
and imports; pane geometry and responsive rules live in `styles/workspace.css`.

## State and lifecycle boundaries

| Owner | Responsibility |
| --- | --- |
| `playground/project.ts` | Virtual files, path validation, active file, creation/deletion, protected entry |
| `playground/session.ts` | Compilation requests/results, diagnostics, console, source navigation requests, keymap preference |
| `playground/app.ts` | Inject browser Worker and preference storage into the session |
| `playground/workspace-layout.ts` | Panel/group handles, visibility, collapse/expand, default geometry |
| `playground/editor.ts` | CodeMirror document states, selection, per-file undo, Vim, diagnostic markers |
| `playground/editor-connection.ts` | Subscribe the editor to relevant session changes, with deferred dispatch to avoid reentrant CodeMirror updates |
| `playground/preview.ts` | Sandboxed iframe protocol, module loading, current build identity, runtime source mapping |
| `playground/preview-connection.ts` | Load only a new successful build or an explicit reload request |
| Pane components | Local presentation state such as viewport preset, generated-code stage, and form visibility |

The session is independent of DOM and panel APIs. Components consume its stable
external-store snapshots. The layout does not compile projects, change files, or
recreate the preview. Source navigation in the workspace restores the editor
before selecting a file or focusing a diagnostic location.

The compiler, worker coordinator, VFS resolver, source maps, and sandbox retain
their existing contracts. Add future persistence as a separate adapter around
project/session snapshots. Add future AI services outside the view component.

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
changes. A successful compilation or explicit preview reload still creates a
fresh preview document, as before.

AI chat is a placeholder, initially closed. There is no chat service, composer,
or model connection yet. Layout is retained for this page lifetime; durable
layout/project persistence remains a separate milestone.

The type-checker selects `octane/compiler/volar` explicitly so source-distributed
TSRX bindings use the language compiler rather than Octane's runtime entry.
`allowImportingTsExtensions` supports the binding's native `.ts` imports under
the project's existing no-emit, bundler-based configuration.
