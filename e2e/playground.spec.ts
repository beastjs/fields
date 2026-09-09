import { expect, test, type Page } from '@playwright/test';

const sourceEditor = (page: Page) => page.getByRole('textbox', { name: 'Source editor' });
async function replaceSource(page: Page, text: string) {
  const editor = sourceEditor(page);
  await editor.focus();
  await page.keyboard.press('ControlOrMeta+a');
  await page.keyboard.insertText(text);
}
async function openFile(page: Page, file: string) {
  await page.getByRole('button', { name: `Open ${file}`, exact: true }).click();
}
async function ready(page: Page) {
  await page.goto('/');
  await expect(page.frameLocator('#preview-frame').getByRole('heading', { name: 'Hello, world.' })).toBeVisible({ timeout: 20000 });
  await expect(page.locator('#preview-status')).toHaveText('Live');
}

test('compiles and renders real Beast components, events and styles', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await ready(page);
  const frame = page.frameLocator('#preview-frame');
  await frame.getByRole('button', { name: 'Increase count' }).click();
  await expect(frame.locator('.value')).toHaveText('1');
  await expect(frame.locator('.page')).toHaveCSS('padding-top', '80px');
  await expect(page.locator('#problem-count')).toHaveText('0');
  await page.getByRole('tab', { name: 'Generated code' }).click();
  await expect(page.locator('#generated-code')).toContainText('export default function App');
  await page.getByRole('button', { name: 'Web / JavaScript', exact: true }).click();
  await expect(page.locator('#generated-code')).toContainText('@playground/@runtime/octane.js');
  await page.getByRole('tab', { name: /Console/ }).click();
  await expect(page.locator('#console-list')).toContainText('Hello from the preview.');
  expect(errors).toEqual([]);
  await page.screenshot({ path: 'test-results/playground-desktop.png', fullPage: true });
});

test('edits, diagnoses errors, preserves last good preview and recovers', async ({ page }) => {
  await ready(page);
  await replaceSource(page, 'h1 A fresh idea\n');
  await expect(page.frameLocator('#preview-frame').getByRole('heading', { name: 'A fresh idea' })).toBeVisible();
  await replaceSource(page, 'h1(title={) Broken\n');
  await expect(page.locator('#build-status')).toHaveText('Build failed');
  await expect(page.locator('#problems-list')).toContainText('closing parenthesis');
  await expect(page.locator('.cm-lintRange-error')).toBeVisible();
  await expect(page.frameLocator('#preview-frame').getByRole('heading', { name: 'A fresh idea' })).toBeVisible();
  await replaceSource(page, 'h1 Recovered\n');
  await expect(page.frameLocator('#preview-frame').getByRole('heading', { name: 'Recovered' })).toBeVisible();
  await expect(page.locator('#problem-count')).toHaveText('0');
  await expect(page.locator('#preview-error')).toBeHidden();
});

test('multiple files, new imports, runtime errors and reload recover', async ({ page }) => {
  await ready(page);
  await page.getByRole('button', { name: 'Add file', exact: true }).click();
  await page.getByLabel('New file path').fill('Greeting.btsx');
  await page.getByRole('button', { name: 'Add', exact: true }).click();
  await replaceSource(page, 'h2 From another file\n');
  await openFile(page, 'App.btsx');
  await replaceSource(page, "import Greeting from './Greeting.btsx'\n\nmain\n  h1 Connected\n  Greeting\n");
  await expect(page.frameLocator('#preview-frame').getByRole('heading', { name: 'From another file' })).toBeVisible();
  await openFile(page, 'main.ts');
  await replaceSource(page, "throw new Error('Intentional runtime error');\n");
  await expect(page.locator('#preview-error')).toContainText('Intentional runtime error');
  await expect(page.locator('#console-list')).toContainText('Intentional runtime error');
  await replaceSource(page, "import { createRoot } from 'octane';\nimport App from './App.btsx';\ncreateRoot(document.getElementById('app')!).render(App, {});\n");
  await expect(page.frameLocator('#preview-frame').getByRole('heading', { name: 'Connected' })).toBeVisible();
  await page.getByRole('button', { name: 'Reload preview', exact: true }).click();
  await expect(page.frameLocator('#preview-frame').getByRole('heading', { name: 'Connected' })).toBeVisible();
});

test('preview cannot read parent DOM or storage and rejects unrelated messages', async ({ page }) => {
  await ready(page);
  await expect(page.locator('#preview-frame')).toHaveAttribute('sandbox', 'allow-scripts');
  const frame = page.frames().find(frame => frame.parentFrame() !== null)!;
  const access = await frame.evaluate(() => {
    let dom = false;
    let storage = false;
    try { void parent.document.body; dom = true; } catch {}
    try { void localStorage.length; storage = true; } catch {}
    return { dom, storage };
  });
  expect(access).toEqual({ dom: false, storage: false });
  const networkBlocked = await frame.evaluate(async () => {
    try { await fetch('https://example.com'); return false; } catch { return true; }
  });
  expect(networkBlocked).toBe(true);
  await frame.evaluate(() => parent.postMessage({ version: 1, type: 'runtime-error', channel: 'fake', build: 1, message: 'Injected from frame' }, '*'));
  await page.evaluate(() => window.postMessage({ version: 1, type: 'runtime-error', channel: 'fake', build: 1, message: 'Injected' }, '*'));
  await expect(page.locator('#preview-error')).toBeHidden();
});

test('mobile layout keeps editor and preview usable without page overflow', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await ready(page);
  const width = await page.evaluate(() => ({ content: document.documentElement.scrollWidth, viewport: innerWidth }));
  expect(width.content).toBeLessThanOrEqual(width.viewport);
  await expect(page.locator('#editor')).toBeVisible();
  await page.screenshot({ path: 'test-results/playground-mobile.png', fullPage: true });
});
