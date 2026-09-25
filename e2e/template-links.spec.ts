import { expect, test } from '@playwright/test';
import { helloWorld } from '../src/playground/examples';
import { PROJECT_STORAGE_KEY } from '../src/playground/project-storage';
import { sectionTemplates } from '../src/playground/studio/catalog';

test('template placeholders and legacy links never navigate the preview to the host home page', async ({ page }) => {
  const template = sectionTemplates.find(template => template.id === 'topbar-default')!;
  const project = { ...helloWorld, files: { ...helloWorld.files,
    '/src/Topbar.btsx': template.source,
    '/src/App.btsx': `import Topbar from './Topbar.btsx'\n\nmain\n  Topbar\n  section(data-section='legacy')\n    a(href='#') Old placeholder\n    a(href='/') Old home\n    a(href='#pricing') See pricing\n  div(style={{ height: '1800px' }})\n  h2#pricing Pricing\n`,
  } };
  await page.addInitScript(({ key, project }) => localStorage.setItem(key, JSON.stringify({ version: 1, project, activeFile: '/src/App.btsx', preview: { width: '100%' } })), { key: PROJECT_STORAGE_KEY, project });
  await page.goto('/playground');
  const preview = page.frameLocator('#preview-frame');
  const brand = preview.getByRole('link', { name: 'Nova' });
  await expect(brand).toBeVisible({ timeout: 20000 });
  await expect(brand).not.toHaveAttribute('href');
  await brand.click({ force: true });
  await preview.getByRole('link', { name: 'Old placeholder', exact: true }).click();
  await preview.getByRole('link', { name: 'Old home', exact: true }).click();
  await preview.getByRole('link', { name: 'See pricing', exact: true }).click();
  await expect(preview.getByRole('heading', { name: 'Pricing', exact: true })).toBeInViewport();
  await expect(brand).toBeAttached();
  expect(page.url()).toContain('/playground');
  expect(await preview.locator('body').evaluate(() => location.href)).toBe('about:srcdoc');
});
