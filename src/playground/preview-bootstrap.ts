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
  /**
   * Fine Layout's agent.
   *
   * It only runs while the host turns it on, and it does two jobs: report the box under the pointer, and apply a
   * drag straight to the DOM as inline style while a handle is held. The second is what makes dragging feel
   * direct — the authoritative rebuild lands afterwards, debounced, from the host, and clears the inline style
   * once it has painted.
   */
  let designing = false;
  let probe: HTMLElement | undefined;
  /** One Tailwind spacing step in pixels, which a theme's `--spacing` changes. */
  const spacingStep = () => {
    if (!probe) {
      probe = document.createElement('div');
      probe.style.cssText = 'position:absolute;top:0;left:0;visibility:hidden;height:0;pointer-events:none;width:var(--spacing,0.25rem)';
      probe.setAttribute('data-studio-probe', '');
      document.body.append(probe);
    }
    return probe.getBoundingClientRect().width || 4;
  };
  const sides = (style: CSSStyleDeclaration, prefix: string, suffix = '') => ({
    top: parseFloat(style.getPropertyValue(`${prefix}-top${suffix}`)) || 0,
    right: parseFloat(style.getPropertyValue(`${prefix}-right${suffix}`)) || 0,
    bottom: parseFloat(style.getPropertyValue(`${prefix}-bottom${suffix}`)) || 0,
    left: parseFloat(style.getPropertyValue(`${prefix}-left${suffix}`)) || 0
  });
  const measure = (element: Element) => {
    const box = element.getBoundingClientRect();
    const style = getComputedStyle(element);
    return {
      nodeId: (element as HTMLElement).dataset.node!,
      tag: element.tagName.toLowerCase(),
      rect: { x: box.x, y: box.y, width: box.width, height: box.height },
      padding: sides(style, 'padding'),
      margin: sides(style, 'margin'),
      border: sides(style, 'border', '-width'),
      step: spacingStep(),
      // Only a node whose children are all text can be edited in place without losing structure.
      editable: element.childElementCount === 0 && (element.textContent ?? '').trim().length > 0,
      count: document.querySelectorAll(`[data-node="${(element as HTMLElement).dataset.node}"]`).length
    };
  };
  /** The only properties a drag may set inline, and what each touched element held before, to restore. */
  const liveProperties = new Set(['padding-top', 'padding-right', 'padding-bottom', 'padding-left',
    'margin-top', 'margin-right', 'margin-bottom', 'margin-left', 'width', 'height']);
  const live = new Map<HTMLElement, Map<string, string>>();
  const clearLive = () => {
    for (const [element, previous] of live) {
      for (const [property, value] of previous) {
        if (value) element.style.setProperty(property, value);
        else element.style.removeProperty(property);
      }
    }
    live.clear();
  };
  const nodesOf = (nodeId: string) => document.querySelectorAll<HTMLElement>(`[data-node="${CSS.escape(nodeId)}"]`);
  const nodeAt = (target: EventTarget | null) => (target instanceof Element ? target.closest<HTMLElement>('[data-node]') : null);

  let hovered: string | undefined;
  let selected: HTMLElement | undefined;
  const onMove = (event: PointerEvent) => {
    const element = nodeAt(event.target);
    if (!element) { if (hovered) { hovered = undefined; send('design-out'); } return; }
    if (element.dataset.node === hovered) return;
    hovered = element.dataset.node;
    send('design-hover', { node: measure(element) });
  };
  /**
   * Reports the selected node's box, and remembers what was reported.
   *
   * Every report re-renders the studio. Scroll and pointer events already arrive at most once a frame, so `track`
   * only has to skip a box that has not moved — a scroll that leaves the selection off-screen or pinned, a drag
   * that stays inside one spacing step.
   */
  let reported = '';
  const reportSelected = (element: HTMLElement) => {
    const node = measure(element);
    reported = JSON.stringify(node);
    send('design-select', { node });
  };
  const onDown = (event: PointerEvent) => {
    const element = nodeAt(event.target);
    if (!element) return;
    event.preventDefault();
    event.stopPropagation();
    selected = element;
    reportSelected(element);
  };
  // A link or button inside a section must not navigate while its box is being edited.
  const swallow = (event: Event) => { if (designing) { event.preventDefault(); event.stopPropagation(); } };
  const track = () => {
    if (!selected?.isConnected) return;
    const node = measure(selected);
    const key = JSON.stringify(node);
    if (key === reported) return;
    reported = key;
    send('design-select', { node });
  };
  // Focus lands in the frame once a node is clicked, so the studio never sees Escape unless it is passed up.
  const onKey = (event: KeyboardEvent) => {
    if (event.key !== 'Escape') return;
    event.preventDefault();
    // Escape while editing text finishes the edit (its blur commits it) rather than leaving Fine Layout.
    const editing = event.target instanceof HTMLElement && event.target.isContentEditable;
    if (editing) (event.target as HTMLElement).blur();
    else send('design-exit');
  };
  const setDesigning = (on: boolean) => {
    if (on === designing) return;
    designing = on;
    const options = { capture: true } as const;
    if (on) {
      document.addEventListener('pointermove', onMove, options);
      document.addEventListener('pointerdown', onDown, options);
      document.addEventListener('click', swallow, options);
      document.addEventListener('submit', swallow, options);
      document.addEventListener('keydown', onKey, options);
      addEventListener('scroll', track, { passive: true });
      addEventListener('resize', track);
      document.documentElement.style.cursor = 'crosshair';
    } else {
      document.removeEventListener('pointermove', onMove, options);
      document.removeEventListener('pointerdown', onDown, options);
      document.removeEventListener('click', swallow, options);
      document.removeEventListener('submit', swallow, options);
      document.removeEventListener('keydown', onKey, options);
      removeEventListener('scroll', track);
      removeEventListener('resize', track);
      document.documentElement.style.cursor = '';
      reported = '';
      hovered = undefined;
      selected = undefined;
    }
  };

  let errorWindow = performance.now();
  let errorCount = 0;
  const report = (error: unknown, position?: { url: string; line: number; column: number }) => {
    const now = performance.now();
    if (now - errorWindow >= 1000) { errorWindow = now; errorCount = 0; }
    if (++errorCount > 20) {
      if (errorCount === 21) send('runtime-error', { message: 'Runtime error rate limit reached (20 errors/second). Additional errors suppressed.' });
      return;
    }
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
    let reported = false;
    const finish = () => {
      if (reported) return;
      reported = true;
      busy = false;
      // The rebuild now carries the drag as classes, so the inline stand-in can go without anything moving.
      clearLive();
      if (revision === build) send('rendered', { update });
    };
    // Two frames is the accurate "it has painted" signal, but requestAnimationFrame never fires while the
    // document is hidden — switching tabs mid-build would otherwise leave the host waiting for a build that
    // already finished, until it gave up with a startup error. The timer guarantees the report either way.
    requestAnimationFrame(() => requestAnimationFrame(finish));
    setTimeout(finish, 300);
  };
  addEventListener('message', async event => {
    const message = event.data;
    if (event.source !== parent || message?.version !== 1 || message.channel !== channel) return;
    if (message.type === 'theme' && (message.theme === 'dark' || message.theme === 'light')) {
      document.documentElement.dataset.theme = message.theme;
      // What the page's scheme falls back to when its own stylesheet leaves `color-scheme` at `normal` — which
      // `:root { color-scheme: inherit }` also does, since the root has nothing to inherit from.
      document.querySelector('meta[name="color-scheme"]')?.setAttribute('content', message.theme);
      return;
    }
    if (message.type === 'design' && typeof message.enabled === 'boolean') {
      setDesigning(message.enabled);
      return;
    }
    if (message.type === 'design-style' && typeof message.nodeId === 'string' && message.style && typeof message.style === 'object') {
      // Inline, so a drag reads at pointer speed even for a value the built stylesheet has no utility for yet.
      if (!selected?.isConnected) selected = nodesOf(message.nodeId)[0];
      const entries = Object.entries(message.style as Record<string, unknown>)
        .filter((entry): entry is [string, string] => liveProperties.has(entry[0]) && typeof entry[1] === 'string' && entry[1].length <= 80);
      for (const element of nodesOf(message.nodeId)) {
        let previous = live.get(element);
        if (!previous) live.set(element, (previous = new Map()));
        for (const [property, value] of entries) {
          if (!previous.has(property)) previous.set(property, element.style.getPropertyValue(property));
          element.style.setProperty(property, value);
        }
      }
      // A drag sends one of these per pointer move; a box that did not change is not reported again.
      track();
      return;
    }
    if (message.type === 'design-measure' && typeof message.nodeId === 'string') {
      const element = nodesOf(message.nodeId)[0];
      if (!element) return;
      // A rebuild can replace the node that was clicked, so the selection follows the one that now stands for it;
      // otherwise the next drag or scroll would measure a detached element and report nothing.
      selected = element;
      reportSelected(element);
      return;
    }
    if (message.type === 'design-text' && typeof message.nodeId === 'string' && typeof message.editing === 'boolean') {
      const element = nodesOf(message.nodeId)[0];
      if (!element) return;
      if (!message.editing) { element.removeAttribute('contenteditable'); return; }
      element.setAttribute('contenteditable', 'plaintext-only');
      element.focus();
      getSelection()?.selectAllChildren(element);
      const finish = () => {
        element.removeAttribute('contenteditable');
        element.removeEventListener('blur', finish);
        send('design-text-change', { nodeId: message.nodeId, text: (element.textContent ?? '').slice(0, 4000) });
      };
      element.addEventListener('blur', finish, { once: true });
      return;
    }
    if (message.type === 'tokens' && typeof message.css === 'string' && message.css.length <= 20000) {
      // A theme is custom properties and, for a paint style, the few layered rules that move `color` onto a role,
      // so swapping this node repaints the page without touching the build.
      let node = document.querySelector('style[data-studio-tokens]');
      if (!node) {
        node = document.createElement('style');
        node.setAttribute('data-studio-tokens', '');
        document.head.append(node);
      }
      node.textContent = message.css;
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
  return `<!doctype html><html data-theme="${theme}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="${theme}"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline' blob:; style-src 'unsafe-inline'; img-src data: blob:; font-src data:; connect-src 'none'; base-uri 'none'; form-action 'none'"><style>html{color:#deded8;background:#303030;color-scheme:dark}html[data-theme="light"]{color:#111113;background:#ffffff;color-scheme:light}body{margin:0;font-family:system-ui,sans-serif;color:inherit}*{box-sizing:border-box}</style></head><body><div id="app"></div><script>${script.replaceAll('</script', '<\\/script')}</script></body></html>`;
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
    document.querySelector('meta[name="color-scheme"]')?.setAttribute('content', message.theme);
    start(message.channel, message.build);
  };
  addEventListener('message', connect);
}

export function hostedPreviewDocument(): string {
  return documentWithScript(`(${hostedBootstrap.toString()})(${bootstrap.toString()});`, 'dark');
}
