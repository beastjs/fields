import type { CompilerWorker } from './coordinator';
import { PROTOCOL_VERSION, type CompilationProject, type CompilationResult, type WorkerResponse } from './contracts';
import { Preview, type DesignNode, type ResolvedPreviewEvent } from './preview';
import type { Theme } from './theme';

export type TemplatePreviewStatus = { state: 'compiling' | 'ready' } | { state: 'error'; message: string };
/** What Fine Layout reports back from the visible frame. */
export type DesignEvent =
  | { type: 'hover'; node: DesignNode }
  | { type: 'select'; node: DesignNode }
  | { type: 'out' }
  | { type: 'text'; nodeId: string; text: string };
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
  /** Called with what Fine Layout reports; only the visible frame is ever inspected. */
  onDesign?: (event: DesignEvent) => void;
  private designing = false;
  private compiling?: ReturnType<typeof setTimeout>;
  /**
   * How long a compile may take before the worker is presumed lost.
   *
   * Every path through a *frame* already has `Preview`'s own ten-second guard, so a page that never starts becomes
   * a runtime error a reader can act on. The worker round trip had no such guard, and it is the one step that can
   * fail silently: a compile that never answers — a worker wedged on a pathological source, or killed by the
   * browser under memory pressure — leaves `show` having announced `compiling` with nothing left to move it on.
   * The studio then reads "Building preview…" forever, says nothing about why, and cannot be recovered by
   * reloading, because the next build wedges the same way. Generous on purpose: a large page compiles in well
   * under a second, so anything near this is already broken rather than slow.
   */
  private static readonly COMPILE_TIMEOUT = 20000;

  constructor(private frames: HTMLIFrameElement[], theme: Theme, private createWorker: () => CompilerWorker, private onStatus: (status: TemplatePreviewStatus) => void, private title = 'Preview') {
    this.previews = frames.map((frame, index) => new Preview(frame, event => this.receive(index, event), theme));
    this.present();
    this.worker = this.startWorker();
  }

  /** A worker wired to this instance. Replacing one is how a lost compiler is recovered from. */
  private startWorker(): CompilerWorker {
    const worker = this.createWorker();
    worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
      if (event.data?.type !== 'compile-result' || event.data.id !== this.request) return;
      clearTimeout(this.compiling);
      const { result } = event.data;
      const error = result.diagnostics.find(diagnostic => diagnostic.severity === 'error');
      if (!result.entry || error) this.onStatus({ state: 'error', message: error?.message ?? 'The template did not compile.' });
      else this.load(result);
    };
    worker.onerror = () => {
      clearTimeout(this.compiling);
      this.onStatus({ state: 'error', message: 'The template compiler stopped unexpectedly.' });
    };
    return worker;
  }

  /** Compiles and shows `project`; `reveal` scrolls to an element once that build has rendered. */
  show(project: CompilationProject, reveal?: { selector: string; highlight?: boolean }) {
    this.pendingReveal = reveal && { selector: reveal.selector, highlight: reveal.highlight ?? false };
    this.onStatus({ state: 'compiling' });
    clearTimeout(this.compiling);
    this.compiling = setTimeout(() => this.abandonCompile(), TemplatePreview.COMPILE_TIMEOUT);
    this.worker.postMessage({ version: PROTOCOL_VERSION, type: 'compile', id: ++this.request, project });
  }

  /**
   * Give up on a compile that never answered, and start a worker that can.
   *
   * The dead one is replaced rather than reused, so the next edit rebuilds instead of queueing behind whatever
   * wedged it — the difference between a studio that reports a bad build and one that has to be closed and
   * reopened. Bumping `request` drops the old worker's answer if it ever arrives.
   */
  private abandonCompile() {
    this.request++;
    this.worker.terminate();
    this.worker = this.startWorker();
    this.onStatus({ state: 'error', message: 'The preview compiler stopped responding. Change anything to build again.' });
  }

  reveal(selector: string, highlight = false) { this.previews[this.front].reveal(selector, highlight); }

  setTheme(theme: Theme) { for (const preview of this.previews) preview.setTheme(theme); }

  /** Applies a theme's custom properties to both frames; no rebuild, so the page repaints in place. */
  setTokens(css: string) { for (const preview of this.previews) preview.setTokens(css); }

  /** Both frames inspect, so a rebuild that swaps frames stays in Fine Layout. */
  setDesigning(enabled: boolean) {
    this.designing = enabled;
    for (const preview of this.previews) preview.setDesigning(enabled);
  }

  applyDesignStyle(nodeId: string, className: string) { this.previews[this.front].applyDesignStyle(nodeId, className); }
  measureNode(nodeId: string) { this.previews[this.front].measureNode(nodeId); }
  editText(nodeId: string, editing: boolean) { this.previews[this.front].editText(nodeId, editing); }

  dispose() {
    this.request++;
    clearTimeout(this.compiling);
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
    if (event.type.startsWith('design-')) {
      // Only the frame the person can actually see reports; the standby frame is inert.
      if (index !== this.front || !this.designing) return;
      if (event.type === 'design-out') this.onDesign?.({ type: 'out' });
      else if (event.type === 'design-text-change') this.onDesign?.({ type: 'text', nodeId: event.nodeId!, text: event.text! });
      else this.onDesign?.({ type: event.type === 'design-hover' ? 'hover' : 'select', node: event.node! });
      return;
    }
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
