import { expect, test } from '@playwright/test';
import { helloWorld } from '../src/playground/examples';
import { PROJECT_STORAGE_KEY } from '../src/playground/project-storage';
import { STUDIO_STYLESHEET } from '../src/playground/studio/page';

for (const width of [1440, 720, 390]) {
  test(`layout inspector stays outside the canvas and commits edits at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 960 });
    const project = { ...helloWorld, files: { ...helloWorld.files,
      '/src/App.btsx': "import Page from './Page.btsx'\n\nPage\n",
      '/src/Page.btsx': "import Hero from './sections/Hero.btsx'\n\nmain(data-page)\n  Hero\n",
      '/src/sections/Hero.btsx': "section(className='p-4' data-section='hero')\n  h1(className='p-2') Inspector example\n  p Select a property to edit.\n",
      '/src/style.css': STUDIO_STYLESHEET,
    } };
    await page.addInitScript(({ key, project }) => {
      if (window !== window.top || sessionStorage.getItem('inspector-seeded')) return;
      localStorage.setItem(key, JSON.stringify(project));
      sessionStorage.setItem('inspector-seeded', 'yes');
    }, { key: PROJECT_STORAGE_KEY, project });
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto('/playground');
    await page.getByRole('button', { name: 'Design Studio', exact: true }).click();
    const studio = page.getByRole('dialog', { name: 'Design Studio' });
    const draft = page.frameLocator('iframe[data-front="true"]');
    await expect(draft.getByRole('heading', { name: 'Inspector example' })).toBeVisible();
    await studio.getByRole('button', { name: 'Fine Layout', exact: true }).click();
    const heading = draft.getByRole('heading', { name: 'Inspector example' });
    await expect(heading).toHaveAttribute('data-node', /.+/);
    await heading.click();
    const inspector = studio.getByRole('region', { name: 'Element properties' });
    const padding = inspector.getByRole('spinbutton', { name: 'Padding top', exact: true });
    await expect(padding).toHaveValue('8');
    const panel = (await inspector.boundingBox())!;
    const canvas = (await page.locator('iframe[data-front="true"]').boundingBox())!;
    expect(panel.x >= canvas.x + canvas.width + 8 || panel.y >= canvas.y + canvas.height + 8).toBeTruthy();
    expect(panel.x).toBeGreaterThanOrEqual(0);
    expect(panel.x + panel.width).toBeLessThanOrEqual(width);
    if (width === 390) expect(panel.y).toBeGreaterThan(canvas.y + canvas.height);
    await padding.fill('24');
    await padding.press('Enter');
    await expect(heading).toHaveCSS('padding-top', '24px');
    await expect(inspector.getByRole('button', { name: 'Reset', exact: true })).toBeEnabled();
    await inspector.getByRole('button', { name: 'Reset', exact: true }).click();
    await expect(heading).toHaveCSS('padding-top', '8px');
    await expect(padding).toHaveValue('8');
    await padding.fill('32');
    await padding.press('Escape');
    await expect(padding).toHaveValue('8');
    await expect(inspector.getByRole('button', { name: 'Reset', exact: true })).toBeDisabled();
    await inspector.getByRole('slider', { name: 'Padding top slider' }).focus();
    await page.keyboard.press('ArrowRight');
    await expect(heading).toHaveCSS('padding-top', '9px');
    await studio.getByRole('button', { name: 'Update page', exact: true }).click();
    await expect(studio.getByRole('button', { name: 'Page is up to date' })).toBeDisabled();
    await page.screenshot({ path: `test-results/layout-inspector-${width}.png` });
    await studio.getByRole('button', { name: 'Close', exact: true }).click();
    await expect(page.frameLocator('#preview-frame').getByRole('heading', { name: 'Inspector example' })).toHaveCSS('padding-top', '9px');
    expect(errors).toEqual([]);
  });
}
