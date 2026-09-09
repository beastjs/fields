import { PROTOCOL_VERSION, type CompilationProject, type CompilationResult, type WorkerResponse } from './contracts';

export interface CompilerWorker {
  postMessage(message: unknown): void;
  terminate(): void;
  onmessage: ((event: MessageEvent<WorkerResponse>) => void) | null;
  onerror: ((event: ErrorEvent) => void) | null;
}

/** Revisions advance on edits, before debounce, so even pending edits reject old builds. */
export class CompilationCoordinator {
  private revision = 0;
  private timer?: ReturnType<typeof setTimeout>;
  private worker?: CompilerWorker;
  private busy = false;
  private disposed = false;
  private timeout?: ReturnType<typeof setTimeout>;

  constructor(private options: {
    createWorker: () => CompilerWorker;
    onStart: () => void;
    onResult: (result: CompilationResult, revision: number) => void;
    onError: (message: string) => void;
    debounce?: number;
  }) {}

  schedule(project: CompilationProject, immediate = false) {
    if (this.disposed) return;
    const revision = ++this.revision;
    clearTimeout(this.timer);
    clearTimeout(this.timeout);
    // Compilers are synchronous: terminating is the only actual mid-compile cancellation.
    if (this.busy) this.stopWorker();
    const snapshot = { entry: project.entry, files: { ...project.files } };
    this.timer = setTimeout(() => this.run(snapshot, revision), immediate ? 0 : (this.options.debounce ?? 220));
  }

  private run(project: CompilationProject, revision: number) {
    if (this.disposed || revision !== this.revision) return;
    try {
      this.worker ??= this.options.createWorker();
      const worker = this.worker;
      this.busy = true;
      this.options.onStart();
      worker.onmessage = event => {
        const message = event.data;
        if (worker !== this.worker || revision !== this.revision || message?.version !== PROTOCOL_VERSION ||
            message.type !== 'compile-result' || message.id !== revision) return;
        clearTimeout(this.timeout);
        this.busy = false;
        this.options.onResult(message.result, revision);
      };
      worker.onerror = event => {
        event.preventDefault?.();
        if (worker !== this.worker || revision !== this.revision) return;
        this.stopWorker();
        this.options.onError(event.message || 'Compiler worker stopped. Run to restart.');
      };
      this.timeout = setTimeout(() => {
        if (revision !== this.revision) return;
        this.stopWorker();
        this.options.onError('Compilation timed out. Run to restart the compiler.');
      }, 15000);
      worker.postMessage({ version: PROTOCOL_VERSION, type: 'compile', id: revision, project });
    } catch (error) {
      this.stopWorker();
      this.options.onError(error instanceof Error ? error.message : String(error));
    }
  }

  private stopWorker() {
    clearTimeout(this.timeout);
    this.worker?.terminate();
    this.worker = undefined;
    this.busy = false;
  }
  dispose() { this.disposed = true; ++this.revision; clearTimeout(this.timer); this.stopWorker(); }
}
