import { expect, test, type Page } from '@playwright/test';
import { PROJECT_STORAGE_KEY } from '../src/playground/project-storage';
import { createProjectShareURL } from '../src/playground/project-sharing';
import { helloWorld } from '../src/playground/examples';

const editor = (page: Page) => page.getByRole('textbox', { name: 'Source editor' });
async function edit(page: Page, source: string) {
  await editor(page).focus();
  await page.keyboard.press('ControlOrMeta+a');
  await page.keyboard.insertText(source);
}
async function ready(page: Page, url = '/') {
  await page.goto(url);
  await expect(page.locator('#preview-status')).toHaveText(/^Live(?: · HMR)?$/, { timeout: 20000 });
}
const saved = (page: Page) => page.evaluate(key => localStorage.getItem(key), PROJECT_STORAGE_KEY);

test('share snapshot imports only after review and restores files, selection, viewport and saved state', async ({ page, context }) => {
  await ready(page);
  await edit(page, 'h1 Shared 🌱 project\n');
  await expect(page.frameLocator('#preview-frame').getByRole('heading', { name: 'Shared 🌱 project' })).toBeVisible();
  await page.getByRole('button', { name: 'Mobile preview', exact: true }).click();
  await page.getByRole('button', { name: 'Open Counter.btsx', exact: true }).click();
  await page.getByRole('button', { name: 'Share project', exact: true }).click();
  const share = page.getByRole('dialog', { name: 'Share project', exact: true });
  await expect(share).toBeVisible();
  await expect(page.getByLabel('Project link')).toHaveValue(/#project=v1\./);
  const link = await page.getByLabel('Project link').inputValue();
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await share.getByRole('button', { name: 'Copy link', exact: true }).click();
  await expect(share.getByRole('status')).toHaveText('Link copied.');
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(link);
  await share.getByRole('button', { name: 'Close', exact: true }).click();
  await page.getByRole('button', { name: 'Open App.btsx', exact: true }).click();
  await edit(page, 'h1 My current project\n');
  await expect(page.frameLocator('#preview-frame').getByRole('heading', { name: 'My current project' })).toBeVisible();
  await expect(page.locator('#save-status')).toHaveText('Saved locally');
  const previous = await saved(page);

  await ready(page, link);
  const review = page.getByRole('dialog', { name: 'Open shared project' });
  await expect(review).toBeVisible();
  await expect(review.getByRole('button', { name: 'Replace project', exact: true })).toBeVisible();
  await expect(editor(page)).toContainText('My current project');
  expect(await saved(page)).toBe(previous);
  await review.locator('summary').filter({ hasText: '/src/App.btsx' }).click();
  await expect(review.locator('pre').filter({ hasText: 'Shared 🌱 project' })).toBeVisible();
  await page.screenshot({ path: 'test-results/shared-project-review.png', fullPage: true });
  await review.getByRole('button', { name: 'Keep current project', exact: true }).click();
  await expect(review).toHaveCount(0);
  expect(new URL(page.url()).hash).toBe('');
  expect(await saved(page)).toBe(previous);

  await ready(page, link);
  await review.getByRole('button', { name: 'Replace project', exact: true }).click();
  await expect(review).toHaveCount(0);
  await expect(page.frameLocator('#preview-frame').getByRole('heading', { name: 'Shared 🌱 project' })).toBeVisible();
  await expect(page.locator('#active-filename')).toHaveText('Counter.btsx');
  await expect(page.getByRole('button', { name: 'Mobile preview', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#save-status')).toHaveText('Saved locally');
  expect(new URL(page.url()).hash).toBe('');
  await page.getByRole('button', { name: 'Open App.btsx', exact: true }).click();
  await editor(page).focus(); await page.keyboard.press('ControlOrMeta+z');
  await expect(editor(page)).toContainText('h1 Shared 🌱 project');
  await page.getByRole('button', { name: 'Open Counter.btsx', exact: true }).click();
  await page.reload();
  await expect(page.locator('#active-filename')).toHaveText('Counter.btsx');
  await expect(page.frameLocator('#preview-frame').getByRole('heading', { name: 'Shared 🌱 project' })).toBeVisible();
});

test('invalid links and Escape keep the current saved project; same-page links can be reviewed', async ({ page }) => {
  await ready(page);
  await expect(page.locator('#save-status')).toHaveText('Saved locally');
  const previous = await saved(page);
  await ready(page, '/#project=v1.invalid');
  const dialog = page.getByRole('dialog', { name: 'Open shared project' });
  await expect(dialog.getByRole('alert')).toContainText('invalid');
  await expect(dialog.getByRole('button', { name: 'Replace project', exact: true })).toHaveCount(0);
  expect(await saved(page)).toBe(previous);
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  const url = await createProjectShareURL({ version: 1, project: helloWorld, activeFile: '/src/App.btsx', preview: { width: '100%' } }, page.url());
  await page.evaluate(hash => { location.hash = hash; }, new URL(url).hash);
  await expect(dialog.getByRole('button', { name: 'Replace project', exact: true })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  expect(await saved(page)).toBe(previous);
});

test('clipboard denial leaves a selectable link and sharing fits a small light-theme viewport', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await page.addInitScript(() => Object.defineProperty(navigator.clipboard, 'writeText', {
    value: async () => { throw new Error('Permission denied'); },
  }));
  await ready(page);
  await page.getByRole('button', { name: 'Light mode', exact: true }).click();
  await page.getByRole('button', { name: 'Share project', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Share project', exact: true });
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: 'Copy link', exact: true }).click();
  await expect(dialog.getByRole('status')).toContainText('copy it manually');
  await page.getByLabel('Project link').focus();
  const selection = await page.getByLabel('Project link').evaluate((node: HTMLTextAreaElement) => node.selectionEnd - node.selectionStart);
  expect(selection).toBeGreaterThan(100);
  const box = (await dialog.boundingBox())!;
  expect(box.x).toBeGreaterThanOrEqual(0); expect(box.x + box.width).toBeLessThanOrEqual(320);
  expect(box.y).toBeGreaterThanOrEqual(0); expect(box.y + box.height).toBeLessThanOrEqual(568);
  await page.screenshot({ path: 'test-results/share-project-mobile.png', fullPage: true });
});
