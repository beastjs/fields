import { previewDocument } from './preview-bootstrap';
import type { CompilationResult } from './contracts';
import { RuntimeSourceMapper, type PreviewModuleURL, type RuntimePosition, type RuntimeStackFrame } from './runtime-diagnostics';
import { planHotUpdate } from './hot-update';
import type { Theme } from './theme';

export interface PreviewEvent {
  version: 1;
  channel: string;
  build: number;
  type: 'ready' | 'rendered' | 'reload-required' | 'module-manifest' | 'console' | 'runtime-error';
  update?: 'reload' | 'hot';
  level?: string;
  args?: string[];
  message?: string;
  stack?: string;
  timestamp?: number;
  modules?: PreviewModuleURL[];
  position?: RuntimePosition;
}
/** Host-derived frames are never trusted from the wire. */
export interface ResolvedPreviewEvent extends PreviewEvent { frames?: RuntimeStackFrame[] }
export function isPreviewEvent(value: unknown, channel: string, build: number): value is PreviewEvent {
  if (!value || typeof value !== 'object') return false;
  const event = value as PreviewEvent;
  if (event.version !== 1 || event.channel !== channel || event.build !== build) return false;
  if (event.type === 'ready' || event.type === 'reload-required') return true;
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
    const update = !forceReload && this.live && this.result && this.updates < 40 ? planHotUpdate(this.result, result) : undefined;
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
        this.iframe.srcdoc = previewDocument(this.channel, this.build, this.theme);
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
    return Boolean(this.live && this.result && this.updates < 40 && planHotUpdate(this.result, result));
  }
  reload() { if (this.result) this.load(this.result, true); }
  /** Stops the running app and releases its document; the next load starts fresh. */
  clear() {
    this.accepting = false;
    this.live = false;
    this.result = undefined;
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
