import type { Theme } from './theme';

// Serialized into the opaque-origin iframe. It must not close over host values.
function bootstrap(channel: string, build: number) {
  const send = (type: string, fields: Record<string, unknown> = {}) =>
    parent.postMessage({ version: 1, channel, build, type, ...fields }, '*');
  // Share one budget across all console levels. Drop before inspecting arguments
  // or forwarding to devtools so a log burst cannot flood the host message queue.
  let consoleWindow = performance.now();
  let consoleCount = 0;
  const describe = (value: unknown): string => {
    try {
      if (value instanceof Error) return `${value.name}: ${value.message}`.slice(0, 4000);
      if (typeof value === 'string') return value.slice(0, 4000);
      let remaining = 100;
      const seen = new WeakSet<object>();
      const summarize = (item: unknown, depth: number): unknown => {
        if (--remaining < 0) return '[Truncated]';
        if (typeof item === 'string') return item.slice(0, 1000);
        if (!item || typeof item !== 'object') return typeof item === 'bigint' ? `${item}n` : item;
        if (seen.has(item)) return '[Circular]';
        if (depth >= 3) return '[Object]';
        seen.add(item);
        if (Array.isArray(item)) {
          const output: unknown[] = [];
          for (let index = 0; index < Math.min(item.length, 20) && remaining > 0; index++) {
            const descriptor = Object.getOwnPropertyDescriptor(item, String(index));
            output.push(descriptor && 'value' in descriptor ? summarize(descriptor.value, depth + 1) : '[Getter]');
          }
          if (output.length < item.length) output.push('[Truncated]');
          return output;
        }
        const output: Record<string, unknown> = Object.create(null);
        let count = 0;
        for (const key in item) {
          if (!Object.hasOwn(item, key)) continue;
          if (count++ >= 20 || remaining <= 0) { output['…'] = '[Truncated]'; break; }
          const descriptor = Object.getOwnPropertyDescriptor(item, key);
          output[key.slice(0, 200)] = descriptor && 'value' in descriptor
            ? summarize(descriptor.value, depth + 1) : '[Getter]';
        }
        return output;
      };
      return (JSON.stringify(summarize(value, 0)) ?? String(value)).slice(0, 4000);
    } catch { return '[Unserializable value]'; }
  };
  for (const level of ['log', 'info', 'warn', 'error', 'debug'] as const) {
    const original = console[level].bind(console);
    console[level] = (...args: unknown[]) => {
      const now = performance.now();
      if (now - consoleWindow >= 1000) { consoleWindow = now; consoleCount = 0; }
      if (++consoleCount > 100) {
        if (consoleCount === 101) send('console', { level: 'warn', args: ['Console rate limit reached (100 messages/second). Additional messages suppressed.'], timestamp: Date.now() });
        return;
      }
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
    if (message.type === 'reveal' && typeof message.selector === 'string') {
      let target: Element | null = null;
      try { target = document.querySelector(message.selector); } catch { return; }
      if (!target) return;
      const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
      // scrollIntoView would also scroll the host page's containers; only this document should move.
      scrollTo({ top: target.getBoundingClientRect().top + scrollY, behavior: still || message.instant === true ? 'auto' : 'smooth' });
      if (message.highlight === true && !still) {
        target.animate([{ boxShadow: 'inset 0 0 0 2px color-mix(in oklab, currentColor 40%, transparent)' }, { boxShadow: 'inset 0 0 0 2px transparent' }], { duration: 1600, easing: 'ease-out' });
      }
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
  return documentWithScript(script, theme);
}

function documentWithScript(script: string, theme: Theme): string {
  return `<!doctype html><html data-theme="${theme}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline' blob:; style-src 'unsafe-inline'; img-src data: blob:; font-src data:; connect-src 'none'; base-uri 'none'; form-action 'none'"><style>html{color:#deded8;background:#303030;color-scheme:dark}html[data-theme="light"]{color:#111113;background:#ffffff;color-scheme:light}body{margin:0;font-family:system-ui,sans-serif;color:inherit}*{box-sizing:border-box}</style></head><body><div id="app"></div><script>${script.replaceAll('</script', '<\\/script')}</script></body></html>`;
}


// A static hosted document contains no project or host channel. The parent starts
// this one-shot handshake after navigation; only then can it receive a build.
function hostedBootstrap(start: typeof bootstrap) {
  const connect = (event: MessageEvent) => {
    const message = event.data;
    if (event.source !== parent || parent === window || message?.version !== 1 || message.type !== 'connect' ||
      typeof message.channel !== 'string' || !/^[a-f0-9-]{36}$/.test(message.channel) ||
      !Number.isSafeInteger(message.build) || message.build < 1 ||
      !['dark', 'light'].includes(message.theme)) return;
    removeEventListener('message', connect);
    document.documentElement.dataset.theme = message.theme;
    start(message.channel, message.build);
  };
  addEventListener('message', connect);
}

export function hostedPreviewDocument(): string {
  return documentWithScript(`(${hostedBootstrap.toString()})(${bootstrap.toString()});`, 'dark');
}
