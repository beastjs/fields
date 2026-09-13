import { beforeAll, describe, expect, test } from 'bun:test';
import { readdir, readFile } from 'node:fs/promises';
import { init, parse } from 'es-module-lexer';
import { compileBeastModule, compileOctaneModule, compileProject, linkModule } from '../src/playground/compiler';
import { helloWorld } from '../src/playground/examples';
import { mapPosition } from '../src/playground/diagnostics';

beforeAll(() => init());
async function fixture(name: string, entry = '/App.btsx') {
  const root = new URL(`../fixtures/${name}/`, import.meta.url);
  const paths = await readdir(root, { recursive: true, withFileTypes: true });
  const files: Record<string, string> = {};
  for (const file of paths.filter(file => file.isFile())) {
    const full = `${file.parentPath}/${file.name}`;
    files[full.slice(root.pathname.length - 1)] = await readFile(full, 'utf8');
  }
  return compileProject({ files, entry });
}

describe('production compiler boundaries', () => {
  test('Beast produces native TSRX and source mappings', () => {
    const beast = compileBeastModule('h1 Hello World', '/App.btsx');
    expect(beast.code).toContain('<h1>Hello World</h1>');
    expect(mapPosition({ line: 2, column: 2 }, beast.sourceMap)).toEqual({ line: 1, column: 1 });
    const octane = compileOctaneModule(beast.code, '/App.tsrx', beast.sourceMap);
    expect(octane.code).toContain("from 'octane'");
    expect(octane.code).not.toContain('function App() @{');
    expect(JSON.parse(octane.sourceMap).sources).toContain('/App.btsx');
  });
  test('compiles the real hello world project and all runtime imports resolve', async () => {
    const result = await compileProject(helloWorld);
    expect(result.diagnostics).toEqual([]);
    expect(result.entry).toBe('@playground/src/main.ts');
    expect(result.metadata.transformedFiles).toBe(2);
    const ids = new Set(result.modules.map(module => module.id));
    for (const module of result.modules) {
      const [imports] = parse(module.code);
      for (const item of imports) if (item.specifier) expect(ids.has(item.specifier)).toBe(true);
    }
    expect(result.assets.map(asset => asset.id)).toEqual(['/src/style.css']);
  });
  test('stylesheets importing Tailwind generate utilities used in project sources', async () => {
    const result = await compileProject({ entry: '/main.ts', files: {
      '/main.ts': "import './App.btsx'; import './style.css';",
      '/App.btsx': "div.flex.gap-4(class='p-[13px] text-red-500') Hi",
      '/style.css': '@import "tailwindcss";\n.custom { color: red; }',
    } });
    expect(result.diagnostics).toEqual([]);
    const css = result.assets.find(asset => asset.id === '/style.css')!.content;
    for (const rule of ['.flex', '.gap-4', '.p-\\[13px\\]', '.text-red-500', '.custom']) expect(css).toContain(rule);
    expect(css).not.toContain('@import');
    const plain = await compileProject({ entry: '/main.ts', files: { '/main.ts': "import './style.css';", '/style.css': '.flex { color: red; }' } });
    expect(plain.assets[0].content).toBe('.flex { color: red; }');
    const broken = await compileProject({ entry: '/main.ts', files: { '/main.ts': "import './style.css';", '/style.css': '@import "tailwindcss"; @apply nope;' } });
    expect(broken.entry).toBeUndefined();
  });
  test('the starter project exposes Tailwind utilities without Preflight', async () => {
    const result = await compileProject({ ...helloWorld, files: { ...helloWorld.files,
      '/src/App.btsx': helloWorld.files['/src/App.btsx'].replace('main.page', 'main.page.italic') } });
    expect(result.diagnostics).toEqual([]);
    const css = result.assets[0].content;
    expect(css).toContain('.italic');
    expect(css).not.toContain('@import');
    expect(css).toContain('.counter-row');
  });
  test('fixtures traverse nested and reexported modules', async () => {
    for (const [name, entry] of [['simple-component', '/App.btsx'], ['multiple-components', '/App.btsx'], ['imports', '/main.ts']]) {
      const result = await fixture(name, entry);
      expect(result.diagnostics).toEqual([]);
      expect(result.entry).toBeDefined();
    }
  });
  test('normalizes Beast and Octane errors to authored BTSX positions', async () => {
    const beast = await fixture('syntax-error');
    expect(beast.entry).toBeUndefined();
    expect(beast.diagnostics[0]).toMatchObject({ file: '/App.btsx', source: 'beast', start: { line: 2, column: 3 } });
    const octane = await fixture('octane-error');
    expect(octane.entry).toBeUndefined();
    expect(octane.diagnostics[0]).toMatchObject({ file: '/App.btsx', source: 'octane', start: { line: 1 } });
  });
  test('missing entry, missing dependency and unsupported package are diagnostics', async () => {
    const missingEntry = await compileProject({ entry: '/no.ts', files: {} });
    expect(missingEntry.diagnostics[0].source).toBe('web');
    for (const request of ['./missing', 'react', 'https://example.com/code.js']) {
      const result = await compileProject({ entry: '/main.ts', files: { '/main.ts': `import '${request}';` } });
      expect(result.entry).toBeUndefined();
      expect(result.diagnostics[0].source).toBe('web');
    }
  });
  test('reserves runtime paths and reports malformed JSON as a web diagnostic', async () => {
    const reserved = await compileProject({ entry: '/main.ts', files: { '/main.ts': '', '/@runtime/octane.js': '' } });
    expect(reserved.entry).toBeUndefined();
    expect(reserved.diagnostics[0].message).toContain('reserved');
    const json = await compileProject({ entry: '/data.json', files: { '/data.json': '{bad}' } });
    expect(json.diagnostics[0].source).toBe('web');
  });
  test('handles cycles deterministically and ignores unimported broken files', async () => {
    const project = { entry: '/a.ts', files: {
      '/a.ts': "import './b'; export const a = 1;",
      '/b.ts': "import './a'; export const b = 2;",
      '/unused.btsx': 'h1(title={)',
    } };
    const first = await compileProject(project);
    const second = await compileProject({ ...project, files: Object.fromEntries(Object.entries(project.files).reverse()) });
    expect(first.diagnostics).toEqual([]);
    expect(first.modules).toEqual(second.modules);
  });
  test('rewrites only imports, supports literal dynamic imports, rejects computed imports', () => {
    const linked = linkModule({ id: '/test.js', code: "const text = './a'; export { a } from './a'; import('./a');" }, () => '@playground/a.js');
    expect(linked.code).toContain("const text = './a'");
    expect(linked.code).toContain('from "@playground/a.js"');
    expect(linked.code).toContain('import("@playground/a.js")');
    const quoted = linkModule({ id: '/test.js', code: "import './a';" }, () => "@playground/a'quoted.js");
    expect(parse(quoted.code)[0][0].specifier).toBe("@playground/a'quoted.js");
    expect(() => linkModule({ id: '/test.js', code: 'import(request)' }, value => value)).toThrow('string literal');
    expect(() => linkModule({ id: '/test.js', code: 'import(`./${request}.js`)' }, value => value)).toThrow('string literal');
  });
  test('composes the final module map back to BTSX', async () => {
    const result = await fixture('simple-component');
    const module = result.modules.find(module => module.source === '/App.btsx')!;
    expect(JSON.parse(module.sourceMap!).sources).toEqual(['/App.btsx']);
    expect(JSON.parse(module.sourceMap!).sourcesContent[0]).toBe('h1 Hello World\n');
  });
});
