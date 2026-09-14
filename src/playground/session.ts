import { verifyProject } from './verify-project';
import type { CompilationProject, CompilationResult, Diagnostic, Position } from './contracts';
import { CompilationCoordinator, type CompilerWorker } from './coordinator';
import type { EditorKeymap } from './editor-preferences';
import { DEFAULT_EDITOR_THEME, type EditorThemeId } from './editor-themes';
import { PlaygroundProject } from './project';
import type { ResolvedPreviewEvent } from './preview';
import { canNavigateRuntimeLocation, type RuntimeStackFrame } from './runtime-diagnostics';
import type { PreviewWidth, SavedWorkspace, SaveStatus } from './project-storage';
import type { Theme } from './theme';

export type ToolPanel = 'problems' | 'console' | 'output';
export interface ConsoleEntry {
  id: number;
  level: string;
  message: string;
  timestamp: number;
  frames?: RuntimeStackFrame[];
}
export interface SessionSnapshot {
  project: CompilationProject;
  activeFile: string;
  projectGeneration: number;
  previewWidth: PreviewWidth;
  saveStatus: SaveStatus;
  diagnostics: Diagnostic[];
  console: ConsoleEntry[];
  keymap: EditorKeymap;
  theme: Theme;
  editorTheme: EditorThemeId;
  lineNumbers: boolean;
  toolPanel: ToolPanel;
  buildStatus: string;
  buildError: boolean;
  lastResult?: CompilationResult;
  previewMode: 'local' | 'hosted';
  previewStatus: string;
  previewError: string;
  hasPreview: boolean;
  compileFailed: boolean;
  previewFailed: boolean;
  previewBuild?: { revision: number; result: CompilationResult; forceReload?: boolean };
  editorFocus?: { revision: number; position?: Position };
}

/** One project lifetime. Views subscribe; neither pane visibility nor DOM belongs here. */
export class PlaygroundSession {
  private project: PlaygroundProject;
  private coordinator: CompilationCoordinator;
  private listeners = new Set<() => void>();
  private state: SessionSnapshot;
  private sequence = 0;
  private disposed = false;
  private started = false;
  private proposalChecks = new Set<AbortController>();
  private disconnectPersistence?: () => void;

  constructor(private options: {
    project: CompilationProject;
    activeFile?: string;
    previewWidth?: PreviewWidth;
    saveStatus?: SaveStatus;
    connectPersistence?: (session: PlaygroundSession) => () => void;
    createWorker: () => CompilerWorker;
    keymap?: EditorKeymap;
    theme?: Theme;
    persistTheme?: (theme: Theme) => void;
    persistKeymap?: (keymap: EditorKeymap) => void;
    editorTheme?: EditorThemeId;
    persistEditorTheme?: (theme: EditorThemeId) => void;
    lineNumbers?: boolean;
    persistLineNumbers?: (visible: boolean) => void;
    debounce?: number;
  }) {
    this.project = new PlaygroundProject(options.project);
    if (options.activeFile) this.project.open(options.activeFile);
    this.state = {
      project: this.project.snapshot(), activeFile: this.project.activeFile,
      projectGeneration: 0, previewWidth: options.previewWidth ?? '100%',
      saveStatus: options.saveStatus ?? { label: 'Not saved yet' },
      diagnostics: [], console: [], keymap: options.keymap ?? 'default', toolPanel: 'problems',
      theme: options.theme ?? 'dark', editorTheme: options.editorTheme ?? DEFAULT_EDITOR_THEME,
      lineNumbers: options.lineNumbers ?? true,
      buildStatus: 'Initializing compiler', buildError: false, previewMode: 'local', previewStatus: 'Starting',
      previewError: '', hasPreview: false, compileFailed: false, previewFailed: false,
    };
    this.coordinator = new CompilationCoordinator({
      createWorker: options.createWorker, debounce: options.debounce,
      onStart: () => this.patch({ buildStatus: 'Compiling…', buildError: false, previewStatus: 'Compiling' }),
      onResult: result => {
        if (result.entry && !result.diagnostics.some(d => d.severity === 'error')) {
          this.patch({ lastResult: result, diagnostics: result.diagnostics, compileFailed: false,
            previewFailed: false, previewError: '', previewStatus: 'Loading', buildError: false,
            buildStatus: `Compiled in ${result.metadata.duration.toFixed(0)}ms`,
            previewBuild: { revision: ++this.sequence, result } });
        } else this.compileError(result.diagnostics, result);
      },
      onError: message => this.compileError([
        { file: this.state.activeFile, message, severity: 'error', source: 'web', start: { line: 1, column: 1 } },
      ]),
    });
  }

  getSnapshot = () => this.state;
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  };
  private patch(patch: Partial<SessionSnapshot>) {
    if (this.disposed) return;
    this.state = { ...this.state, ...patch };
    for (const listener of this.listeners) listener();
  }
  start() {
    if (this.started || this.disposed) return;
    this.started = true;
    this.disconnectPersistence = this.options.connectPersistence?.(this);
    this.run();
  }
  setSaveStatus = (saveStatus: SaveStatus) => this.patch({ saveStatus });
  setPreviewWidth = (previewWidth: PreviewWidth) => this.patch({ previewWidth });
  exportWorkspace = (): SavedWorkspace => ({ version: 1, project: this.state.project,
    activeFile: this.state.activeFile, preview: { width: this.state.previewWidth } });
  importWorkspace = (workspace: SavedWorkspace) => this.replaceProject(workspace.project, workspace.activeFile, workspace.preview.width);
  resetProject(project: CompilationProject) {
    this.replaceProject(project);
  }
  private replaceProject(project: CompilationProject, activeFile?: string, previewWidth: PreviewWidth = '100%') {
    this.project = new PlaygroundProject(project);
    if (activeFile) this.project.open(activeFile);
    this.patch({ project: this.project.snapshot(), activeFile: this.project.activeFile,
      projectGeneration: this.state.projectGeneration + 1, previewWidth,
      diagnostics: [], console: [], toolPanel: 'problems', lastResult: undefined,
      buildStatus: 'Changes pending…', buildError: false, previewStatus: 'Starting',
      previewError: '', hasPreview: false, compileFailed: false, previewFailed: false,
      previewBuild: undefined, editorFocus: { revision: ++this.sequence } });
    this.run();
  }
  run = () => this.coordinator.schedule(this.project.snapshot(), true);
  read = (path: string) => this.project.fs.read(path);
  openFile(path: string, position?: Position, focus = false) {
    if (!this.project.open(path)) return;
    this.patch({ activeFile: this.project.activeFile,
      ...(focus ? { editorFocus: { revision: ++this.sequence, position } } : {}) });
  }
  async applyRecommendation(file: string, original: string, source: string, generation: number, signal: AbortSignal) {
    const before = this.state;
    if (this.disposed || signal.aborted) throw new Error('Verification cancelled. No files changed.');
    if (before.projectGeneration !== generation || this.read(file) !== original) {
      throw new Error('The file or project changed since this response. Ask for a fresh recommendation.');
    }
    const abort = new AbortController();
    const cancel = () => abort.abort();
    signal.addEventListener('abort', cancel, { once: true });
    this.proposalChecks.add(abort);
    try {
      await verifyProject({ ...before.project, files: { ...before.project.files, [file]: source } }, file, this.options.createWorker, abort.signal);
      if (abort.signal.aborted || this.disposed) throw new Error('Verification cancelled. No files changed.');
      if (this.state.project !== before.project || this.state.projectGeneration !== generation) {
        throw new Error('The project changed during verification. No files changed; ask for a fresh recommendation.');
      }
      this.updateSource(file, source);
      this.openFile(file, undefined, true);
      this.run();
    } finally {
      signal.removeEventListener('abort', cancel);
      this.proposalChecks.delete(abort);
    }
  }
  updateSource = (path: string, source: string) => {
    if (!this.project.fs.exists(path) || this.project.fs.read(path) === source) return;
    this.project.fs.write(path, source);
    this.projectChanged();
  };
  validateNewFile = (name: string) => {
    try { this.project.newFilePath(name); return undefined; }
    catch (error) { return error instanceof Error ? error.message : String(error); }
  };
  addFile(name: string) {
    const path = this.project.add(name);
    this.projectChanged({ editorFocus: { revision: ++this.sequence } });
    return path;
  }
  /** Creates or overwrites several files as one change, then opens `open` in the editor. */
  writeFiles(files: Record<string, string>, open?: string) {
    const changed = Object.entries(files).filter(([path, source]) => this.project.fs.read(path) !== source);
    if (!changed.length) { if (open) this.openFile(open, undefined, true); return; }
    for (const [path, source] of changed) this.project.fs.write(path, source);
    if (open) this.project.open(open);
    this.projectChanged({ editorFocus: { revision: ++this.sequence } });
  }
  deleteFile(path: string) {
    if (this.project.remove(path)) this.projectChanged();
  }
  private projectChanged(extra: Partial<SessionSnapshot> = {}) {
    this.patch({ project: this.project.snapshot(), activeFile: this.project.activeFile,
      diagnostics: [], buildStatus: 'Changes pending…', buildError: false, ...extra });
    this.coordinator.schedule(this.project.snapshot());
  }
  toggleKeymap = () => {
    const keymap = this.state.keymap === 'vim' ? 'default' : 'vim';
    this.options.persistKeymap?.(keymap);
    this.patch({ keymap, editorFocus: { revision: ++this.sequence } });
  };
  setTheme = (theme: Theme) => {
    if (theme === this.state.theme) return;
    this.options.persistTheme?.(theme);
    this.patch({ theme });
  };
  toggleLineNumbers = () => {
    const lineNumbers = !this.state.lineNumbers;
    this.options.persistLineNumbers?.(lineNumbers);
    this.patch({ lineNumbers });
  };
  setEditorTheme = (editorTheme: EditorThemeId) => {
    if (editorTheme === this.state.editorTheme) return;
    this.options.persistEditorTheme?.(editorTheme);
    this.patch({ editorTheme });
  };
  toggleTheme = () => this.setTheme(this.state.theme === 'dark' ? 'light' : 'dark');
  selectTool = (toolPanel: ToolPanel) => this.patch({ toolPanel });
  clearConsole = () => this.patch({ console: [] });
  setPreviewMode = (mode: 'local' | 'hosted') => {
    if (mode !== this.state.previewMode) this.restartPreview(mode);
  };
  reloadPreview = () => this.restartPreview();
  private restartPreview(previewMode = this.state.previewMode) {
    if (!this.state.previewBuild) { this.patch({ previewMode }); return; }
    this.patch({ previewMode, previewFailed: false, previewError: '', previewStatus: 'Loading', hasPreview: false,
      buildError: this.state.compileFailed,
      buildStatus: this.state.compileFailed ? this.state.buildStatus : `Compiled in ${this.state.previewBuild.result.metadata.duration.toFixed(0)}ms`,
      diagnostics: this.state.diagnostics.filter(diagnostic => diagnostic.source !== 'runtime'),
      previewBuild: { ...this.state.previewBuild, revision: ++this.sequence, forceReload: true } });
  }
  private compileError(diagnostics: Diagnostic[], result = this.state.lastResult) {
    this.patch({ diagnostics, lastResult: result, compileFailed: true, buildError: true,
      buildStatus: 'Build failed', toolPanel: 'problems',
      previewStatus: this.state.hasPreview ? 'Last successful build' : 'Build failed',
      previewError: this.state.hasPreview ? 'Build failed. Showing the last successful preview.'
        : 'Fix the compiler problem to start the preview.' });
  }
  private appendConsole(level: string, message: string, timestamp = Date.now(), frames?: RuntimeStackFrame[]) {
    return [...this.state.console, { id: ++this.sequence, level, message, timestamp, frames }].slice(-200);
  }
  handlePreviewEvent = (event: ResolvedPreviewEvent) => {
    if (event.type === 'rendered' && !this.state.previewFailed) {
      this.patch({ hasPreview: true, previewStatus: this.state.compileFailed ? 'Last successful build' : event.update === 'hot' ? 'Live · HMR' : 'Live' });
    } else if (event.type === 'runtime-error') {
      const location = event.frames?.find(frame => frame.location && canNavigateRuntimeLocation(frame.location, this.read(frame.location.file)))?.location;
      this.patch({ previewFailed: true, previewError: event.message!, previewStatus: 'Runtime error',
        buildError: true, buildStatus: 'Runtime error', toolPanel: 'console',
        console: this.appendConsole('error', event.message!, Date.now(), event.frames),
        diagnostics: location ? [...this.state.diagnostics.filter(d => d.source !== 'runtime'), {
          file: location.file, source: 'runtime', severity: 'error', message: event.message!, start: location.position,
        }] : this.state.diagnostics });
    } else if (event.type === 'console') {
      this.patch({ console: this.appendConsole(event.level!, event.args!.join(' '), event.timestamp) });
    }
  };
  dispose() {
    for (const check of this.proposalChecks) check.abort();
    this.proposalChecks.clear();
    this.disconnectPersistence?.();
    this.disconnectPersistence = undefined;
    this.disposed = true;
    this.coordinator.dispose();
    this.listeners.clear();
  }
}
