import { expect, test } from 'bun:test';
import { compileProject } from '../src/playground/compiler';
import { helloWorld } from '../src/playground/examples';
import { planHotUpdate } from '../src/playground/hot-update';

test('production compiler emits self-accepting boundaries and stable imports for component updates', async () => {
  const first = await compileProject(helloWorld);
  const next = await compileProject({ ...helloWorld, files: { ...helloWorld.files,
    '/src/Counter.btsx': helloWorld.files['/src/Counter.btsx'].replace('A LITTLE INTERACTION', 'Updated counter') } });
  const update = planHotUpdate(first, next)!;
  expect(update.modules.map(module => module.source)).toEqual(['/src/Counter.btsx']);
  expect(update.modules[0].hot?.exports).toEqual(['default']);
  expect(update.modules[0].code).toContain('import.meta.hot.accept');
  expect(update.modules[0].code).toContain('__octaneComponents');
  expect(update.modules[0].code).toContain('globalThis.__playgroundHot');
  expect(update.styles).toEqual([]);
  const differentHelpers = await compileProject({ ...helloWorld, files: { ...helloWorld.files, '/src/Counter.btsx': 'button Simple component\n' } });
  expect(planHotUpdate(first, differentHelpers)?.modules.map(module => module.source)).toEqual(['/src/Counter.btsx']);
});

test('CSS changes update styles while entry, helper, import graph, or boundary changes reload', async () => {
  const first = await compileProject(helloWorld);
  const css = await compileProject({ ...helloWorld, files: { ...helloWorld.files, '/src/style.css': 'h1 { color: red; }' } });
  expect(planHotUpdate(first, css)).toEqual({ modules: [], styles: [{ id: '/src/style.css', content: 'h1 { color: red; }' }] });
  for (const files of [
    { ...helloWorld.files, '/src/main.ts': helloWorld.files['/src/main.ts'] + '\nconsole.log("new entry");' },
    { ...helloWorld.files, '/src/App.btsx': 'h1 Removed import' },
    { ...helloWorld.files, '/src/App.btsx': "import './extra.ts'\nh1 Added import", '/src/extra.ts': '' },
    { ...helloWorld.files, '/src/Counter.btsx': "module export const value = 1;\n" + helloWorld.files['/src/Counter.btsx'] },
  ]) {
    expect(planHotUpdate(first, await compileProject({ ...helloWorld, files }))).toBeUndefined();
  }
  expect(planHotUpdate(first, first)).toEqual({ modules: [], styles: [] });
});
