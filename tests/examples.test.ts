import { expect, test } from 'bun:test';
import { init, parse } from 'es-module-lexer';
import { compileProject } from '../src/playground/compiler';
import { examples } from '../src/playground/examples';

test('every example compiles through production compilers with a closed module graph', async () => {
  await init();
  expect(new Set(examples.map(example => example.id)).size).toBe(examples.length);
  for (const example of examples) {
    const result = await compileProject(example.project);
    expect(result.diagnostics).toEqual([]);
    expect(result.entry).toBeDefined();
    const ids = new Set(result.modules.map(module => module.id));
    expect(ids.has(result.entry!)).toBe(true);
    for (const module of result.modules) {
      for (const dependency of parse(module.code)[0]) {
        if (dependency.specifier) expect(ids.has(dependency.specifier)).toBe(true);
      }
    }
    expect(result.assets.some(asset => asset.id === '/src/style.css')).toBe(true);
  }
});
