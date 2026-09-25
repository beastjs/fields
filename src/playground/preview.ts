import { previewDocument } from './preview-bootstrap';
import type { CompilationResult } from './contracts';
import { RuntimeSourceMapper, type PreviewModuleURL, type RuntimePosition, type RuntimeStackFrame } from './runtime-diagnostics';
import { planHotUpdate } from './hot-update';
import type { Theme } from './theme';

/** One node's box as Fine Layout measured it, in the preview's own CSS pixels. */
export interface DesignSides { top: number; right: number; bottom: number; left: number }
export interface DesignNode {
  nodeId: string;
  tag: string;
  rect: { x: number; y: number; width: number; height: number };
  padding: DesignSides;
  margin: DesignSides;
  border: DesignSides;
  /** One Tailwind spacing step in pixels, which the active theme's `--spacing` sets. */
  step: number;
  /** The node holds only text, so it can be edited in place without losing structure. */
  editable: boolean;
  /** How many times this node is rendered; more than one means it sits inside an `each`. */
  count: number;
}

export interface PreviewEvent {
  version: 1;
  channel: string;
  build: number;
  type: 'ready' | 'rendered' | 'reload-required' | 'module-manifest' | 'console' | 'runtime-error'
    | 'design-hover' | 'design-select' | 'design-out' | 'design-exit' | 'design-text-change';
  node?: DesignNode;
  nodeId?: string;
  text?: string;
  update?: 'reload' | 'hot';
  level?: string;
  args?: string[];
  message?: string;
  stack?: string;
  timestamp?: number;
  modules?: PreviewModuleURL[];
  position?: RuntimePosition;
}
const finite = (value: unknown) => typeof value === 'number' && Number.isFinite(value);
const isSides = (value: unknown) => {
  const sides = value as DesignSides;
  return !!sides && finite(sides.top) && finite(sides.right) && finite(sides.bottom) && finite(sides.left);
};
/** The frame is sandboxed but not trusted, so every measurement is checked before the overlay positions on it. */
function isDesignNode(value: unknown): value is DesignNode {
  const node = value as DesignNode;
  if (!node || typeof node !== 'object') return false;
  if (typeof node.nodeId !== 'string' || !node.nodeId || node.nodeId.length > 64) return false;
  if (typeof node.tag !== 'string' || node.tag.length > 32) return false;
  const rect = node.rect;
  if (!rect || !finite(rect.x) || !finite(rect.y) || !finite(rect.width) || !finite(rect.height)) return false;
  if (!isSides(node.padding) || !isSides(node.margin) || !isSides(node.border)) return false;
  return finite(node.step) && node.step > 0 && typeof node.editable === 'boolean' && Number.isSafeInteger(node.count);
}

/** Host-derived frames are never trusted from the wire. */
export interface ResolvedPreviewEvent extends PreviewEvent { frames?: RuntimeStackFrame[] }
export function isPreviewEvent(value: unknown, channel: string, build: number): value is PreviewEvent {
  if (!value || typeof value !== 'object') return false;
  const event = value as PreviewEvent;
  if (event.version !== 1 || event.channel !== channel || event.build !== build) return false;
  if (event.type === 'ready' || event.type === 'reload-required' || event.type === 'design-out' || event.type === 'design-exit') return true;
  if (event.type === 'design-hover' || event.type === 'design-select') return isDesignNode(event.node);
  if (event.type === 'design-text-change') return typeof event.nodeId === 'string' && event.nodeId.length <= 64 &&
    typeof event.text === 'string' && event.text.length <= 4000;
  if (event.type === 'rendered') return event.update === undefined || event.update === 'reload' || event.update === 'hot';
  if (event.type === 'module-manifest') return Array.isArray(event.modules) && event.modules.length <= 1000 &&
    event.modules.every(module => module && typeof module.id === 'string' && module.id.length <= 2048 &&
      typeof module.url === 'string' && module.url.startsWith('blob:') && module.url.length <= 2048);
  if (event.type === 'runtime-error') return typeof event.message === 'string' && event.message.length < 20000 &&
    (event.stack === undefined || (typeof event.stack === 'string' && event.stack.length < 20000)) &&
    (event.position === undefined || (!!event.position && typeof event.position.url === 'string' && event.position.url.length <= 2048 &&
      Number.isSafeInteger(event.position.line) && event.position.line > 0 && Number.isSafeInteger(event.position.column) && event.position.column > 0));
  return event.type === 'console' && ['log', 'info', 'warn', 'error', 'debug'].includes(event.level ?? '') &&
    Array.isArray(event.args) && event.args.length <= 30 && event.args.every(arg => typeof arg === 'string' && arg.length <= 4000) &&
    typeof event.timestamp === 'number' && Number.isFinite(event.timestamp);
}

export { previewDocument } from './preview-bootstrap';

export class Preview {
  private channel = crypto.randomUUID();
  private build = 0;
  private result?: CompilationResult;
  private mapper?: RuntimeSourceMapper;
  private timeout?: ReturnType<typeof setTimeout>;
  private live = false;
  private failed = false;
  private updates = 0;
  private waiting = false;
  private accepting = false;
  private tokens = '';
  private designing = false;
  /** The last hot-update plan, so `canUpdate` followed by `load` for the same result diffs the modules once. */
  private planned?: { from: CompilationResult; to: CompilationResult; update: ReturnType<typeof planHotUpdate> };
  constructor(private iframe: HTMLIFrameElement, private onEvent: (event: ResolvedPreviewEvent) => void, private theme: Theme = 'dark', private hostedURL?: string) {
    iframe.setAttribute('sandbox', 'allow-scripts');
    iframe.referrerPolicy = 'no-referrer';
    iframe.addEventListener('load', this.connect);
    // The preview is always opaque-origin. WebKit can expose a document proxy
    // during focus traversal that throws later, outside Octane's access guard.
    // Keep this host-side DOM boundary opaque; transport uses contentWindow only.
    Object.defineProperty(iframe, 'contentDocument', { configurable: true, get: () => null });
    window.addEventListener('message', this.receive);
  }
  private connect = () => {
    if (!this.hostedURL || !this.waiting || !this.accepting) return;
    this.iframe.contentWindow?.postMessage({ version: 1, type: 'connect', channel: this.channel, build: this.build, theme: this.theme }, '*');
  };
  private receive = (event: MessageEvent) => {
    if (!this.accepting || event.origin !== 'null' || event.source !== this.iframe.contentWindow || !isPreviewEvent(event.data, this.channel, this.build)) return;
    if (this.waiting && event.data.type !== 'ready') return;
    if (event.data.type === 'ready' && !this.waiting) return;
    if (event.data.type === 'reload-required') { if (this.result) this.load(this.result, true); return; }
    if (event.data.type === 'module-manifest') {
      this.mapper?.registerManifest(event.data.modules!);
      return;
    }
    if (event.data.type === 'ready' && this.result) {
      this.waiting = false;
      this.setTheme(this.theme);
      if (this.tokens) this.setTokens(this.tokens);
      if (this.designing) this.setDesigning(true);
      this.iframe.contentWindow?.postMessage({ version: 1, channel: this.channel, build: this.build, type: 'load', modules: this.result.modules, entry: this.result.entry }, '*');
    }
    if (event.data.type === 'rendered' || event.data.type === 'runtime-error') {
      clearTimeout(this.timeout);
      if (event.data.type === 'runtime-error') this.failed = true;
      this.live = event.data.type === 'rendered' && !this.failed;
    }
    this.onEvent({ ...event.data, frames: event.data.type === 'runtime-error' ? this.mapper?.mapStack(event.data.stack, event.data.position) : undefined });
  };
  load(result: CompilationResult, forceReload = false) {
    if (!result.entry) return;
    clearTimeout(this.timeout);
    const update = !forceReload && this.live && this.updates < 40 ? this.plan(result) : undefined;
    this.planned = undefined;
    this.result = result;
    this.live = false;
    this.failed = false;
    this.accepting = true;
    this.waiting = !update;
    ++this.build;
    if (update) {
      if (update.modules.length) ++this.updates;
      this.mapper!.advance(result.modules);
      this.iframe.contentWindow?.postMessage({ version: 1, channel: this.channel, build: this.build, type: 'update', ...update }, '*');
    } else {
      this.updates = 0;
      this.mapper = new RuntimeSourceMapper(result.modules);
      this.channel = crypto.randomUUID();
      if (this.hostedURL) {
        this.iframe.removeAttribute('srcdoc');
        this.iframe.src = this.hostedURL;
      } else {
        this.iframe.removeAttribute('src');
        this.iframe.srcdoc = previewDocument(this.channel, this.build, this.theme, import.meta.env?.PUBLIC_CONVEX_URL ?? '');
      }
    }
    this.timeout = setTimeout(() => {
      this.accepting = false;
      this.waiting = false;
      this.failed = true;
      this.live = false;
      this.onEvent({ version: 1, channel: this.channel, build: this.build, type: 'runtime-error',
        message: this.hostedURL ? 'Hosted preview did not start. Check the configured endpoint and reload, or choose Local preview.' : 'Preview did not start. Reload to try again.' });
    }, 10000);
  }
  /** Turns the frame's inspector on or off; re-sent after every load so a rebuild stays in Fine Layout. */
  setDesigning(enabled: boolean) {
    this.designing = enabled;
    this.post({ type: 'design', enabled });
  }

  /** Applies inline CSS straight to the node in the frame, for the length of a drag; the next render clears it. */
  applyDesignStyle(nodeId: string, style: Record<string, string>) { this.post({ type: 'design-style', nodeId, style }); }

  measureNode(nodeId: string) { this.post({ type: 'design-measure', nodeId }); }

  editText(nodeId: string, editing: boolean) { this.post({ type: 'design-text', nodeId, editing }); }

  private post(fields: Record<string, unknown>) {
    this.iframe.contentWindow?.postMessage({ version: 1, channel: this.channel, ...fields }, '*');
  }

  /** The theme's custom properties, re-sent after every load so a rebuilt page keeps its palette. */
  setTokens(css: string) {
    this.tokens = css;
    this.iframe.contentWindow?.postMessage({ version: 1, channel: this.channel, type: 'tokens', css }, '*');
  }

  setTheme(theme: Theme) {
    this.theme = theme;
    this.iframe.contentWindow?.postMessage({ version: 1, channel: this.channel, type: 'theme', theme }, '*');
  }
  /** Scrolls the running app to the first element matching `selector`, optionally flashing an outline on it. */
  reveal(selector: string, highlight = false, instant = false) {
    this.iframe.contentWindow?.postMessage({ version: 1, channel: this.channel, type: 'reveal', selector, highlight, instant }, '*');
  }
  /** Whether loading `result` would update the running app in place rather than reload it. */
  canUpdate(result: CompilationResult) {
    return Boolean(this.live && this.updates < 40 && this.plan(result));
  }
  private plan(result: CompilationResult) {
    if (!this.result) return undefined;
    const planned = this.planned;
    if (planned?.from === this.result && planned.to === result) return planned.update;
    const update = planHotUpdate(this.result, result);
    this.planned = { from: this.result, to: result, update };
    return update;
  }
  reload() { if (this.result) this.load(this.result, true); }
  /** Stops the running app and releases its document; the next load starts fresh. */
  clear() {
    this.accepting = false;
    this.live = false;
    this.result = undefined;
    this.planned = undefined;
    clearTimeout(this.timeout);
    this.iframe.removeAttribute('src');
    this.iframe.srcdoc = '';
  }
  dispose() {
    this.accepting = false;
    clearTimeout(this.timeout);
    window.removeEventListener('message', this.receive);
    this.iframe.removeEventListener('load', this.connect);
    this.iframe.removeAttribute('src');
    this.iframe.srcdoc = '';
  }
}
