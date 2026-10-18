import { expect, test } from 'bun:test';
import { init } from 'es-module-lexer';
import { compileProject } from '../src/playground/compiler';
import { helloWorld } from '../src/playground/examples';
import { pageRecipes, searchTemplates, sectionKinds, sectionTemplate, sectionTemplates, templatesOf } from '../src/playground/studio/catalog';
import { addSection, composePage, pagePreviewProject, planPageInstall, readPage, recipeBlocks, sectionFile, swapPreset } from '../src/playground/studio/page';
import { parsePreset } from '../src/playground/studio/ir/parse';
import { presetsFor } from '../src/playground/studio/presets';
import { builtInThemes } from '../src/playground/studio/themes';
import { builtInPresets, builtInRecipes } from './built-in-presets';

const presets = builtInPresets;

const withFiles = (project: typeof helloWorld, files: Record<string, string>, removes: string[] = []) => {
  const next = { ...project.files, ...files };
  for (const path of removes) delete next[path];
  return { ...project, files: next };
};

test('the catalog registers every kind with unique, well-formed templates', () => {
  expect(new Set(sectionTemplates.map(template => template.id)).size).toBe(sectionTemplates.length);
  expect(new Set(sectionKinds.map(kind => kind.component)).size).toBe(sectionKinds.length);
  for (const kind of sectionKinds) {
    expect({ kind: kind.id, templates: templatesOf(kind.id).length >= 2 }).toEqual({ kind: kind.id, templates: true });
    expect(kind.component).toMatch(/^[A-Z][A-Za-z]*$/);
  }
  for (const template of sectionTemplates) {
    expect(template.wireframe.length).toBeGreaterThan(0);
    const roots = template.source.split('\n').filter(line => /^[a-z]/.test(line) && !/^(?:import|setup|props|module|export)\b/.test(line));
    expect({ id: template.id, roots }).toEqual({ id: template.id, roots: [expect.stringContaining(`(data-section='${template.kind}'`)] });
  }
  for (const recipe of pageRecipes) expect(recipe.templates.filter(id => !sectionTemplate(id))).toEqual([]);
  for (const recipe of pageRecipes) if (recipe.themeId) expect(builtInThemes.map(theme => theme.themeId)).toContain(recipe.themeId);
});

test('section templates are monotone and self-contained so they fit any theme and preview', () => {
  const hue = /\b(?:bg|text|border|from|to|via|ring|fill|stroke|shadow|outline|divide|decoration|placeholder:text)-(?:white|black|(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-\d+)\b/;
  for (const template of sectionTemplates) {
    expect({ id: template.id, hue: template.source.match(hue)?.[0], dark: template.source.includes('dark:'), remote: /https?:\/\//.test(template.source) })
      .toEqual({ id: template.id, hue: undefined, dark: false, remote: false });
  }
});

test('every each and if branch renders a single node, which the preview compiler requires', () => {
  const crowded: string[] = [];
  const walk = (nodes: any[] = [], id: string) => {
    for (const node of nodes) {
      if (node.type === 'each' && node.children.length > 1) crowded.push(`${id}: each ${node.item}`);
      if (node.type === 'if') {
        for (const branch of node.branches) if (branch.children.length > 1) crowded.push(`${id}: if ${branch.test}`);
        if (node.otherwise?.length > 1) crowded.push(`${id}: else`);
      }
      walk(node.children, id);
      for (const branch of node.branches ?? []) walk(branch.children, id);
      walk(node.otherwise, id);
    }
  };
  for (const template of sectionTemplates) {
    walk([parsePreset(template.source, { id: template.id, kind: template.kind, title: template.title, description: template.description, wireframe: template.wireframe }).root], template.id);
  }
  expect(crowded).toEqual([]);
});

test('every section template compiles in a page preview with Tailwind utilities and studio styles', async () => {
  await init();
  for (const template of sectionTemplates) {
    const result = await compileProject(pagePreviewProject(helloWorld, addSection([], template.id, presets).blocks, presets));
    expect({ id: template.id, diagnostics: result.diagnostics }).toEqual({ id: template.id, diagnostics: [] });
    const css = result.assets.find(asset => asset.id === '/src/style.css')!.content;
    expect({ id: template.id, utilities: /currentcolor/.test(css), studio: css.includes('@keyframes studio-marquee') })
      .toEqual({ id: template.id, utilities: true, studio: true });
  }
});

test('search matches kinds, keywords, and template text', () => {
  expect(searchTemplates('').length).toBe(sectionTemplates.length);
  expect(new Set(searchTemplates('logos').map(template => template.kind))).toEqual(new Set(['partners']));
  expect(searchTemplates('pricing table').map(template => template.id)).toEqual(['pricing-compare']);
  expect(searchTemplates('zzz')).toEqual([]);
});

test('a studio preview with no sections shows the current app unchanged', async () => {
  const project = { entry: '/src/start.ts', files: {
    '/src/start.ts': helloWorld.files[helloWorld.entry].replace('./style.css', './custom.css'),
    '/src/App.btsx': "import Counter from './Counter.btsx'\n\nmain\n  h1 My current app\n  Counter\n",
    '/src/Counter.btsx': helloWorld.files['/src/Counter.btsx'],
    '/src/custom.css': 'h1 { color: rebeccapurple; }\n',
  } };
  const preview = pagePreviewProject(project, [], presets);
  expect(preview).toEqual(project);
  expect((await compileProject(preview)).diagnostics).toEqual([]);
});

test('staged sections preview inside the current app with its entry, components, and styles', async () => {
  const project = { entry: '/src/start.ts', files: {
    '/src/start.ts': helloWorld.files[helloWorld.entry].replace('./style.css', './custom.css'),
    '/src/App.btsx': "import Counter from './Counter.btsx'\n\nmain\n  h1 My current app\n  Counter\n",
    '/src/Counter.btsx': helloWorld.files['/src/Counter.btsx'],
    '/src/custom.css': '@import "tailwindcss";\nh1 { color: rebeccapurple; }\n',
  } };
  const before = structuredClone(project);
  const blocks = addSection([], 'hero-centered', presets).blocks;
  const preview = pagePreviewProject(project, blocks, presets);
  expect(preview.entry).toBe(project.entry);
  expect(preview.files['/src/App.btsx']).toContain('Page\nmain\n  h1 My current app\n  Counter');
  expect(preview.files['/src/Counter.btsx']).toBe(project.files['/src/Counter.btsx']);
  expect(preview.files['/src/custom.css']).toContain(project.files['/src/custom.css']);
  expect(preview.files['/src/start.ts']).toBe(project.files['/src/start.ts']);
  expect((await compileProject(preview)).diagnostics).toEqual([]);
  expect(project).toEqual(before);
});

test('previewing existing sections retains markup authored alongside them', async () => {
  const blocks = addSection([], 'hero-centered', presets).blocks;
  const install = planPageInstall(helloWorld, blocks, presets);
  const project = withFiles(helloWorld, install.files, install.removes);
  project.files['/src/Page.btsx'] += '  p Hand-written page content\n';
  project.files['/src/App.btsx'] += 'footer My app footer\n';
  const preview = pagePreviewProject(project, readPage(project, presets), presets, true);
  expect(preview.files['/src/Page.btsx']).toBe(project.files['/src/Page.btsx']);
  expect(preview.files['/src/App.btsx']).toBe(project.files['/src/App.btsx']);
  expect(preview.files[sectionFile('Hero')]).toContain('data-node');
  expect((await compileProject(preview)).diagnostics).toEqual([]);
});

test('removing the final staged section keeps the surrounding app in the preview', async () => {
  const app = withFiles(helloWorld, { '/src/App.btsx': 'h1 Keep this app\n' });
  const blocks = addSection([], 'hero-centered', presets).blocks;
  const install = planPageInstall(app, blocks, presets);
  const project = withFiles(app, install.files, install.removes);
  const preview = pagePreviewProject(project, [], presets);
  expect(preview.files['/src/App.btsx']).toContain('h1 Keep this app');
  expect(preview.files['/src/Page.btsx']).not.toContain('  Hero');
  expect(preview.files).not.toHaveProperty(sectionFile('Hero'));
  expect((await compileProject(preview)).diagnostics).toEqual([]);
});

test('every recipe is distinct and compiles as a complete installable page', async () => {
  await init();
  expect(new Set(pageRecipes.map(recipe => recipe.id)).size).toBe(pageRecipes.length);
  expect(new Set(pageRecipes.map(recipe => recipe.title)).size).toBe(pageRecipes.length);
  expect(new Set(pageRecipes.map(recipe => recipe.templates.join(','))).size).toBe(pageRecipes.length);
  for (const recipe of pageRecipes) {
    expect(sectionTemplate(recipe.templates[0])?.kind).toBe('topbar');
    expect(sectionTemplate(recipe.templates.at(-1)!)?.kind).toBe('footer');
    expect(recipe.templates.filter(id => sectionTemplate(id)?.kind === 'hero')).toHaveLength(1);
    const blocks = recipeBlocks(recipe.templates, presets);
    expect(blocks).toHaveLength(recipe.templates.length);
    const install = planPageInstall(helloWorld, blocks, presets);
    const result = await compileProject(withFiles(helloWorld, install.files, install.removes));
    expect({ recipe: recipe.id, diagnostics: result.diagnostics }).toEqual({ recipe: recipe.id, diagnostics: [] });
  }
}, 30000);

test('Convex catalog rows are narrowed to registered section kinds without breaking lookup caching', () => {
  const rows = [
    { presetId: 'hero-valid', kind: 'hero', title: 'Hero', description: '', wireframe: [], keywords: [], version: 1 },
    { presetId: 'unknown-kind', kind: 'unknown', title: 'Unknown', description: '', wireframe: [], keywords: [], version: 1 }
  ];
  const lookup = presetsFor(rows, undefined);
  expect(lookup.summaries.map(summary => summary.presetId)).toEqual(['hero-valid']);
  expect(presetsFor(rows, undefined)).toBe(lookup);
});

test('sections insert in story order, repeat with numbered names, and swap templates in place', () => {
  let { blocks } = addSection([], 'footer-simple', presets);
  ({ blocks } = addSection(blocks, 'hero-centered', presets));
  ({ blocks } = addSection(blocks, 'topbar-marketing', presets));
  ({ blocks } = addSection(blocks, 'features-grid', presets));
  const repeat = addSection(blocks, 'features-bento', presets);
  expect(repeat.name).toBe('Features2');
  expect(repeat.blocks.map(block => block.name)).toEqual(['Topbar', 'Hero', 'Features', 'Features2', 'Footer']);
  expect(addSection(blocks, 'cta-banner', presets, 0).blocks[0].name).toBe('CallToAction');
  expect(swapPreset(repeat.blocks, 'Hero', 'hero-split').find(block => block.name === 'Hero')?.presetId).toBe('hero-split');
});

test('installing a page on the starter replaces it and round-trips through Page.btsx', async () => {
  await init();
  const blocks = recipeBlocks(builtInRecipes.find(recipe => recipe.recipeId === 'saas-launch')!.presetIds, presets);
  const install = planPageInstall(helloWorld, blocks, presets);
  expect(install).toMatchObject({ replacesStarter: true, rendered: true, overwrites: [], removes: ['/src/Counter.btsx'] });
  expect(install.files['/src/App.btsx']).toBe("import Page from './Page.btsx'\n\nPage\n");
  expect(install.files['/src/style.css']).toStartWith('@import "tailwindcss";');
  expect(Object.keys(install.files)).toContain(sectionFile('Pricing'));

  const project = withFiles(helloWorld, install.files, install.removes);
  const result = await compileProject(project);
  expect(result.diagnostics).toEqual([]);
  expect(readPage(project, presets)).toEqual(blocks);
  expect(planPageInstall(project, blocks, presets)).toEqual({ files: {}, removes: [], overwrites: [], replacesStarter: false, rendered: true });
});

test('updating a page removes unused sections, keeps edited ones, and reports edits it replaces', () => {
  const blocks = recipeBlocks(builtInRecipes.find(recipe => recipe.recipeId === 'waitlist')!.presetIds, presets);
  const installed = planPageInstall(helloWorld, blocks, presets);
  const project = withFiles(helloWorld, installed.files, installed.removes);
  const edited = withFiles(project, { [sectionFile('Hero')]: '// mine\n' + project.files[sectionFile('Hero')], [sectionFile('Team')]: 'section(data-section=\'team\') Custom\n' });

  const restored = readPage(edited, presets);
  // The marker keeps the preset link through a hand edit; `edited` is what says the file now wins.
  expect(restored.find(block => block.name === 'Hero')).toMatchObject({ presetId: 'hero-waitlist', edited: true });
  expect(pagePreviewProject(edited, restored, presets).files[sectionFile('Hero')]).toStartWith('// mine');

  const withoutFaqAndTeam = restored.filter(block => block.name !== 'Faq' && block.name !== 'Team');
  const trimmed = planPageInstall(edited, withoutFaqAndTeam, presets);
  expect(trimmed.removes).toEqual([sectionFile('Faq')]);
  expect(trimmed.overwrites).toEqual([]);
  expect(trimmed.files).not.toHaveProperty(sectionFile('Hero'));

  const swapped = planPageInstall(edited, swapPreset(restored, 'Hero', 'hero-centered'), presets);
  expect(swapped.overwrites).toEqual([sectionFile('Hero')]);
  const handEditedPage = withFiles(edited, { '/src/Page.btsx': edited.files['/src/Page.btsx'] + '  p Hand-written\n' });
  expect(planPageInstall(handEditedPage, withoutFaqAndTeam, presets).overwrites).toEqual(['/src/Page.btsx']);
});

test('installing into an existing app renders the page above its markup and adds studio styles once', () => {
  const app = { entry: '/src/main.ts', files: {
    '/src/main.ts': "import App from './App.btsx';\n",
    '/src/App.btsx': 'setup const x = 1;\n\nh1 Hello\n',
    '/src/theme.css': '@import "tailwindcss";\nbody { margin: 0 }\n',
  } };
  const blocks = addSection([], 'hero-centered', presets).blocks;
  const install = planPageInstall(app, blocks, presets);
  expect(install).toMatchObject({ replacesStarter: false, rendered: true, removes: [] });
  expect(install.files['/src/App.btsx']).toBe("import Page from './Page.btsx'\n\nsetup const x = 1;\n\nPage\nh1 Hello\n");
  expect(install.files['/src/theme.css']).toStartWith('@import "tailwindcss";\nbody { margin: 0 }\n\n/* Design Studio sections');
  expect(install.files).not.toHaveProperty('/src/main.ts');
  const again = planPageInstall(withFiles(app, install.files), blocks, presets);
  expect(again.files).toEqual({});

  const bare = { ...app, files: { '/src/main.ts': app.files['/src/main.ts'], '/src/App.btsx': 'component Page\n  h1 Hello\n' } };
  const partial = planPageInstall(bare, blocks, presets);
  expect(partial.rendered).toBe(false);
  expect(partial.files['/src/main.ts']).toBe("import App from './App.btsx';\nimport './style.css';\n");
  expect(composePage([])).toContain("div(data-page='home')");
});
