import { expect, test, type Page } from '@playwright/test';
import { PROJECT_STORAGE_KEY } from '../src/playground/project-storage';

const editor = (page: Page) => page.getByRole('textbox', { name: 'Source editor' });
async function edit(page: Page, source: string) {
  await editor(page).focus();
  await page.keyboard.press('ControlOrMeta+a');
  await page.keyboard.insertText(source);
}
const heading = (page: Page, name: string) => page.frameLocator('#preview-frame').getByRole('heading', { name, exact: true });
async function ready(page: Page) {
  await page.goto('/');
  await expect(heading(page, 'Hello, world.')).toBeVisible({ timeout: 20000 });
}

test('restores edited files, additions, deletions, active tab, and viewport after reload', async ({ page }) => {
  await ready(page);
  await page.getByRole('button', { name: 'Add file', exact: true }).click();
  await page.getByLabel('New file path').fill('Greeting.btsx');
  await page.getByRole('button', { name: 'Add', exact: true }).click();
  await edit(page, 'h2 Kept across reloads\n');
  await page.getByRole('button', { name: 'Open App.btsx', exact: true }).click();
  await edit(page, "import Greeting from './Greeting.btsx'\nmain\n  h1 Saved workspace\n  Greeting\n");
  await expect(heading(page, 'Kept across reloads')).toBeVisible();
  await page.locator('.file-row').filter({ has: page.getByRole('button', { name: 'Open Counter.btsx', exact: true }) }).hover();
  await page.getByRole('button', { name: 'Delete Counter.btsx', exact: true }).click();
  await page.getByRole('button', { name: 'Open Greeting.btsx', exact: true }).click();
  await page.getByRole('button', { name: 'Mobile preview', exact: true }).click();
  await expect(page.locator('#save-status')).toHaveText('Saved locally');
  await page.reload();
  await expect(heading(page, 'Saved workspace')).toBeVisible();
  await expect(heading(page, 'Kept across reloads')).toBeVisible();
  await expect(page.locator('#active-filename')).toHaveText('Greeting.btsx');
  await expect(editor(page)).toContainText('h2 Kept across reloads');
  await expect(page.getByRole('tab', { name: 'Counter.btsx', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Mobile preview', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#preview-frame')).toHaveCSS('width', '375px');
  await page.screenshot({ path: 'test-results/persisted-workspace.png', fullPage: true });
});

test('immediate reload flushes edits, including invalid source, then compilation recovers', async ({ page }) => {
  await ready(page);
  await edit(page, 'h1(title={) Saved broken source\n');
  await page.reload();
  await expect(editor(page)).toContainText('Saved broken source');
  await expect(page.locator('#build-status')).toHaveText('Build failed');
  await edit(page, 'h1 Recovered saved project\n');
  await expect(heading(page, 'Recovered saved project')).toBeVisible();
});

test('reset can be cancelled and replaces source, saved state, preview, and editor history when accepted', async ({ page }) => {
  await ready(page);
  await page.getByRole('button', { name: 'Open Counter.btsx', exact: true }).click();
  await edit(page, 'h2 Old cached component\n');
  await page.getByRole('button', { name: 'Open App.btsx', exact: true }).click();
  await edit(page, 'h1 Before reset\n');
  await expect(heading(page, 'Before reset')).toBeVisible();
  await page.getByRole('button', { name: 'Mobile preview', exact: true }).click();
  page.once('dialog', dialog => dialog.dismiss());
  await page.getByRole('button', { name: 'Reset project', exact: true }).click();
  await expect(editor(page)).toContainText('Before reset');
  page.once('dialog', dialog => dialog.accept());
  await page.getByRole('button', { name: 'Reset project', exact: true }).click();
  await expect(heading(page, 'Hello, world.')).toBeVisible();
  await expect(editor(page)).toContainText('import Counter');
  await editor(page).focus();
  await page.keyboard.press('ControlOrMeta+z');
  await expect(editor(page)).toContainText('import Counter');
  await page.getByRole('button', { name: 'Open Counter.btsx', exact: true }).click();
  await expect(editor(page)).not.toContainText('Old cached component');
  await expect(page.getByRole('button', { name: 'Desktop preview', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await page.reload();
  await expect(heading(page, 'Hello, world.')).toBeVisible();
  await expect(editor(page)).not.toContainText('Old cached component');
});

for (const raw of ['{corrupt', '{"version":99}']) {
  test(`preserves unreadable saved data (${raw}) until explicit reset`, async ({ page }) => {
    await page.addInitScript(({ key, raw }) => {
      if (!sessionStorage.getItem('persistence-seeded')) {
        localStorage.setItem(key, raw); sessionStorage.setItem('persistence-seeded', 'yes');
      }
    }, { key: PROJECT_STORAGE_KEY, raw });
    await ready(page);
    await expect(page.locator('#save-notice')).toBeVisible();
    await edit(page, 'h1 Still usable\n');
    await expect(heading(page, 'Still usable')).toBeVisible();
    expect(await page.evaluate(key => localStorage.getItem(key), PROJECT_STORAGE_KEY)).toBe(raw);
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(page.getByRole('separator', { name: 'Resize editor and preview', exact: true })).toHaveAttribute('aria-orientation', 'horizontal');
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
    await page.screenshot({ path: 'test-results/persistence-recovery-mobile.png', fullPage: true });
    page.once('dialog', dialog => dialog.accept());
    await page.getByRole('button', { name: 'Reset project', exact: true }).click();
    await expect(page.locator('#save-notice')).toBeHidden();
    await page.reload();
    await expect(heading(page, 'Hello, world.')).toBeVisible();
    expect(await page.evaluate(key => JSON.parse(localStorage.getItem(key)!).version, PROJECT_STORAGE_KEY)).toBe(1);
  });
}

test('storage write failures remain visible without preventing edits or compilation', async ({ page }) => {
  await page.addInitScript(key => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function(name, value) {
      if (name === key) throw new DOMException('Quota exceeded', 'QuotaExceededError');
      return original.call(this, name, value);
    };
  }, PROJECT_STORAGE_KEY);
  await ready(page);
  await expect(page.locator('#save-notice')).toContainText('storage is full or unavailable');
  await edit(page, 'h1 Works without storage\n');
  await expect(heading(page, 'Works without storage')).toBeVisible();
  await expect(page.locator('#save-status')).toHaveText('Not saved');
});
