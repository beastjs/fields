import { originalPositionFor, sourceContentFor, TraceMap } from '@jridgewell/trace-mapping';
import type { CompiledModule, Position } from './contracts';
import { normalizePath } from './virtual-fs';

export interface PreviewModuleURL { id: string; url: string }
export interface RuntimePosition extends Position { url: string }
export interface RuntimeLocation {
  file: string;
  position: Position;
  /** The authored snapshot, used to avoid navigating into changed source. */
  sourceContent: string;
}
export interface RuntimeStackFrame {
  raw: string;
  moduleId?: string;
  location?: RuntimeLocation;
}

/** The host owns compiler maps. The iframe supplies only its build's Blob URLs. */
export class RuntimeSourceMapper {
  private modules: Map<string, CompiledModule>;
  private urls = new Map<string, CompiledModule>();
  private maps = new Map<string, TraceMap | null>();

  constructor(modules: CompiledModule[]) {
    this.modules = new Map(modules.map(module => [module.id, module]));
  }

  advance(modules: CompiledModule[]) {
    this.modules = new Map(modules.map(module => [module.id, module]));
  }

  registerManifest(entries: PreviewModuleURL[]): boolean {
    if (entries.length !== this.modules.size) return false;
    const urls = new Map<string, CompiledModule>();
    const ids = new Set<string>();
    for (const { id, url } of entries) {
      if (!this.modules.has(id) || ids.has(id) || urls.has(url) || !url.startsWith('blob:')) return false;
      ids.add(id);
      urls.set(url, this.modules.get(id)!);
    }
    // Retain older evaluations: delayed callbacks must map to the source they ran.
    for (const [url, module] of urls) if (!this.urls.has(url)) this.urls.set(url, module);
    return true;
  }

  private resolve(position: RuntimePosition, raw: string): RuntimeStackFrame {
    const module = this.urls.get(position.url);
    const moduleId = module?.id;
    const frame: RuntimeStackFrame = { raw, moduleId };
    if (!module?.sourceMap || !module.source) return frame;
    try {
      if (!this.maps.has(position.url)) this.maps.set(position.url, new TraceMap(module.sourceMap));
      const map = this.maps.get(position.url);
      if (!map) return frame;
      const original = originalPositionFor(map, { line: position.line, column: position.column - 1 });
      if (original.source === null || original.line === null) return frame;
      // Only the authored file identified by the compiler can become a navigation target.
      const directory = module.source.slice(0, module.source.lastIndexOf('/') + 1);
      const source = normalizePath(original.source.startsWith('/') ? original.source : directory + original.source);
      if (source !== module.source) return frame;
      const content = sourceContentFor(map, original.source);
      if (content === null) return frame;
      const lines = content.split('\n');
      if (original.line > lines.length || original.column > lines[original.line - 1].length) return frame;
      frame.location = { file: module.source, position: { line: original.line, column: original.column + 1 }, sourceContent: content };
    } catch {
      // Missing or malformed maps must never hide the original runtime error.
      this.maps.set(position.url, null);
    }
    return frame;
  }

  mapStack(stack?: string, fallback?: RuntimePosition): RuntimeStackFrame[] {
    const frames = (stack ?? '').split('\n').filter((line, index) => index > 0 || line.includes('blob:'))
      .filter(line => line.trim()).slice(0, 40).map(raw => {
        // V8/Chromium: at fn (blob:...:line:column), Firefox/WebKit: fn@blob:...:line:column.
        const match = raw.match(/\b(blob:[^\s]+?):(\d+):(\d+)\)?\s*$/);
        if (!match) return { raw };
        const line = Number(match[2]);
        const column = Number(match[3]);
        if (!Number.isSafeInteger(line) || line < 1 || !Number.isSafeInteger(column) || column < 1) return { raw };
        return this.resolve({ url: match[1], line, column }, raw);
      });
    if (!frames.some(frame => frame.location) && fallback) {
      const raw = `${fallback.url}:${fallback.line}:${fallback.column}`;
      frames.unshift(this.resolve(fallback, raw));
    }
    return frames;
  }
}

export function canNavigateRuntimeLocation(location: RuntimeLocation, currentSource: string | undefined): boolean {
  return currentSource !== undefined && currentSource === location.sourceContent;
}
