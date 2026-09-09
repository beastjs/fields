import { expect, test } from 'bun:test';
import { compileProject } from '../src/playground/compiler';
import { offsetPosition } from '../src/playground/diagnostics';
import { canNavigateRuntimeLocation, RuntimeSourceMapper } from '../src/playground/runtime-diagnostics';
import type { CompiledModule } from '../src/playground/contracts';

async function compiledFailure(file = '/src/Child.btsx') {
  const source = file.endsWith('.btsx')
    ? "setup\n  const fail = () => {\n    throw new Error('Nested failure');\n  };\n\nbutton(onClick={fail}) Throw\n"
    : "export function fail() {\n  throw new Error('Module failure');\n}\n";
  const result = await compileProject({ entry: file, files: { [file]: source } });
  expect(result.diagnostics).toEqual([]);
  const module = result.modules.find(module => module.source === file)!;
  const manifest = result.modules.map((module, i) => ({ id: module.id, url: `blob:null/module-${i}` }));
  const url = manifest.find(entry => entry.id === module.id)!.url;
  const position = offsetPosition(module.code, module.code.indexOf('new Error'));
  const mapper = new RuntimeSourceMapper(result.modules);
  expect(mapper.registerManifest(manifest)).toBe(true);
  return { mapper, manifest, module, url, position, source, file };
}

test('maps real generated Beast frames through all three maps to authored lines', async () => {
  const { mapper, url, position, source, file } = await compiledFailure();
  const stack = `Error: Nested failure\n    at fail (${url}:${position.line}:${position.column})\n    at runtime (blob:null/unknown:1:20)`;
  const frames = mapper.mapStack(stack);
  expect(frames[0].location).toMatchObject({ file, position: { line: 3 }, sourceContent: source });
  expect(frames[1].location).toBeUndefined();
  expect(frames[1].raw).toContain('blob:null/unknown');
});

test('maps plain TypeScript and Firefox/WebKit style stacks', async () => {
  const { mapper, url, position, file } = await compiledFailure('/src/failure.ts');
  const frames = mapper.mapStack(`fail@${url}:${position.line}:${position.column}`);
  expect(frames[0].location).toMatchObject({ file, position: { line: 2 } });
});

test('uses ErrorEvent positions when the browser supplies no stack', async () => {
  const { mapper, url, position, file } = await compiledFailure();
  const frames = mapper.mapStack(undefined, { url, ...position });
  expect(frames[0].location?.file).toBe(file);
});

test('manifests are atomic, reject missing/foreign/duplicate modules, and do not cross builds', async () => {
  const { mapper, manifest, url, position, module } = await compiledFailure();
  expect(mapper.registerManifest(manifest.slice(1))).toBe(false);
  expect(mapper.registerManifest(manifest.map((item, index) => index ? item : { ...item, id: 'foreign' }))).toBe(false);
  expect(mapper.registerManifest(manifest.map((item, index) => index ? item : manifest[1]))).toBe(false);
  expect(mapper.registerManifest(manifest.map(item => ({ ...item, url: 'blob:null/duplicate' })))).toBe(false);
  expect(mapper.registerManifest(manifest.map(item => ({ ...item, url: 'https://example.com/script' })))).toBe(false);
  const stack = `Error: failure\n    at fail (${url}:${position.line}:${position.column})`;
  expect(mapper.mapStack(stack)[0].location).toBeDefined();
  expect(new RuntimeSourceMapper([module]).mapStack(stack)[0].location).toBeUndefined();
});

test('unmapped runtime code, invalid maps, foreign sources and invalid positions remain raw', () => {
  const modules: CompiledModule[] = [
    { id: 'runtime', code: '' },
    { id: 'invalid-map', code: '', source: '/source.ts', sourceMap: '{bad' },
    { id: 'foreign-source', code: '', source: '/source.ts', sourceMap: JSON.stringify({ version: 3, sources: ['/other.ts'], sourcesContent: ['throw 1'], mappings: 'AAAA', names: [] }) },
  ];
  const mapper = new RuntimeSourceMapper(modules);
  mapper.registerManifest(modules.map(module => ({ id: module.id, url: `blob:null/${module.id}` })));
  const frames = mapper.mapStack('Error: failed\n at fn (blob:null/runtime:1:2)\n at fn (blob:null/invalid-map:1:1)\n at fn (blob:null/foreign-source:1:1)\n at native\n at broken (blob:null/runtime:0:1)');
  expect(frames).toHaveLength(5);
  expect(frames.every(frame => !frame.location)).toBe(true);
  expect(mapper.mapStack('Plain error with no stack')).toEqual([]);
});

test('navigation requires an unchanged authored snapshot, including for deleted files', async () => {
  const { mapper, url, position, source } = await compiledFailure();
  const location = mapper.mapStack(`fail@${url}:${position.line}:${position.column}`)[0].location!;
  expect(canNavigateRuntimeLocation(location, source)).toBe(true);
  expect(canNavigateRuntimeLocation(location, '// new line\n' + source)).toBe(false);
  expect(canNavigateRuntimeLocation(location, undefined)).toBe(false);
});
