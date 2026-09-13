import { compilationLimitError } from './resource-limits';
import { compileBeastResult } from 'beast-tsrx';
import { compile as compileOctane } from 'octane/compiler';
import { init, parse } from 'es-module-lexer';
import MagicString from 'magic-string';
import remapping from '@jridgewell/remapping';
import { runtimeImports, runtimeModules } from '../generated/runtime';
import type { CompilationProject, CompilationResult, CompiledModule, Diagnostic } from './contracts';
import { normalizePath, VirtualFileSystem } from './virtual-fs';
import { mapPosition, normalizeError, offsetPosition } from './diagnostics';
import { compileTailwind, extractCandidates, usesTailwind } from './tailwind';

export const moduleId = (path: string) => `@playground${path}`;

function composeMaps(output: string, input?: string): string {
  return input ? JSON.stringify(remapping([JSON.parse(output), JSON.parse(input)], () => null)) : output;
}

export function compileBeastModule(source: string, filename: string) {
  const result = compileBeastResult(source, { filename });
  return { code: result.code, sourceMap: JSON.stringify(result.map) };
}

export function compileOctaneModule(source: string, filename: string, sourceMap?: string) {
  const result = compileOctane(source, filename, { mode: 'client', hmr: 'vite', dev: false });
  return { code: result.code, sourceMap: composeMaps(JSON.stringify(result.map), sourceMap),
    diagnostics: result.diagnostics.map(d => ({
      file: filename, source: 'octane' as const, code: d.code, severity: d.severity, message: d.message,
      start: mapPosition({ line: d.start.line, column: d.start.column + 1 }, sourceMap),
      end: mapPosition({ line: d.end.line, column: d.end.column + 1 }, sourceMap),
    })) };
}

/** Locate imports with a real lexer; never rewrite arbitrary user strings. */
export function linkModule(module: CompiledModule, resolve: (request: string) => string, withSourceMap = true): CompiledModule {
  const [imports] = parse(module.code);
  const edited = new MagicString(module.code);
  for (const item of imports) {
    if (item.type === 'import-meta') continue; // import.meta is not a dependency.
    try {
      if (!item.specifier || (item.type === 'dynamic' && item.glob)) throw new Error('Dynamic imports must use a string literal.');
      if (item.phase || item.attributesStart !== -1) throw new Error('Import phases and attributes are not supported in this milestone.');
      const resolved = resolve(item.specifier);
      // Replace the full string literal so quotes/backslashes in filenames remain safe.
      if (item.type === 'dynamic') edited.overwrite(item.start, item.end, JSON.stringify(resolved));
      else edited.overwrite(item.start - 1, item.end + 1, JSON.stringify(resolved));
    } catch (error) {
      const position = offsetPosition(module.code, item.start);
      throw Object.assign(new Error(error instanceof Error ? error.message : String(error)), {
        loc: { line: position.line, column: position.column - 1 },
      });
    }
  }
  const code = edited.toString();
  if (!withSourceMap) return { ...module, code };
  const sourceMap = composeMaps(edited.generateMap({ source: module.id, includeContent: true, hires: true }).toString(), module.sourceMap);
  return { ...module, code, sourceMap };
}

export async function compileProject(project: CompilationProject): Promise<CompilationResult> {
  const started = performance.now();
  const result: CompilationResult = {
    modules: [], assets: [], diagnostics: [], intermediate: {},
    metadata: { duration: 0, modules: 0, transformedFiles: 0, compilerVersion: 'Beast 0.2.60 · Octane 0.2.6', timings: { beast: 0, octane: 0, web: 0 } },
  };
  const finish = () => {
    result.metadata.duration = performance.now() - started;
    result.metadata.modules = result.modules.length;
    return result;
  };
  let fs: VirtualFileSystem;
  let entry: string;
  try {
    const limitError = compilationLimitError(project);
    if (limitError) throw new Error(limitError);
    fs = new VirtualFileSystem(project.files);
    if (fs.list().some(path => path.startsWith('/@runtime/'))) throw new Error('The /@runtime/ directory is reserved for the compiler runtime.');
    entry = fs.resolve(normalizePath(project.entry));
  } catch (error) {
    result.diagnostics.push(normalizeError(error, project.entry, 'web'));
    return finish();
  }
  await init();
  // Tailwind compiles asynchronously; resolve opted-in stylesheets before the synchronous graph walk.
  // Failures are kept and surface only if the stylesheet is actually imported.
  const tailwind = new Map<string, { css: string } | { error: unknown }>();
  const tailwindFiles = fs.list().filter(path => path.endsWith('.css') && usesTailwind(fs.read(path)!));
  if (tailwindFiles.length) {
    const start = performance.now();
    const candidates = extractCandidates(Object.fromEntries(fs.list().map(path => [path, fs.read(path)!])));
    await Promise.all(tailwindFiles.map(async path => {
      try { tailwind.set(path, { css: await compileTailwind(fs.read(path)!, candidates) }); }
      catch (error) { tailwind.set(path, { error }); }
    }));
    result.metadata.timings.web += performance.now() - start;
  }
  const visited = new Set<string>();
  const visit = (file: string) => {
    if (visited.has(file)) return;
    visited.add(file);
    let code = fs.read(file)!;
    let sourceMap: string | undefined;
    let stage: Diagnostic['source'] = 'beast';
    try {
      if (file.endsWith('.btsx')) {
        const start = performance.now();
        try { ({ code, sourceMap } = compileBeastModule(code, file)); }
        finally { result.metadata.timings.beast += performance.now() - start; }
        result.intermediate[file] = code;
        result.metadata.transformedFiles++;
      }
      stage = 'web';
      if (/\.(btsx|tsrx|ts|js)$/.test(file)) {
        stage = 'octane';
        const start = performance.now();
        try {
          const compiled = compileOctaneModule(code, file.replace(/\.btsx$/, '.tsrx'), sourceMap);
          result.diagnostics.push(...compiled.diagnostics.map(d => ({ ...d, file })));
          code = compiled.code;
          sourceMap = compiled.sourceMap;
        } finally { result.metadata.timings.octane += performance.now() - start; }
      } else if (file.endsWith('.css')) {
        const compiled = tailwind.get(file);
        if (compiled && 'error' in compiled) throw compiled.error;
        if (compiled) code = compiled.css;
        result.assets.push({ id: file, content: code, type: 'text/css' });
        code = `const style = document.createElement('style'); style.dataset.playgroundStyle = ${JSON.stringify(file)}; style.textContent = ${JSON.stringify(code)}; document.head.append(style);`;
      } else if (file.endsWith('.json')) {
        code = `export default ${JSON.stringify(JSON.parse(code))};`;
      } else throw new Error(`Unsupported file type: ${file}`);
      stage = 'web';
      const dependencies: string[] = [];
      const start = performance.now();
      try {
        if (/\.(btsx|tsrx)$/.test(file)) {
          const edited = new MagicString(code);
          edited.prepend(`import.meta.hot = globalThis.__playgroundHot(${JSON.stringify(moduleId(file))});\n`);
          sourceMap = composeMaps(edited.generateMap({ source: file, includeContent: true, hires: true }).toString(), sourceMap);
          code = edited.toString();
        }
        const linked = linkModule({ id: moduleId(file), code, source: file, sourceMap }, request => {
          if (Object.hasOwn(runtimeImports, request)) return moduleId(runtimeImports[request]);
          const path = fs.resolve(request, file);
          dependencies.push(path);
          return moduleId(path);
        });
        if (/\.(btsx|tsrx|css)$/.test(file)) {
          const [imports, exports] = parse(linked.code);
          linked.hot = { kind: file.endsWith('.css') ? 'style' : 'component',
            imports: [...new Set(imports.flatMap(item => item.specifier ? [item.specifier] : []))].sort(),
            exports: exports.map(item => item.type === 'direct' ? item.name : '*').sort() };
        }
        result.modules.push(linked);
      } finally { result.metadata.timings.web += performance.now() - start; }
      for (const dependency of dependencies) visit(dependency);
    } catch (error) {
      result.diagnostics.push(normalizeError(error, file, stage, sourceMap));
    }
  };
  visit(entry);
  if (!result.diagnostics.some(d => d.severity === 'error')) {
    const start = performance.now();
    for (const module of runtimeModules) {
      result.modules.push(linkModule({ ...module, id: moduleId(module.id) }, request => moduleId(normalizePath(`/@runtime/${request}`)), false));
    }
    result.metadata.timings.web += performance.now() - start;
    result.entry = moduleId(entry);
  }
  return finish();
}
