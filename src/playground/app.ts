import type { CompilationResult, Diagnostic } from './contracts';
import { CompilationCoordinator } from './coordinator';
import { ProjectEditor } from './editor';
import { helloWorld } from './examples';
import { Preview } from './preview';
import { normalizePath, VirtualFileSystem } from './virtual-fs';
import { canNavigateRuntimeLocation, type RuntimeStackFrame } from './runtime-diagnostics';
import { readEditorKeymap, writeEditorKeymap } from './editor-preferences';

export function mountPlayground(): () => void {
  const element = <T extends HTMLElement>(id: string) => {
    const node = document.getElementById(id);
    if (!node) throw new Error(`Missing playground element: ${id}`);
    return node as T;
  };
  const abort = new AbortController();
  const listen = (target: EventTarget, type: string, handler: EventListener) => target.addEventListener(type, handler, { signal: abort.signal });
  const fs = new VirtualFileSystem(helloWorld.files);
  let activeFile = '/src/App.btsx';
  let lastResult: CompilationResult | undefined;
  let diagnostics: Diagnostic[] = [];
  let outputStage = 'octane';
  let hasPreview = false;
  let previewFailed = false;
  let compileFailed = false;
  let editorKeymap = readEditorKeymap();
  const consoleEntries: { level: string; message: string; timestamp: number; frames?: RuntimeStackFrame[] }[] = [];
  const project = () => ({ files: fs.snapshot(), entry: helloWorld.entry });
  const status = (text: string, error = false) => {
    element('build-status').textContent = text;
    element('build-dot').style.background = error ? '#dd9a83' : '#adc68b';
  };
  const showPanel = (panel: string) => {
    for (const button of document.querySelectorAll<HTMLButtonElement>('.tool-tab')) {
      const selected = button.dataset.panel === panel;
      button.classList.toggle('active', selected);
      button.setAttribute('aria-selected', String(selected));
      button.tabIndex = selected ? 0 : -1;
    }
    for (const id of ['problems', 'console', 'output']) element(`${id}-panel`).hidden = panel !== id;
    element('clear-console').hidden = panel !== 'console';
  };
  const output = () => {
    element('generated-code').textContent = outputStage === 'octane'
      ? lastResult?.intermediate[activeFile] ?? 'No Beast transform for this file. Select a .btsx component.'
      : lastResult?.modules.find(module => module.source === activeFile)?.code ?? 'No generated JavaScript for this file.';
  };
  const appendConsole = (level: string, message: string, timestamp = Date.now(), frames?: RuntimeStackFrame[]) => {
    consoleEntries.push({ level, message, timestamp, frames });
    if (consoleEntries.length > 200) consoleEntries.shift();
    renderConsole();
  };
  const renderConsole = () => {
    const list = element('console-list');
    list.replaceChildren();
    element('console-count').textContent = String(consoleEntries.length);
    if (!consoleEntries.length) { list.textContent = 'Console output from your application appears here.'; return; }
    for (const entry of consoleEntries) {
      const row = document.createElement('div');
      row.className = 'console-row';
      row.dataset.level = entry.level;
      for (const [className, text] of [['console-time', new Date(entry.timestamp).toLocaleTimeString('en-GB')], ['console-level', entry.level]]) {
        const span = document.createElement('span');
        span.className = className;
        span.textContent = text;
        row.append(span);
      }
      const body = document.createElement('div');
      body.className = 'console-body';
      const message = document.createElement('div');
      message.className = 'console-message';
      message.textContent = entry.message;
      body.append(message);
      if (entry.frames?.length) {
        const frames = document.createElement('div');
        frames.className = 'runtime-stack';
        for (const frame of entry.frames) {
          const location = frame.location;
          if (location) {
            const link = document.createElement('button');
            link.type = 'button';
            link.className = 'runtime-source-link';
            const label = `${location.file.replace(/^\/src\//, '')}:${location.position.line}:${location.position.column}`;
            link.disabled = !canNavigateRuntimeLocation(location, fs.read(location.file));
            link.textContent = `${label}${link.disabled ? ' (source changed)' : ''}`;
            link.title = link.disabled ? 'This stack frame belongs to an older version of the file.' : `Open ${label}`;
            link.onclick = () => {
              // Recheck on activation: the file may have changed since the row rendered.
              if (!canNavigateRuntimeLocation(location, fs.read(location.file))) { renderConsole(); return; }
              openFile(location.file);
              editor.focus(location.position);
            };
            frames.append(link);
          } else {
            const raw = document.createElement('div');
            raw.className = 'runtime-frame-unmapped';
            raw.textContent = frame.raw;
            frames.append(raw);
          }
        }
        body.append(frames);
      }
      row.append(body);
      list.append(row);
    }
  };
  const preview = new Preview(element<HTMLIFrameElement>('preview-frame'), event => {
    if (event.type === 'rendered' && !previewFailed) {
      hasPreview = true;
      element('preview-overlay').hidden = true;
      element('preview-status').textContent = compileFailed ? 'Last successful build' : 'Live';
    }
    if (event.type === 'runtime-error') {
      previewFailed = true;
      element('preview-overlay').hidden = true;
      element('preview-error').hidden = false;
      element('preview-error').textContent = event.message!;
      element('preview-status').textContent = 'Runtime error';
      status('Runtime error', true);
      appendConsole('error', event.message!, Date.now(), event.frames);
      const location = event.frames?.find(frame => frame.location && canNavigateRuntimeLocation(frame.location, fs.read(frame.location.file)))?.location;
      if (location) {
        diagnostics = [...diagnostics.filter(d => d.source !== 'runtime'), {
          file: location.file, source: 'runtime', severity: 'error', message: event.message!, start: location.position,
        }];
        renderDiagnostics();
      }
      showPanel('console');
    }
    if (event.type === 'console') appendConsole(event.level!, event.args!.join(' '), event.timestamp);
  });
  const renderDiagnostics = () => {
    element('problem-count').textContent = String(diagnostics.length);
    const list = element('problems-list');
    list.replaceChildren();
    if (!diagnostics.length) {
      const message = document.createElement('div');
      message.className = 'empty-problems';
      message.textContent = lastResult ? '✓  Looking good. No compiler problems.' : 'Preparing the first build…';
      const caption = document.createElement('p');
      caption.className = 'empty-caption';
      caption.textContent = 'Diagnostics from Beast, Octane, and module resolution appear here.';
      list.append(message, caption);
    }
    for (const diagnostic of diagnostics) {
      const button = document.createElement('button');
      button.className = 'diagnostic-row';
      button.type = 'button';
      const location = document.createElement('span');
      location.className = 'diagnostic-location';
      location.textContent = `${diagnostic.file.replace('/src/', '')}:${diagnostic.start.line}:${diagnostic.start.column}`;
      const message = document.createElement('span');
      message.textContent = `${diagnostic.severity.toUpperCase()} · ${diagnostic.source} · ${diagnostic.message}`;
      button.append(location, message);
      button.onclick = () => { if (fs.exists(diagnostic.file)) { openFile(diagnostic.file); editor.focus(diagnostic.start); } };
      list.append(button);
    }
    editor.setDiagnostics(diagnostics);
  };
  const onCompileError = () => {
    compileFailed = true;
    status('Build failed', true);
    element('preview-status').textContent = hasPreview ? 'Last successful build' : 'Build failed';
    element('preview-error').hidden = false;
    element('preview-error').textContent = hasPreview ? 'Build failed. Showing the last successful preview.' : 'Fix the compiler problem to start the preview.';
    if (!hasPreview) {
      element('preview-overlay').querySelector('strong')!.textContent = 'Your code needs a small fix';
      element('preview-overlay').querySelector('p')!.textContent = 'Open a problem below to jump to its source. The preview will recover when you fix it.';
    }
    showPanel('problems');
  };
  const coordinator = new CompilationCoordinator({
    createWorker: () => new Worker(new URL('./compiler.worker.ts', import.meta.url), { type: 'module' }),
    onStart: () => { status('Compiling…'); element('preview-status').textContent = 'Compiling'; },
    onResult: result => {
      lastResult = result;
      diagnostics = result.diagnostics;
      renderDiagnostics();
      output();
      const timing = result.metadata.timings;
      const stages = element('stage-timings');
      stages.replaceChildren();
      for (const [label, value] of [['Beast', timing.beast], ['Octane', timing.octane], ['Web', timing.web]] as const) {
        const span = document.createElement('span');
        span.textContent = `${label} ${value.toFixed(1)}ms`;
        stages.append(span);
      }
      element('build-summary').textContent = `${result.metadata.transformedFiles} components · ${result.metadata.duration.toFixed(0)}ms total`;
      if (result.entry && !diagnostics.some(d => d.severity === 'error')) {
        compileFailed = false;
        previewFailed = false;
        element('preview-error').hidden = true;
        element('preview-status').textContent = 'Loading';
        status(`Compiled in ${result.metadata.duration.toFixed(0)}ms`);
        preview.load(result);
      } else onCompileError();
    },
    onError: message => {
      diagnostics = [{ file: activeFile, message, severity: 'error', source: 'web', start: { line: 1, column: 1 } }];
      renderDiagnostics();
      onCompileError();
    },
  });
  const run = () => coordinator.schedule(project(), true);
  const editor = new ProjectEditor(element('editor'), (path, source) => {
    fs.write(path, source);
    status('Changes pending…');
    diagnostics = [];
    // Clear obsolete markers after the current CodeMirror update finishes.
    queueMicrotask(() => { if (!abort.signal.aborted) renderDiagnostics(); });
    renderConsole();
    coordinator.schedule(project());
  }, run, editorKeymap);
  const renderKeymap = () => {
    const button = element<HTMLButtonElement>('vim-toggle');
    button.setAttribute('aria-pressed', String(editorKeymap === 'vim'));
    button.title = editorKeymap === 'vim' ? 'Disable Vim keybindings' : 'Enable Vim keybindings';
    element('editor').dataset.keymap = editorKeymap;
    document.querySelector<HTMLElement>('.editor-hint')!.textContent = editorKeymap === 'vim'
      ? 'i to insert · Esc for normal · :w to run' : '⌘ ↵ to run · edits compile automatically';
  };
  const icon = (path: string) => path.endsWith('.btsx') ? 'B' : path.endsWith('.css') ? '#' : 'TS';
  const renderFiles = () => {
    const files = element('file-list');
    const tabs = element('editor-tabs');
    files.replaceChildren();
    tabs.replaceChildren();
    for (const path of fs.list()) {
      const label = path.replace(/^\/src\//, '');
      const row = document.createElement('div');
      row.className = `file-row${activeFile === path ? ' active' : ''}`;
      const button = document.createElement('button');
      button.className = 'file-button';
      button.type = 'button';
      button.title = path;
      button.setAttribute('aria-label', `Open ${label}`);
      const symbol = document.createElement('span');
      symbol.className = 'file-icon';
      symbol.textContent = icon(path);
      const name = document.createElement('span');
      name.textContent = label;
      button.append(symbol, name);
      button.onclick = () => openFile(path);
      row.append(button);
      if (path !== helloWorld.entry) {
        const remove = document.createElement('button');
        remove.type = 'button';
        remove.className = 'file-delete';
        remove.textContent = '×';
        remove.setAttribute('aria-label', `Delete ${label}`);
        remove.onclick = () => {
          fs.delete(path);
          if (activeFile === path) openFile(fs.list()[0]);
          editor.forget(path);
          renderFiles();
          renderConsole();
          coordinator.schedule(project());
        };
        row.append(remove);
      }
      files.append(row);
      const tab = document.createElement('button');
      tab.type = 'button';
      tab.className = `editor-tab${activeFile === path ? ' active' : ''}`;
      tab.textContent = label;
      tab.setAttribute('role', 'tab');
      tab.setAttribute('aria-selected', String(activeFile === path));
      tab.tabIndex = activeFile === path ? 0 : -1;
      tab.setAttribute('aria-controls', 'editor');
      tab.onclick = () => openFile(path);
      tabs.append(tab);
    }
  };
  const openFile = (path: string) => {
    activeFile = path;
    editor.open(path, fs.read(path)!);
    element('active-filename').textContent = path.replace(/^\/src\//, '');
    element('editor-file-info').textContent = path.split('.').at(-1)!.toUpperCase();
    element('language-label').textContent = path.endsWith('.btsx') ? 'Beast' : path.endsWith('.css') ? 'CSS' : 'TypeScript';
    renderFiles();
    output();
  };
  listen(element('run-build'), 'click', run);
  listen(element('vim-toggle'), 'click', () => {
    editorKeymap = editorKeymap === 'vim' ? 'default' : 'vim';
    editor.setKeymap(editorKeymap);
    writeEditorKeymap(editorKeymap);
    renderKeymap();
    editor.focus();
  });
  listen(element('reload-preview'), 'click', () => {
    previewFailed = false;
    element('preview-error').hidden = true;
    element('preview-status').textContent = 'Loading';
    preview.reload();
  });
  listen(element('clear-console'), 'click', () => { consoleEntries.length = 0; renderConsole(); });
  for (const button of document.querySelectorAll<HTMLButtonElement>('.tool-tab')) listen(button, 'click', () => showPanel(button.dataset.panel!));
  for (const button of document.querySelectorAll<HTMLButtonElement>('.output-stage')) listen(button, 'click', () => {
    outputStage = button.dataset.stage!;
    document.querySelectorAll<HTMLButtonElement>('.output-stage').forEach(node => node.classList.toggle('active', node === button));
    output();
  });
  for (const button of document.querySelectorAll<HTMLButtonElement>('.viewport-button')) listen(button, 'click', () => {
    element('preview-frame').style.width = button.dataset.width!;
    document.querySelectorAll<HTMLButtonElement>('.viewport-button').forEach(node => {
      node.classList.toggle('active', node === button);
      node.setAttribute('aria-pressed', String(node === button));
    });
  });
  listen(element('add-file'), 'click', () => { element('new-file-form').hidden = false; element('new-file-name').focus(); });
  listen(element('cancel-file'), 'click', () => { element('new-file-form').hidden = true; element('file-error').hidden = true; });
  listen(element('new-file-form'), 'submit', event => {
    event.preventDefault();
    try {
      const input = element<HTMLInputElement>('new-file-name');
      const path = normalizePath(input.value.startsWith('/') ? input.value : `/${input.value.startsWith('src/') ? '' : 'src/'}${input.value}`);
      if (!/\.(btsx|tsrx|ts|js|json|css)$/.test(path)) throw new Error('Use .btsx, .tsrx, .ts, .js, .json, or .css.');
      if (fs.exists(path)) throw new Error('That file already exists.');
      fs.write(path, path.endsWith('.btsx') ? 'p A new component\n' : path.endsWith('.json') ? '{}\n' : '');
      openFile(path);
      editor.focus();
      input.value = '';
      element('new-file-form').hidden = true;
      element('file-error').hidden = true;
      coordinator.schedule(project());
    } catch (error) {
      element('file-error').textContent = error instanceof Error ? error.message : String(error);
      element('file-error').hidden = false;
    }
  });
  // Roving keyboard focus for both tab strips.
  for (const strip of [element('editor-tabs'), document.querySelector('.tools-tabs')!]) listen(strip, 'keydown', event => {
    const key = (event as KeyboardEvent).key;
    if (!['ArrowRight', 'ArrowLeft', 'Home', 'End'].includes(key)) return;
    const tabs = Array.from(strip.querySelectorAll<HTMLButtonElement>('[role="tab"]'));
    const current = tabs.indexOf(document.activeElement as HTMLButtonElement);
    if (current < 0) return;
    event.preventDefault();
    const next = key === 'Home' ? 0 : key === 'End' ? tabs.length - 1 : (current + (key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
    tabs[next].click();
    // File tab nodes are replaced during selection.
    strip.querySelectorAll<HTMLButtonElement>('[role="tab"]')[next]?.focus();
  });
  openFile(activeFile);
  renderKeymap();
  renderDiagnostics();
  renderConsole();
  showPanel('problems');
  run();
  return () => { abort.abort(); coordinator.dispose(); preview.dispose(); editor.dispose(); };
}
