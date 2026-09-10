import type { CompilationResult } from './contracts';
import { RuntimeSourceMapper, type PreviewModuleURL, type RuntimePosition, type RuntimeStackFrame } from './runtime-diagnostics';

export interface PreviewEvent {
  version: 1;
  channel: string;
  build: number;
  type: 'ready' | 'rendered' | 'module-manifest' | 'console' | 'runtime-error';
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
  if (event.type === 'ready' || event.type === 'rendered') return true;
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

// Serialized into the opaque-origin iframe. It must not close over host values.
function bootstrap(channel: string, build: number) {
  const send = (type: string, fields: Record<string, unknown> = {}) =>
    parent.postMessage({ version: 1, channel, build, type, ...fields }, '*');
  const describe = (value: unknown): string => {
    try {
      if (value instanceof Error) return `${value.name}: ${value.message}`.slice(0, 4000);
      if (typeof value === 'string') return value.slice(0, 4000);
      return (JSON.stringify(value) ?? String(value)).slice(0, 4000);
    } catch { return '[Unserializable value]'; }
  };
  for (const level of ['log', 'info', 'warn', 'error', 'debug'] as const) {
    const original = console[level].bind(console);
    console[level] = (...args: unknown[]) => {
      original(...args);
      send('console', { level, args: args.slice(0, 30).map(describe), timestamp: Date.now() });
    };
  }
  const report = (error: unknown, position?: { url: string; line: number; column: number }) => {
    const message = error instanceof Error ? error.message : describe(error);
    const stack = error instanceof Error ? error.stack : undefined;
    send('runtime-error', { message: message.slice(0, 16000), stack: stack?.slice(0, 16000), position });
  };
  window.addEventListener('error', event => report(event.error ?? event.message,
    event.filename && event.lineno > 0 && event.colno > 0 ? { url: event.filename, line: event.lineno, column: event.colno } : undefined));
  window.addEventListener('unhandledrejection', event => { event.preventDefault(); report(event.reason); });
  const urls: string[] = [];
  let loaded = false;
  addEventListener('message', async event => {
    const message = event.data;
    if (event.source !== parent || message?.version !== 1 || message.channel !== channel || message.build !== build ||
        message.type !== 'load' || loaded || !Array.isArray(message.modules) || typeof message.entry !== 'string') return;
    if (!message.modules.every((module: { id?: unknown; code?: unknown }) =>
      module && typeof module.id === 'string' && typeof module.code === 'string')) return;
    loaded = true;
    try {
      const imports: Record<string, string> = Object.create(null);
      for (const module of message.modules) {
        let code = module.code;
        if (typeof module.sourceMap === 'string') {
          const bytes = new TextEncoder().encode(module.sourceMap);
          let binary = '';
          for (const byte of bytes) binary += String.fromCharCode(byte);
          code += `\n//# sourceMappingURL=data:application/json;base64,${btoa(binary)}`;
        }
        const url = URL.createObjectURL(new Blob([code], { type: 'text/javascript' }));
        urls.push(url);
        imports[module.id] = url;
      }
      // Sent before evaluation, so even a top-level throw has a known module URL.
      send('module-manifest', { modules: Object.entries(imports).map(([id, url]) => ({ id, url })) });
      const map = document.createElement('script');
      map.type = 'importmap';
      map.textContent = JSON.stringify({ imports });
      document.head.append(map);
      // Keep this dynamic import in the iframe; the host bundler must not transform it.
      await import(/* webpackIgnore: true */ message.entry);
      requestAnimationFrame(() => requestAnimationFrame(() => send('rendered')));
    } catch (error) { report(error); }
  });
  addEventListener('pagehide', () => urls.forEach(url => URL.revokeObjectURL(url)));
  send('ready');
}

export function previewDocument(channel: string, build: number): string {
  // User source is only transferred by postMessage, never interpolated into HTML.
  const script = `(${bootstrap.toString()})(${JSON.stringify(channel)},${build});`;
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline' blob:; style-src 'unsafe-inline'; img-src data: blob:; font-src data:; connect-src 'none'; base-uri 'none'; form-action 'none'"><style>html{color:#deded8;background:#303030;color-scheme:dark}body{margin:0;font-family:system-ui,sans-serif;color:inherit}*{box-sizing:border-box}</style></head><body><div id="app"></div><script>${script.replaceAll('</script', '<\\/script')}</script></body></html>`;
}

export class Preview {
  private channel = crypto.randomUUID();
  private build = 0;
  private result?: CompilationResult;
  private mapper?: RuntimeSourceMapper;
  private timeout?: ReturnType<typeof setTimeout>;
  constructor(private iframe: HTMLIFrameElement, private onEvent: (event: ResolvedPreviewEvent) => void) {
    iframe.setAttribute('sandbox', 'allow-scripts');
    window.addEventListener('message', this.receive);
  }
  private receive = (event: MessageEvent) => {
    if (event.source !== this.iframe.contentWindow || !isPreviewEvent(event.data, this.channel, this.build)) return;
    if (event.data.type === 'module-manifest') {
      this.mapper?.registerManifest(event.data.modules!);
      return;
    }
    if (event.data.type === 'ready' && this.result) {
      this.iframe.contentWindow?.postMessage({ version: 1, channel: this.channel, build: this.build, type: 'load', modules: this.result.modules, entry: this.result.entry }, '*');
    }
    if (event.data.type === 'rendered' || event.data.type === 'runtime-error') clearTimeout(this.timeout);
    this.onEvent({ ...event.data, frames: event.data.type === 'runtime-error' ? this.mapper?.mapStack(event.data.stack, event.data.position) : undefined });
  };
  load(result: CompilationResult) {
    if (!result.entry) return;
    clearTimeout(this.timeout);
    this.result = result;
    this.mapper = new RuntimeSourceMapper(result.modules);
    ++this.build;
    this.channel = crypto.randomUUID();
    this.iframe.srcdoc = previewDocument(this.channel, this.build);
    this.timeout = setTimeout(() => this.onEvent({ version: 1, channel: this.channel, build: this.build, type: 'runtime-error', message: 'Preview did not start. Reload to try again.' }), 10000);
  }
  reload() { if (this.result) this.load(this.result); }
  dispose() { clearTimeout(this.timeout); window.removeEventListener('message', this.receive); this.iframe.srcdoc = ''; }
}
