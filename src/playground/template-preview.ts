import type { CompilerWorker } from './coordinator';
import { PROTOCOL_VERSION, type CompilationProject, type CompilationResult, type WorkerResponse } from './contracts';
import { Preview, type ResolvedPreviewEvent } from './preview';
import type { Theme } from './theme';

export type TemplatePreviewStatus = { state: 'compiling' | 'ready' } | { state: 'error'; message: string };
type Reveal = { selector: string; highlight: boolean };

/**
 * Compiles one read-only project at a time into sandboxed iframes; stale results are dropped.
 *
 * Given two frames, a build that cannot update the visible app in place renders in the hidden frame, scrolls to its
 * reveal target there, and swaps in once painted, so a reload never flashes an empty document. The page marks the
 * visible frame with `data-front="true"`; the other is inert and should be styled invisible (but still rendered).
 */
export class TemplatePreview {
  private worker: CompilerWorker;
  private previews: Preview[];
  private front = 0;
  private incoming?: number;
  private request = 0;
  private pendingReveal?: Reveal;
  /** When true, compatible rebuilds update the running app in place instead of reloading it. */
  hot = false;

  constructor(private frames: HTMLIFrameElement[], theme: Theme, createWorker: () => CompilerWorker, private onStatus: (status: TemplatePreviewStatus) => void, private title = 'Preview') {
    this.previews = frames.map((frame, index) => new Preview(frame, event => this.receive(index, event), theme));
    this.present();
    this.worker = createWorker();
    this.worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
      if (event.data?.type !== 'compile-result' || event.data.id !== this.request) return;
      const { result } = event.data;
      const error = result.diagnostics.find(diagnostic => diagnostic.severity === 'error');
      if (!result.entry || error) this.onStatus({ state: 'error', message: error?.message ?? 'The template did not compile.' });
      else this.load(result);
    };
    this.worker.onerror = () => this.onStatus({ state: 'error', message: 'The template compiler stopped unexpectedly.' });
  }

  /** Compiles and shows `project`; `reveal` scrolls to an element once that build has rendered. */
  show(project: CompilationProject, reveal?: { selector: string; highlight?: boolean }) {
    this.pendingReveal = reveal && { selector: reveal.selector, highlight: reveal.highlight ?? false };
    this.onStatus({ state: 'compiling' });
    this.worker.postMessage({ version: PROTOCOL_VERSION, type: 'compile', id: ++this.request, project });
  }

  reveal(selector: string, highlight = false) { this.previews[this.front].reveal(selector, highlight); }

  setTheme(theme: Theme) { for (const preview of this.previews) preview.setTheme(theme); }

  dispose() {
    this.request++;
    this.worker.terminate();
    for (const preview of this.previews) preview.dispose();
  }

  private load(result: CompilationResult) {
    const front = this.previews[this.front];
    if (this.hot && this.incoming === undefined && front.canUpdate(result)) return front.load(result);
    this.incoming = (this.front + 1) % this.previews.length;
    this.previews[this.incoming].load(result, true);
  }

  private receive(index: number, event: ResolvedPreviewEvent) {
    if (event.type === 'runtime-error' && (index === this.incoming || (index === this.front && this.incoming === undefined))) {
      // A failed incoming build leaves the last good page visible.
      if (index === this.incoming) this.incoming = undefined;
      this.onStatus({ state: 'error', message: event.message ?? 'The preview failed to start.' });
      return;
    }
    if (event.type !== 'rendered') return;
    const reveal = this.pendingReveal;
    if (index === this.incoming) {
      this.pendingReveal = undefined;
      if (reveal) this.previews[index].reveal(reveal.selector, reveal.highlight, true);
      // Let the instant scroll land before the swap.
      setTimeout(() => {
        if (this.incoming !== index) return;
        const previous = this.front;
        this.front = index;
        this.incoming = undefined;
        this.present();
        if (previous !== index) this.previews[previous].clear();
        this.onStatus({ state: 'ready' });
      }, reveal ? 60 : 0);
    } else if (index === this.front && this.incoming === undefined) {
      this.pendingReveal = undefined;
      if (reveal) this.previews[index].reveal(reveal.selector, reveal.highlight);
      this.onStatus({ state: 'ready' });
    }
  }

  private present() {
    this.frames.forEach((frame, index) => {
      const front = index === this.front;
      frame.dataset.front = String(front);
      frame.title = front ? this.title : `${this.title} (loading)`;
      frame.inert = !front;
    });
  }
}
