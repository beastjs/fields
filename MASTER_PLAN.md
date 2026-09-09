# BeastJS → Octane → Web Playground

## Professional-Grade, Task-Oriented Implementation Plan for LLM Agents

---

## 0. Mission

Build a professional-grade browser playground for the BeastJS → Octane → Web compilation pipeline.

The final product should allow a developer to:

1. Open a browser-based IDE.
2. Create/edit BeastJS source files.
3. Compile BeastJS into Octane.
4. Compile Octane into browser-executable Web output.
5. Display compiler diagnostics directly in the editor.
6. Render the resulting application beside the editor.
7. Update the preview automatically as code changes.
8. Support multiple virtual files and imports.
9. Preserve a stable preview environment.
10. Eventually support HMR, dependencies, examples, sharing, persistence, and debugging.

The playground must use the actual BeastJS and Octane compiler pipelines rather than creating a simplified compiler specifically for the playground.

The playground is a consumer of the compiler infrastructure.

---

# 1. Core Architecture

The system should be treated as three distinct compilation stages:

```text
                    ┌─────────────────────┐
                    │     BeastJS Source  │
                    │                     │
                    │ App.beast           │
                    │ Button.beast        │
                    │ main.beast          │
                    └──────────┬──────────┘
                               │
                               ▼
                    ┌─────────────────────┐
                    │     BeastJS         │
                    │     Compiler        │
                    │                     │
                    │ Parse               │
                    │ Transform           │
                    │ Generate Octane     │
                    └──────────┬──────────┘
                               │
                               ▼
                    ┌─────────────────────┐
                    │       Octane        │
                    │       Source        │
                    │                     │
                    │ components         │
                    │ templates          │
                    │ styles              │
                    └──────────┬──────────┘
                               │
                               ▼
                    ┌─────────────────────┐
                    │       Octane        │
                    │     Compiler        │
                    │                     │
                    │ AST                 │
                    │ transforms           │
                    │ runtime generation  │
                    │ module generation   │
                    └──────────┬──────────┘
                               │
                               ▼
                    ┌─────────────────────┐
                    │       Web           │
                    │     Bundle/Modules  │
                    │                     │
                    │ JS                  │
                    │ CSS                 │
                    │ Assets              │
                    └──────────┬──────────┘
                               │
                               ▼
                    ┌─────────────────────┐
                    │     Preview iframe  │
                    │                     │
                    │ Octane Runtime      │
                    │ Application         │
                    └─────────────────────┘
```

The playground must not bypass these stages.

---

# 2. Architectural Principles

All agents must follow these principles.

## 2.1 One source of truth

The production compiler and the playground compiler must use the same compilation infrastructure.

Do not implement:

```text
playgroundCompiler()
```

as a second implementation of BeastJS or Octane compilation.

Instead expose reusable compiler APIs.

---

## 2.2 Virtual filesystem first

The compiler should operate against a virtual project:

```ts
interface VirtualFileSystem {
  read(path: string): string | undefined
  write(path: string, content: string): void
  delete(path: string): void
  exists(path: string): boolean
  list(): string[]
}
```

The playground should therefore compile:

```ts
{
  "/src/App.beast": "...",
  "/src/Button.beast": "...",
  "/src/main.beast": "..."
}
```

rather than passing one giant string to the compiler.

---

## 2.3 Compiler stages must remain independently testable

Maintain clear boundaries:

```text
BeastJS
   ↓
BeastJS Compiler
   ↓
Octane Source
   ↓
Octane Compiler
   ↓
Web Modules
   ↓
Preview Runtime
```

Each boundary must have tests.

---

## 2.4 Structured results

Never communicate compiler errors as unstructured strings.

Use structured diagnostics:

```ts
interface Diagnostic {
  file: string
  message: string

  severity: "error" | "warning" | "info"

  start: {
    line: number
    column: number
  }

  end?: {
    line: number
    column: number
  }

  code?: string

  source?: "beast" | "octane" | "web" | "runtime"
}
```

This allows the editor to display:

```text
App.beast:12:8
~~~~~~~~~~~~~~
Unknown property "foo"
```

and allows the preview to display runtime errors independently.

---

# 3. Target User Experience

The final playground should feel like a professional development environment rather than a textarea with an iframe.

Recommended layout:

```text
┌───────────────────────────────────────────────────────────────┐
│ BeastJS Playground                              Run / Share    │
├────────────┬──────────────────────────────┬───────────────────┤
│            │                              │                   │
│  Explorer  │          Editor              │     Preview       │
│            │                              │                   │
│  src/      │  1  component App {          │                   │
│   App      │  2    ...                    │      Rendered      │
│   Button   │  3  }                        │      application   │
│   main     │                              │                   │
│            │                              │                   │
│            │                              │                   │
├────────────┴──────────────────────────────┴───────────────────┤
│ Problems / Output / Compiler / Console                         │
└───────────────────────────────────────────────────────────────┘
```

The interface should provide:

* file explorer
* tabbed editor
* syntax highlighting
* autocomplete where feasible
* diagnostics
* preview
* console
* compile status
* build timing
* error overlay
* responsive preview controls
* reload/restart controls
* optional inspector later

---

# 4. Agent Operating Rules

Every implementation agent must follow these rules.

## Rule 1 — Inspect before modifying

Before changing code:

1. Inspect repository structure.
2. Locate relevant compiler/runtime code.
3. Identify existing abstractions.
4. Identify existing tests.
5. Understand current build pipeline.
6. Reuse existing infrastructure.

Never invent an abstraction before checking whether one already exists.

---

## Rule 2 — Small, composable changes

Each task should produce one coherent architectural improvement.

Avoid giant changes such as:

> "Build the entire playground."

Instead:

> "Implement the compiler worker protocol."

Then:

> "Implement the preview iframe runtime."

Then:

> "Connect editor changes to compilation."

---

## Rule 3 — Preserve existing behavior

Existing applications must continue to compile.

Every compiler modification should run:

```text
existing tests
+
new tests
```

---

## Rule 4 — No hidden magic

Important transformations must be observable.

Provide development instrumentation for:

```text
BeastJS compile
Octane compile
bundle
preview startup
preview update
runtime error
```

---

## Rule 5 — Contracts before implementations

Before implementing a subsystem, define its API.

For example:

```ts
interface PlaygroundCompiler {
  compile(
    project: VirtualProject
  ): Promise<CompilationResult>
}
```

Then implement it.

---

# 5. Phase 1 — Repository and Architecture Discovery

## Agent: Architecture Analyst

### Objective

Understand the existing BeastJS and Octane architecture before any implementation.

### Tasks

* Map the repository.
* Locate BeastJS parser/compiler.
* Locate BeastJS → Octane transformation.
* Locate Octane parser/compiler.
* Locate Octane → Web generation.
* Locate runtime.
* Locate bundler.
* Locate HMR infrastructure.
* Locate existing worker usage.
* Locate existing module resolution.
* Locate existing diagnostics.
* Locate existing test infrastructure.

### Deliverable

Create:

```text
docs/playground-architecture.md
```

containing:

```text
Current pipeline
Compiler entry points
Runtime entry points
Module resolution
AST boundaries
Build artifacts
Existing reusable infrastructure
Missing infrastructure
Recommended integration points
```

### Important

Do not modify production code during this task.

---

# 6. Phase 2 — Define Compiler Contracts

## Agent: Compiler API Architect

### Objective

Create stable APIs between BeastJS, Octane, and Web compilation.

Define:

```ts
interface CompilationProject {
  files: Record<string, string>
  entry: string
  options?: CompilationOptions
}
```

Define:

```ts
interface CompilationResult {
  modules: CompiledModule[]
  assets: CompiledAsset[]
  diagnostics: Diagnostic[]
  entry?: string
  metadata: CompilationMetadata
}
```

Define:

```ts
interface CompiledModule {
  id: string
  code: string
  source?: string
  sourceMap?: string
}
```

Define:

```ts
interface CompilationMetadata {
  duration: number
  modules: number
  transformedFiles: number
  compilerVersion: string
}
```

The exact API should be adapted to the existing codebase.

Do not force these exact names if equivalent infrastructure already exists.

---

# 7. Phase 3 — Virtual Filesystem

## Agent: Virtual FS Engineer

### Objective

Create an in-memory filesystem usable by both the playground and compiler.

Support:

```text
read
write
delete
exists
list
resolve
```

Example:

```ts
const project = new VirtualProject()

project.write(
  "/src/App.beast",
  source
)

project.write(
  "/src/main.beast",
  main
)
```

The filesystem must support deterministic compilation.

### Tests

Test:

* nested directories
* path normalization
* imports
* missing files
* deletion
* duplicate writes
* entry resolution

---

# 8. Phase 4 — BeastJS → Octane Compiler Adapter

## Agent: BeastJS Integration Engineer

### Objective

Expose BeastJS compilation as a clean callable API.

Target concept:

```ts
const result = await beastCompiler.compile({
  files,
  entry
})
```

The output should be Octane modules/source.

Do not create a playground-specific transformation.

### Requirements

* deterministic output
* structured diagnostics
* source locations
* source maps where practical
* virtual filesystem support
* cancellation support if practical

### Tests

Create fixture projects:

```text
fixtures/
  simple-component/
  multiple-components/
  imports/
  syntax-error/
  semantic-error/
```

---

# 9. Phase 5 — Octane → Web Compiler Adapter

## Agent: Octane Web Compiler Engineer

### Objective

Expose the existing Octane compiler/bundler as a browser-playground-compatible API.

The output must be executable by the preview environment.

Prefer:

```ts
interface WebCompilationResult {
  modules: CompiledModule[]
  entry: string
  css: string[]
  assets: CompiledAsset[]
  diagnostics: Diagnostic[]
}
```

Avoid assuming that every playground build needs a single enormous string.

Support modules whenever practical.

---

# 10. Phase 6 — Browser Compiler Worker

## Agent: Worker Engineer

### Objective

Move compilation off the UI thread.

Architecture:

```text
Main Thread
     │
     │ compile(project)
     ▼
Worker
     │
     ├── BeastJS
     ├── Octane
     └── Web compilation
     │
     ▼
CompilationResult
     │
     ▼
Main Thread
```

Define a versioned protocol.

Example:

```ts
type WorkerRequest =
  | {
      type: "compile"
      id: number
      project: CompilationProject
    }
  | {
      type: "cancel"
      id: number
    }
```

Response:

```ts
type WorkerResponse =
  | {
      type: "compile-result"
      id: number
      result: CompilationResult
    }
  | {
      type: "compile-error"
      id: number
      diagnostics: Diagnostic[]
    }
```

### Requirements

* request IDs
* cancellation
* stale-result protection
* deterministic responses
* error recovery
* worker restart support

---

# 11. Phase 7 — Preview Runtime

## Agent: Preview Runtime Engineer

### Objective

Create an isolated browser execution environment.

Use:

```html
<iframe sandbox="allow-scripts">
```

where appropriate.

The host application must communicate with the iframe using:

```text
postMessage
```

rather than directly manipulating its internals.

Protocol:

```ts
type PreviewMessage =
  | {
      type: "load"
      modules: Record<string, string>
      entry: string
    }
  | {
      type: "update"
      modules: Record<string, string>
      entry: string
    }
  | {
      type: "reload"
    }
```

Preview → host:

```ts
type PreviewEvent =
  | {
      type: "ready"
    }
  | {
      type: "console"
      level: string
      args: unknown[]
    }
  | {
      type: "runtime-error"
      error: RuntimeError
    }
```

---

# 12. Phase 8 — Module Loading

## Agent: Browser Module Engineer

### Objective

Solve execution of compiler-produced modules inside the preview.

Possible strategies:

### Strategy A

Generate a self-contained bundle.

### Strategy B

Generate Blob URLs for modules.

### Strategy C

Use an import-map based runtime.

### Strategy D

Implement a small virtual module loader.

The agent must evaluate the existing Octane output and choose the strategy that best matches the compiler architecture.

The chosen strategy must be documented.

The implementation must support:

```text
module A
   ↓ imports
module B
   ↓ imports
module C
```

without requiring a server-side filesystem.

---

# 13. Phase 9 — Editor

## Agent: Editor UX Engineer

### Objective

Build the professional editor environment.

Recommended capabilities:

* Monaco or CodeMirror
* tabs
* file explorer
* syntax highlighting
* diagnostics
* minimap optional
* keyboard shortcuts
* formatting
* search
* command palette later

Editor state should be independent from compiler state.

```text
Editor State
    │
    ▼
Virtual Project
    │
    ▼
Compiler
```

Not:

```text
Editor → compiler internals
```

---

# 14. Phase 10 — Compilation Coordinator

## Agent: Playground State Engineer

### Objective

Connect editing, compilation, and preview.

Pipeline:

```text
Editor Change
      │
      ▼
Update Virtual FS
      │
      ▼
Debounce
      │
      ▼
Compile Worker
      │
      ▼
Validate result ID
      │
      ├── diagnostics → Editor
      │
      └── successful build → Preview
```

Use a debounce around approximately:

```text
150–300ms
```

but make the value configurable.

Never allow an old compilation result to overwrite a newer one.

Example:

```text
compile #41
compile #42
compile #43

#42 finishes first
→ discard

#43 finishes
→ apply

#41 finishes
→ discard
```

---

# 15. Phase 11 — Diagnostics

## Agent: Diagnostics Engineer

### Objective

Create a unified diagnostic pipeline.

Diagnostics may originate from:

```text
BeastJS parser
BeastJS transformer
Octane parser
Octane compiler
module resolver
Web compiler
runtime
```

Normalize them into one format.

The UI should distinguish:

```text
ERROR
WARNING
INFO
RUNTIME ERROR
```

Clicking a diagnostic should navigate the editor to:

```text
file
line
column
```

---

# 16. Phase 12 — Preview UX

## Agent: Preview UX Engineer

### Objective

Make the preview feel like a real development environment.

Features:

* refresh
* restart runtime
* responsive viewport
* desktop/tablet/mobile presets
* zoom
* fullscreen
* loading state
* compilation error state
* runtime error state
* empty state

Preview states:

```text
IDLE
COMPILING
LOADING
READY
COMPILE_ERROR
RUNTIME_ERROR
```

Never show a blank iframe when something fails.

---

# 17. Phase 13 — Console

## Agent: Console Engineer

Capture:

```text
console.log
console.info
console.warn
console.error
uncaught exceptions
unhandled promise rejections
```

Send them from iframe to host:

```text
iframe
  │
  │ postMessage
  ▼
Console Store
  │
  ▼
Console Panel
```

Preserve:

* timestamp
* level
* arguments
* stack
* source location where available

---

# 18. Phase 14 — Source Maps

## Agent: Source Map Engineer

This is extremely important for a multi-stage compiler.

The user writes:

```text
BeastJS
```

but the browser executes:

```text
generated Web JS
```

Errors must ideally map:

```text
Browser runtime error
       ↓
generated JS
       ↓
Octane
       ↓
BeastJS
       ↓
App.beast:42:17
```

Implement source-map propagation across:

```text
BeastJS → Octane → Web
```

where practical.

Do not postpone the architectural design of this even if full support is implemented later.

---

# 19. Phase 15 — Performance

## Agent: Compiler Performance Engineer

Measure:

```text
editor change
→ worker request
→ BeastJS compile
→ Octane compile
→ Web compilation
→ preview update
```

Expose development metrics:

```text
BeastJS: 3.2ms
Octane: 5.8ms
Bundling: 4.1ms
Total: 13.1ms
```

Use incremental compilation where the compiler architecture permits.

Potential optimizations:

* AST caching
* module caching
* dependency graph caching
* unchanged-file skipping
* persistent worker
* compiler initialization caching
* runtime persistence

Do not optimize blindly.

Measure first.

---

# 20. Phase 16 — HMR

## Agent: HMR Engineer

Only begin this after basic preview updates work reliably.

Desired behavior:

```text
User edits Button.beast
        │
        ▼
compile Button
        │
        ▼
updated module
        │
        ▼
preview
        │
        ▼
replace Button
        │
        ▼
preserve application state
```

Do not reload the iframe for every source change.

HMR should eventually support:

```text
component replacement
style replacement
state preservation
error recovery
module disposal
```

---

# 21. Phase 17 — Persistence

## Agent: Persistence Engineer

Support local persistence.

Initially:

```text
localStorage / IndexedDB
```

Store:

```text
project files
active file
open tabs
editor settings
preview settings
```

Later support server-side projects.

---

# 22. Phase 18 — Shareable Projects

## Agent: Sharing Engineer

Design projects as serializable objects:

```ts
interface PlaygroundProject {
  version: number
  name: string
  entry: string
  files: Record<string, string>
  settings: PlaygroundSettings
}
```

This allows:

```text
Share
 ↓
serialize project
 ↓
URL / server
 ↓
open playground
 ↓
restore project
```

Do not couple serialization to the UI.

---

# 23. Phase 19 — Examples

## Agent: Example Library Engineer

Create official examples:

```text
hello-world
counter
components
props
state
events
styles
multiple-files
nested-components
async
advanced
```

Every example should be a real project in the virtual filesystem.

Avoid embedding examples directly inside UI components.

---

# 24. Phase 20 — Testing Strategy

## Agent: QA Engineer

Testing must happen at four levels.

### Unit tests

Test:

```text
parser
transformer
compiler
resolver
virtual FS
module loader
diagnostic mapper
```

### Compiler fixtures

Given:

```text
input BeastJS project
```

expect:

```text
Octane/Web output
```

### Integration tests

Test:

```text
editor
→ worker
→ compiler
→ preview
```

### Browser tests

Use a browser automation framework to test:

```text
open playground
type code
compile
preview
introduce error
fix error
multiple files
runtime error
reload
```

---

# 25. Security Requirements

The preview must be treated as untrusted code execution.

Never assume user code is safe.

Investigate:

```text
iframe sandbox
CSP
origin isolation
postMessage validation
module loading restrictions
network access
parent window access
cookie access
storage access
```

Do not expose privileged host APIs to preview code.

Validate all messages:

```ts
if (event.source !== previewWindow) {
  return
}
```

and validate message payloads.

---

# 26. Agent Task Format

Every implementation agent should receive tasks in this format:

```text
TASK

Objective:
<one concrete objective>

Context:
<why this exists>

Inspect:
<files/systems to inspect>

Requirements:
<precise requirements>

Constraints:
<what must not change>

API Contract:
<expected interface>

Implementation:
<expected implementation scope>

Tests:
<tests required>

Acceptance Criteria:
<observable conditions>

Deliverables:
<files/docs/code>

Do Not:
<explicit anti-patterns>

Report:
<what the agent must return>
```

---

# 27. Definition of Done

A task is not complete merely because the code compiles.

A task is complete when:

* implementation exists
* existing tests pass
* new behavior has tests
* API is documented
* errors are handled
* edge cases are considered
* no unrelated behavior was changed
* TypeScript/build checks pass
* performance regressions are considered
* acceptance criteria are demonstrably satisfied

---

# 28. Lead Agent Workflow

The lead agent should coordinate implementation in this order:

```text
1. Architecture Discovery
        ↓
2. Compiler Contracts
        ↓
3. Virtual Filesystem
        ↓
4. BeastJS Adapter
        ↓
5. Octane/Web Adapter
        ↓
6. Worker
        ↓
7. Preview Runtime
        ↓
8. Module Loader
        ↓
9. Editor
        ↓
10. Compilation Coordinator
        ↓
11. Diagnostics
        ↓
12. Console
        ↓
13. Source Maps
        ↓
14. Performance
        ↓
15. HMR
        ↓
16. Persistence
        ↓
17. Sharing
        ↓
18. Examples
        ↓
19. End-to-End Testing
        ↓
20. Production Hardening
```

Agents should not jump ahead unless the lead agent explicitly determines that a dependency is unnecessary.

---

# 29. Parallelization Strategy

The following work can be parallelized after architecture discovery:

```text
                    Architecture
                         │
              ┌──────────┼──────────┐
              ▼          ▼          ▼
        Virtual FS   Compiler API   Preview API
              │          │          │
              └──────────┼──────────┘
                         ▼
                 Compiler Adapters
                         │
              ┌──────────┴──────────┐
              ▼                     ▼
           Worker                Preview
              │                     │
              └──────────┬──────────┘
                         ▼
                  Playground Core
                         │
              ┌──────────┼──────────┐
              ▼          ▼          ▼
          Editor     Diagnostics   Console
              │          │          │
              └──────────┼──────────┘
                         ▼
                        HMR
                         │
                         ▼
                    Hardening
```

---

# 30. Important Architectural Decision

The playground should NOT become a second application framework.

It should be:

```text
                    PLAYGROUND
                        │
          ┌─────────────┴─────────────┐
          │                           │
       Frontend                 Compiler Worker
          │                           │
          │                    BeastJS Compiler
          │                           │
          │                    Octane Compiler
          │                           │
          │                    Web Bundler
          │                           │
          └─────────────┬─────────────┘
                        │
                   Preview iframe
```

The compiler remains the source of truth.

The playground only provides:

```text
editing
project management
compilation orchestration
diagnostics
preview
developer experience
```

---

# 31. Recommended Initial Milestone

Do NOT attempt the entire system first.

The first milestone should be:

## "Hello World Vertical Slice"

The user should be able to:

```text
1. Open playground
2. Edit App.beast
3. Save source in virtual FS
4. Send project to worker
5. BeastJS compiles to Octane
6. Octane compiles to Web
7. Preview receives output
8. Browser renders component
9. Syntax/compiler error appears in editor
10. Fix error
11. Preview updates
```

The complete path must work before adding:

```text
HMR
sharing
persistence
package management
advanced editor features
```

This vertical slice validates the architecture.

---

# 32. First Demonstration

The first successful demonstration should look approximately like:

```text
┌──────────────────────────────┬─────────────────────────────┐
│ App.beast                    │                             │
│                              │                             │
│ component App {              │        Hello World          │
│   <h1>Hello World</h1>       │                             │
│ }                            │                             │
│                              │                             │
└──────────────────────────────┴─────────────────────────────┘
│ BeastJS 2ms │ Octane 3ms │ Web 2ms │ Total 7ms             │
└──────────────────────────────────────────────────────────────┘
```

Then intentionally introduce:

```text
<h1>
```

without the corresponding closing syntax.

The editor should show a compiler diagnostic.

After fixing it, the preview should recover automatically.

This is the minimum proof that the complete architecture works.

---

# 33. Long-Term Architecture

Once mature, the platform should support:

```text
                    BeastJS Playground
                           │
          ┌────────────────┼────────────────┐
          │                │                │
        Editor          Compiler          Preview
          │                │                │
          │        ┌───────┴────────┐       │
          │        │                │       │
          │      BeastJS          Octane    │
          │        │                │       │
          │        └───────┬────────┘       │
          │                │                │
          │              Web                │
          │                │                │
          └────────────────┼────────────────┘
                           │
                     Developer Tools
                           │
          ┌────────────────┼────────────────┐
          │                │                │
        Console        Diagnostics       Network
          │                │                │
          └────────────────┼────────────────┘
                           │
                     Project System
                           │
          ┌────────────────┼────────────────┐
          │                │                │
       Persistence       Sharing         Examples
```

The architecture should leave room for:

* TypeScript integration
* package/dependency resolution
* npm-compatible packages
* source maps
* debugger integration
* network inspection
* component inspector
* state inspector
* performance profiling
* collaborative editing
* cloud projects
* public examples
* embeddable playgrounds

---

# 34. Final Agent Principle

Every agent should optimize for this question:

> "Does this make the BeastJS → Octane → Web pipeline easier to compile, observe, test, debug, and eventually run in production?"

Avoid optimizing only for the playground.

The playground is the first major consumer of the compiler architecture.

If the playground requires special compiler behavior, first question whether the underlying compiler API is missing an abstraction that should exist for all consumers.

I would use this as the **master specification**, and then have a lead LLM agent turn each numbered phase into individual implementation tickets.

