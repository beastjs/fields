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
  type HotContext = {
    data: Record<string, unknown>;
    accepted: boolean;
    callback?: (namespace: Record<string, unknown>) => void;
    disposers: ((data: Record<string, unknown>) => void)[];
  };
  const contexts = new Map<string, HotContext>();
  const urls: string[] = [];
  const imports: Record<string, string> = Object.create(null);
  const moduleExports = new Map<string, string[]>();
  let loaded = false;
  let busy = false;
  let invalidated = false;
  // This is a transport adapter for Octane's generated Vite-dialect HMR contract.
  Object.defineProperty(globalThis, '__playgroundHot', { value: (id: string) => {
    const previous = contexts.get(id);
    const context: HotContext = { data: previous?.data ?? Object.create(null), accepted: false, disposers: [] };
    contexts.set(id, context);
    return {
      data: context.data,
      accept(callback?: (namespace: Record<string, unknown>) => void) {
        if (callback !== undefined && typeof callback !== 'function') throw new Error('Only self-accepting HMR boundaries are supported.');
        context.accepted = true; context.callback = callback;
      },
      dispose(callback: (data: Record<string, unknown>) => void) { context.disposers.push(callback); },
      invalidate() { invalidated = true; },
    };
  } });
  const createModule = (module: { id: string; code: string; sourceMap?: string }) => {
    let code = module.code;
    if (typeof module.sourceMap === 'string') {
      const bytes = new TextEncoder().encode(module.sourceMap);
      let binary = '';
      for (const byte of bytes) binary += String.fromCharCode(byte);
      code += `\n//# sourceMappingURL=data:application/json;base64,${btoa(binary)}`;
    }
    const url = URL.createObjectURL(new Blob([code], { type: 'text/javascript' }));
    urls.push(url); imports[module.id] = url;
    return url;
  };
  const manifest = () => send('module-manifest', { modules: Object.entries(imports).map(([id, url]) => ({ id, url })) });
  const rendered = (update: 'reload' | 'hot') => {
    const revision = build;
    requestAnimationFrame(() => requestAnimationFrame(() => {
      busy = false;
      if (revision === build) send('rendered', { update });
    }));
  };
  addEventListener('message', async event => {
    const message = event.data;
    if (event.source !== parent || message?.version !== 1 || message.channel !== channel) return;
    if (message.type === 'theme' && (message.theme === 'dark' || message.theme === 'light')) {
      document.documentElement.dataset.theme = message.theme;
      return;
    }
    if (message.type === 'load') {
      if (loaded || message.build !== build || !Array.isArray(message.modules) || typeof message.entry !== 'string' ||
        !message.modules.every((module: { id?: unknown; code?: unknown }) => module && typeof module.id === 'string' && typeof module.code === 'string')) return;
      loaded = true; busy = true;
      try {
        for (const module of message.modules) {
          createModule(module);
          if (module.hot?.kind === 'component') moduleExports.set(module.id, module.hot.exports);
        }
        manifest();
        const map = document.createElement('script');
        map.type = 'importmap'; map.textContent = JSON.stringify({ imports });
        document.head.append(map);
        await import(/* webpackIgnore: true */ message.entry);
        rendered('reload');
      } catch (error) { busy = false; report(error); }
      return;
    }
    if (message.type !== 'update' || !loaded || busy || !Number.isSafeInteger(message.build) || message.build <= build ||
      !Array.isArray(message.modules) || !Array.isArray(message.styles)) return;
    build = message.build; busy = true; invalidated = false;
    try {
      const styles: { node: HTMLStyleElement; content: string }[] = [];
      for (const style of message.styles) {
        if (!style || typeof style.id !== 'string' || typeof style.content !== 'string') throw new Error('Invalid stylesheet update.');
        const node = Array.from(document.querySelectorAll<HTMLStyleElement>('style[data-playground-style]'))
          .find(node => node.dataset.playgroundStyle === style.id);
        if (!node) throw new Error('Stylesheet has not been evaluated.');
        styles.push({ node, content: style.content });
      }
      for (const module of message.modules) {
        if (!module || typeof module.id !== 'string' || typeof module.code !== 'string') throw new Error('Invalid module update.');
        const context = contexts.get(module.id);
        const exports = moduleExports.get(module.id);
        const components = context?.data.__octaneComponents;
        if (!context?.accepted || !exports?.length || !components || typeof components !== 'object' ||
          JSON.stringify(Object.keys(components).sort()) !== JSON.stringify(exports)) throw new Error('Module is not a component-only boundary.');
      }
      const replacements = message.modules.map((module: { id: string; code: string; sourceMap?: string }) => ({ id: module.id, url: createModule(module) }));
      // Register new URLs before evaluation, including a possible top-level failure.
      manifest();
      for (const { id, url } of replacements) {
        const old = contexts.get(id)!;
        for (const dispose of old.disposers) dispose(old.data);
        // Imports retain their original map; the compiler hands new bodies to canonical wrappers.
        const namespace = await import(/* webpackIgnore: true */ url);
        old.callback?.(namespace);
        if (invalidated) throw new Error('Octane requested a full reload.');
      }
      for (const { node, content } of styles) node.textContent = content;
      rendered('hot');
    } catch { busy = false; send('reload-required'); }
  });
  addEventListener('pagehide', () => urls.forEach(url => URL.revokeObjectURL(url)));
  send('ready');
}

export function previewDocument(channel: string, build: number, theme: Theme = 'dark'): string {
  // User source is only transferred by postMessage, never interpolated into HTML.
  const script = `(${bootstrap.toString()})(${JSON.stringify(channel)},${build});`;
  return `<!doctype html><html data-theme="${theme}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline' blob:; style-src 'unsafe-inline'; img-src data: blob:; font-src data:; connect-src 'none'; base-uri 'none'; form-action 'none'"><style>html{color:#deded8;background:#303030;color-scheme:dark}html[data-theme="light"]{color:#262822;background:#faf9f5;color-scheme:light}body{margin:0;font-family:system-ui,sans-serif;color:inherit}*{box-sizing:border-box}</style></head><body><div id="app"></div><script>${script.replaceAll('</script', '<\\/script')}</script></body></html>`;
}

export class Preview {
  private channel = crypto.randomUUID();
  private build = 0;
  private result?: CompilationResult;
  private mapper?: RuntimeSourceMapper;
  private timeout?: ReturnType<typeof setTimeout>;
  private live = false;
  private failed = false;
  private updates = 0;
  constructor(private iframe: HTMLIFrameElement, private onEvent: (event: ResolvedPreviewEvent) => void, private theme: Theme = 'dark') {
    iframe.setAttribute('sandbox', 'allow-scripts');
    window.addEventListener('message', this.receive);
  }
  private receive = (event: MessageEvent) => {
    if (event.source !== this.iframe.contentWindow || !isPreviewEvent(event.data, this.channel, this.build)) return;
    if (event.data.type === 'reload-required') { if (this.result) this.load(this.result, true); return; }
    if (event.data.type === 'module-manifest') {
      this.mapper?.registerManifest(event.data.modules!);
      return;
    }
    if (event.data.type === 'ready' && this.result) {
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
    ++this.build;
    if (update) {
      if (update.modules.length) ++this.updates;
      this.mapper!.advance(result.modules);
      this.iframe.contentWindow?.postMessage({ version: 1, channel: this.channel, build: this.build, type: 'update', ...update }, '*');
    } else {
      this.updates = 0;
      this.mapper = new RuntimeSourceMapper(result.modules);
      this.channel = crypto.randomUUID();
      this.iframe.srcdoc = previewDocument(this.channel, this.build, this.theme);
    }
    this.timeout = setTimeout(() => this.onEvent({ version: 1, channel: this.channel, build: this.build, type: 'runtime-error', message: 'Preview did not start. Reload to try again.' }), 10000);
  }
  setTheme(theme: Theme) {
    this.theme = theme;
    this.iframe.contentWindow?.postMessage({ version: 1, channel: this.channel, type: 'theme', theme }, '*');
  }
  reload() { if (this.result) this.load(this.result, true); }
  dispose() { clearTimeout(this.timeout); window.removeEventListener('message', this.receive); this.iframe.srcdoc = ''; }
}
