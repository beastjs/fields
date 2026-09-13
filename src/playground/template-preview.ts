import type { CompilerWorker } from './coordinator';
import { PROTOCOL_VERSION, type CompilationProject, type WorkerResponse } from './contracts';
import { Preview } from './preview';
import type { Theme } from './theme';

export type TemplatePreviewStatus = { state: 'compiling' | 'ready' } | { state: 'error'; message: string };

/** Compiles one read-only project at a time into a sandboxed iframe; stale results are dropped. */
export class TemplatePreview {
  private worker: CompilerWorker;
  private preview: Preview;
  private request = 0;

  constructor(iframe: HTMLIFrameElement, theme: Theme, createWorker: () => CompilerWorker, private onStatus: (status: TemplatePreviewStatus) => void) {
    this.preview = new Preview(iframe, event => {
      if (event.type === 'rendered') this.onStatus({ state: 'ready' });
      else if (event.type === 'runtime-error') this.onStatus({ state: 'error', message: event.message ?? 'The preview failed to start.' });
    }, theme);
    this.worker = createWorker();
    this.worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
      if (event.data?.type !== 'compile-result' || event.data.id !== this.request) return;
      const { result } = event.data;
      const error = result.diagnostics.find(diagnostic => diagnostic.severity === 'error');
      if (!result.entry || error) this.onStatus({ state: 'error', message: error?.message ?? 'The template did not compile.' });
      else this.preview.load(result, true);
    };
    this.worker.onerror = () => this.onStatus({ state: 'error', message: 'The template compiler stopped unexpectedly.' });
  }

  show(project: CompilationProject) {
    this.onStatus({ state: 'compiling' });
    this.worker.postMessage({ version: PROTOCOL_VERSION, type: 'compile', id: ++this.request, project });
  }

  setTheme(theme: Theme) { this.preview.setTheme(theme); }

  dispose() {
    this.request++;
    this.worker.terminate();
    this.preview.dispose();
  }
}
