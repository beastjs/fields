import { beforeAll, describe, expect, test } from 'bun:test';
import { init, parse } from 'es-module-lexer';
import { compileProject } from '../src/playground/compiler';
import { helloWorld } from '../src/playground/examples';
import { buildSite, SITE_MODULE_PREFIX, sitePathForModule } from '../src/playground/site-build';

beforeAll(() => init());

const importMapOf = (html: string) =>
  JSON.parse(html.match(/<script type="importmap">(.*?)<\/script>/)![1]).imports as Record<string, string>;

describe('site compile target', () => {
  test('emits the same module graph without HMR boundaries or source maps', async () => {
    const preview = await compileProject(helloWorld);
    const site = await compileProject(helloWorld, 'site');
    expect(site.diagnostics).toEqual([]);
    expect(site.entry).toBe(preview.entry);
    expect(site.modules.map(module => module.id)).toEqual(preview.modules.map(module => module.id));
    for (const module of site.modules) {
      expect(module.sourceMap).toBeUndefined();
      expect(module.hot).toBeUndefined();
      expect(module.code).not.toContain('__playgroundHot');
      expect(module.code).not.toContain('import.meta.hot');
    }
  });
});

describe('buildSite', () => {
  test('maps every module id to a served file through the import map', async () => {
    const result = await compileProject(helloWorld, 'site');
    const site = buildSite(result, { title: 'Hello' });
    const [index, ...modules] = site.files;
    expect(index.path).toBe('/index.html');
    expect(index.contentType).toStartWith('text/html');
    const imports = importMapOf(index.content);
    expect(Object.keys(imports).sort()).toEqual(result.modules.map(module => module.id).sort());
    const served = new Map(modules.map(file => [file.path, file.content]));
    for (const [id, url] of Object.entries(imports)) {
      const path = decodeURIComponent(url);
      expect(path).toStartWith(`${SITE_MODULE_PREFIX}/`);
      // Every import inside a served module is a bare id the map resolves.
      for (const item of parse(served.get(path)!)[0]) if (item.specifier) expect(imports[item.specifier]).toBeDefined();
      expect(served.get(path)).toBe(result.modules.find(module => module.id === id)!.code);
    }
    expect(index.content).toContain(`import ${JSON.stringify(result.entry)};`);
    expect(site.bytes).toBeGreaterThan(index.content.length);
  });

  test('module paths are content-addressed and cannot collide', () => {
    const path = sitePathForModule('@playground/a.ts', 'x');
    expect(path).toMatch(/^\/_m\/[0-9a-z]+\/a\.ts\.js$/);
    expect(sitePathForModule('@playground/a.ts', 'x')).toBe(path);
    expect(sitePathForModule('@playground/a.ts', 'y')).not.toBe(path);
    expect(sitePathForModule('@playground/a.ts.js', 'x')).toBe(path.replace(/\.js$/, '.js.js'));
    expect(() => sitePathForModule('octane', 'x')).toThrow();
  });

  test('escapes the title, tokens and import map out of their elements', async () => {
    const result = await compileProject({ entry: '/main.ts', files: { '/main.ts': "import './odd </script> name.ts';", '/odd </script> name.ts': 'export {};' } }, 'site');
    expect(result.diagnostics).toEqual([]);
    const html = buildSite(result, { title: '<b>Me & you</b>', tokensCss: ':root{--x:1}</style><script>alert(1)</script>' }).files[0].content;
    expect(html).toContain('<title>&lt;b&gt;Me &amp; you&lt;/b&gt;</title>');
    expect(html.match(/<\/style>/g)).toHaveLength(2);
    // The theme, import map and entry scripts; the one inside the tokens is inert text, since only </style> ends a style.
    expect(html.match(/<\/script>/g)).toHaveLength(4);
    const urls = Object.values(importMapOf(html));
    expect(urls.some(url => /^\/_m\/[0-9a-z]+\/odd%20%3C\/script%3E%20name\.ts\.js$/.test(url))).toBe(true);
    expect(urls.some(url => /^\/_m\/[0-9a-z]+\/@runtime\/octane\.js\.js$/.test(url))).toBe(true);
  });

  test('pins or follows the color scheme', async () => {
    const result = await compileProject(helloWorld, 'site');
    const system = buildSite(result, { title: 'x' }).files[0].content;
    expect(system).toContain('<html><head>');
    expect(system).toContain('prefers-color-scheme: dark');
    const dark = buildSite(result, { title: 'x', theme: 'dark' }).files[0].content;
    expect(dark).toContain('<html data-theme="dark">');
    expect(dark).not.toContain('prefers-color-scheme');
  });

  test('refuses preview builds and failed compiles', async () => {
    const preview = await compileProject(helloWorld);
    expect(() => buildSite(preview, { title: 'x' })).toThrow('compile with the `site` target');
    const failed = await compileProject({ entry: '/missing.ts', files: { '/main.ts': '' } }, 'site');
    expect(() => buildSite(failed, { title: 'x' })).toThrow('compile error');
  });
});
