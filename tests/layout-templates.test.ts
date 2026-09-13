import { expect, test } from 'bun:test';
import { init } from 'es-module-lexer';
import { compileProject } from '../src/playground/compiler';
import { layoutTemplates, templatePreviewProject } from '../src/playground/layout-templates';

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
