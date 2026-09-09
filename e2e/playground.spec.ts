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

test('nested runtime frames navigate to authored BTSX and become stale after edits', async ({ page }) => {
  await ready(page);
  await openFile(page, 'Counter.btsx');
  const source = "setup\n  const fail = () => {\n    throw new Error('Nested component failure');\n  };\n\nbutton(onClick={fail}) Throw from child\n";
  await replaceSource(page, source);
  const trigger = page.frameLocator('#preview-frame').getByRole('button', { name: 'Throw from child' });
  await expect(trigger).toBeVisible();
  await openFile(page, 'App.btsx');
  await trigger.click();
  await expect(page.locator('#preview-error')).toContainText('Nested component failure');
  const link = page.locator('.runtime-source-link').filter({ hasText: /^Counter\.btsx:3:/ }).first();
  await expect(link).toBeEnabled();
  await link.click();
  await expect(page.locator('#active-filename')).toHaveText('Counter.btsx');
  await expect(page.locator('.cm-activeLine')).toContainText("throw new Error('Nested component failure')");
  await expect(sourceEditor(page)).toBeFocused();
  await expect(page.locator('.cm-lintRange-error')).toBeVisible();
  await replaceSource(page, "// Changed after the error\n" + source);
  await expect(page.locator('.runtime-source-link').filter({ hasText: /^Counter\.btsx:3:.*source changed/ }).first()).toBeDisabled();
  await expect(page.locator('#preview-status')).toHaveText('Live');
  await page.screenshot({ path: 'test-results/runtime-source-navigation.png', fullPage: true });
});

test('rejected promises map to authored TypeScript locations', async ({ page }) => {
  await ready(page);
  await openFile(page, 'main.ts');
  await replaceSource(page, "const fail = async () => {\n  throw new Error('Async module failure');\n};\nvoid fail();\n");
  await expect(page.locator('#preview-error')).toContainText('Async module failure');
  const link = page.locator('.runtime-source-link').filter({ hasText: /^main\.ts:2:/ }).first();
  await expect(link).toBeEnabled();
  await link.click();
  await expect(page.locator('.cm-activeLine')).toContainText("throw new Error('Async module failure')");
});

test('Vim supports modal edits, undo, file switching, :w, and a remembered toggle', async ({ page }) => {
  await ready(page);
  await replaceSource(page, 'h1 Vim sample\n');
  await expect(page.frameLocator('#preview-frame').getByRole('heading', { name: 'Vim sample', exact: true })).toBeVisible();
  await openFile(page, 'Counter.btsx');
  await openFile(page, 'App.btsx');
  const toggle = page.getByRole('button', { name: 'Vim mode', exact: true });
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('.cm-vim-panel')).toContainText('NORMAL');
  await page.keyboard.type('ggA');
  await expect(page.locator('.cm-vim-panel')).toContainText('INSERT');
  await page.keyboard.type(' from Vim');
  await page.keyboard.press('Escape');
  await expect(page.locator('.cm-vim-panel')).toContainText('NORMAL');
  await expect(page.frameLocator('#preview-frame').getByRole('heading', { name: 'Vim sample from Vim' })).toBeVisible();
  await page.keyboard.type('u');
  await expect(page.frameLocator('#preview-frame').getByRole('heading', { name: 'Vim sample', exact: true })).toBeVisible();
  await page.keyboard.press('Control+r');
  await expect(page.frameLocator('#preview-frame').getByRole('heading', { name: 'Vim sample from Vim' })).toBeVisible();
  const previousBuild = await page.locator('#preview-frame').getAttribute('srcdoc');
  await page.keyboard.type(':w');
  await page.keyboard.press('Enter');
  await expect(page.locator('#preview-frame')).not.toHaveAttribute('srcdoc', previousBuild!);
  await openFile(page, 'Counter.btsx');
  await expect(page.locator('.cm-vim-panel')).toContainText('NORMAL');
  await toggle.click();
  await openFile(page, 'App.btsx');
  await expect(page.locator('.cm-vim-panel')).toHaveCount(0);
  await sourceEditor(page).focus();
  await page.keyboard.press('ControlOrMeta+z');
  await expect(sourceEditor(page)).toContainText('h1 Vim sample');
  await expect(sourceEditor(page)).not.toContainText('from Vim');
  await toggle.click();
  await page.reload();
  await expect(toggle).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('.cm-vim-panel')).toContainText('NORMAL');
  await toggle.click();
  await page.reload();
  await expect(toggle).toHaveAttribute('aria-pressed', 'false');
  await expect(page.locator('.cm-vim-panel')).toHaveCount(0);
});
