import { expect, test } from 'bun:test';
import { init } from 'es-module-lexer';
import { compileProject } from '../src/playground/compiler';
import { helloWorld } from '../src/playground/examples';
import { installLayoutTemplate, layoutTemplates, templatePreviewProject, topbarTemplates } from '../src/playground/layout-templates';

test('every layout template compiles in its preview project with Tailwind utilities', async () => {
  await init();
  const templates = Object.values(layoutTemplates).flat();
  expect(new Set(templates.map(template => template.id)).size).toBe(templates.length);
  for (const template of templates) {
    const result = await compileProject(templatePreviewProject(template));
    expect({ id: template.id, diagnostics: result.diagnostics }).toEqual({ id: template.id, diagnostics: [] });
    expect(result.entry).toBeDefined();
    const css = result.assets.find(asset => asset.id === '/src/style.css')!.content;
    expect(css).toContain('.items-center');
    expect(css).toContain('[data-theme=dark]');
  }
});

test('installing a template renders it above the app markup and compiles with theme-aware Tailwind', async () => {
  await init();
  const [template, other] = topbarTemplates;
  const install = installLayoutTemplate(helloWorld, template);
  expect(install).toMatchObject({ replaces: false, rendered: true });
  expect(Object.keys(install.files).sort()).toEqual(['/src/App.btsx', '/src/Topbar.btsx', '/src/style.css']);
  expect(install.files['/src/App.btsx']).toStartWith("import Counter from './Counter.btsx'\nimport Topbar from './Topbar.btsx'\n\nTopbar\nmain.page\n");
  const project = { ...helloWorld, files: { ...helloWorld.files, ...install.files } };
  const result = await compileProject(project);
  expect(result.diagnostics).toEqual([]);
  const css = result.assets.find(asset => asset.id === '/src/style.css')!.content;
  expect(css).toContain('.items-center');
  expect(css).toContain('[data-theme=dark]');
  expect(css).toContain('.page');

  expect(installLayoutTemplate(project, template)).toEqual({ files: {}, replaces: false, rendered: true });
  expect(installLayoutTemplate(project, other)).toEqual({ files: { '/src/Topbar.btsx': other.source }, replaces: true, rendered: true });
});

test('installing a template adapts to apps without imports or stylesheets, and leaves component blocks alone', () => {
  const [template] = topbarTemplates;
  const bare = { entry: '/src/main.ts', files: { '/src/main.ts': "import App from './App.btsx';\n", '/src/App.btsx': 'setup const x = 1;\n\nh1 Hello\n' } };
  const install = installLayoutTemplate(bare, template);
  expect(install.files['/src/App.btsx']).toBe("import Topbar from './Topbar.btsx'\n\nsetup const x = 1;\n\nTopbar\nh1 Hello\n");
  expect(install.files['/src/main.ts']).toBe("import App from './App.btsx';\nimport './style.css';\n");
  expect(install.files['/src/style.css']).toContain('@import "tailwindcss";');

  const components = { ...bare, files: { ...bare.files, '/src/App.btsx': 'component Page\n  h1 Hello\n' } };
  const partial = installLayoutTemplate(components, template);
  expect(partial.rendered).toBe(false);
  expect(partial.files).not.toHaveProperty('/src/App.btsx');
});
