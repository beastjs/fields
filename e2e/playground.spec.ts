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
  const previousBuild = await page.locator('#preview-frame').getAttribute('data-build-revision');
  await page.keyboard.type(':w');
  await page.keyboard.press('Enter');
  await expect(page.locator('#preview-frame')).not.toHaveAttribute('data-build-revision', previousBuild!);
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

test('pane collapse keeps documents, undo history, output selection and the preview alive', async ({ page }) => {
  await ready(page);
  await replaceSource(page, 'h1 Pane state\n');
  await expect(page.frameLocator('#preview-frame').getByRole('heading', { name: 'Pane state' })).toBeVisible();
  const previewDocument = await page.locator('#preview-frame').getAttribute('srcdoc');
  await page.getByRole('tab', { name: 'Generated code' }).click();
  await page.getByRole('button', { name: 'Web / JavaScript', exact: true }).click();
  for (const pane of ['files', 'editor', 'output', 'preview']) {
    // Restoring each one keeps at least one of Editor/Preview visible.
    await page.getByRole('button', { name: `Collapse ${pane}`, exact: true }).click();
    await expect(page.locator(`#pane-${pane}`)).toHaveAttribute('inert', '');
    await expect(page.locator(`#pane-${pane}`)).toBeHidden();
    const restore = page.locator(`[data-view="${pane}"]`);
    await expect(restore).toBeFocused();
    await expect(restore).toHaveAttribute('aria-pressed', 'false');
    await restore.click();
    await expect(page.locator(`#pane-${pane}`)).toBeVisible();
    await expect(restore).toHaveAttribute('aria-pressed', 'true');
  }
  await expect(page.locator('#preview-frame')).toHaveAttribute('srcdoc', previewDocument!);
  await expect(page.getByRole('button', { name: 'Web / JavaScript', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(sourceEditor(page)).toContainText('h1 Pane state');
  await sourceEditor(page).focus();
  await page.keyboard.press('ControlOrMeta+z');
  await expect(page.frameLocator('#preview-frame').getByRole('heading', { name: 'Hello, world.' })).toBeVisible();
  await page.frameLocator('#preview-frame').getByRole('button', { name: 'Increase count' }).click();
  await page.getByRole('button', { name: 'Collapse preview', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Collapse editor', exact: true })).toBeDisabled();
  await page.locator('[data-view="preview"]').click();
  await expect(page.frameLocator('#preview-frame').locator('.value')).toHaveText('1');
  await page.locator('[data-view="chat"]').click();
  await expect(page.locator('#pane-chat')).toContainText('Make something work.');
  await page.getByRole('button', { name: 'Collapse ai chat', exact: true }).click();
  await expect(page.locator('#pane-chat')).toBeHidden();
});

test('panes resize by pointer and keyboard, remember expansion size, and reset without reload', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await ready(page);
  const dimensions = async () => ({
    files: (await page.locator('#pane-files').boundingBox())!.width,
    editor: (await page.locator('#pane-editor').boundingBox())!.width,
    output: (await page.locator('#pane-output').boundingBox())!.height,
  });
  const initial = await dimensions();
  const previewDocument = await page.locator('#preview-frame').getAttribute('srcdoc');
  const drag = async (name: string, dx: number, dy: number) => {
    const box = (await page.getByRole('separator', { name, exact: true }).boundingBox())!;
    const x = box.x + box.width / 2, y = box.y + box.height / 2;
    await page.mouse.move(x, y); await page.mouse.down();
    await page.mouse.move(x + dx, y + dy, { steps: 10 }); await page.mouse.up();
  };
  await drag('Resize files', 70, 0);
  expect((await dimensions()).files).toBeGreaterThan(initial.files + 50);
  const expandedWidth = (await dimensions()).files;
  await page.locator('[data-view="files"]').click();
  await page.locator('[data-view="files"]').click();
  expect(Math.abs((await dimensions()).files - expandedWidth)).toBeLessThan(2);
  const editorBefore = (await dimensions()).editor;
  await drag('Resize editor and preview', -80, 0);
  expect((await dimensions()).editor).toBeLessThan(editorBefore - 60);
  await drag('Resize output', 0, -70);
  expect((await dimensions()).output).toBeGreaterThan(initial.output + 50);
  const outputBefore = (await dimensions()).output;
  await page.getByRole('separator', { name: 'Resize output', exact: true }).press('ArrowUp');
  expect((await dimensions()).output).toBeGreaterThan(outputBefore);
  await page.getByRole('separator', { name: 'Resize files', exact: true }).press('Enter');
  await expect(page.locator('[data-view="files"]')).toHaveAttribute('aria-pressed', 'false');
  await page.getByRole('separator', { name: 'Resize files', exact: true }).press('Enter');
  await expect(page.locator('#pane-files')).toBeVisible();
  await page.locator('[data-view="chat"]').click();
  const chatBefore = (await page.locator('#pane-chat').boundingBox())!.width;
  await drag('Resize AI chat', -70, 0);
  expect((await page.locator('#pane-chat').boundingBox())!.width).toBeGreaterThan(chatBefore + 50);
  await page.getByRole('button', { name: 'Reset layout', exact: true }).click();
  const reset = await dimensions();
  for (const key of ['files', 'editor', 'output'] as const) expect(Math.abs(reset[key] - initial[key])).toBeLessThan(2);
  await expect(page.locator('#pane-chat')).toBeHidden();
  await expect(page.locator('#preview-frame')).toHaveAttribute('srcdoc', previewDocument!);
  expect(errors).toEqual([]);
  const duplicateIds = await page.locator('[id]').evaluateAll(nodes => {
    const ids = nodes.map(node => node.id);
    return ids.filter((id, i) => ids.indexOf(id) !== i);
  });
  expect(duplicateIds).toEqual([]);
});

test('file creation validates paths, cancels cleanly, and deletion selects a surviving document', async ({ page }) => {
  await ready(page);
  await page.getByRole('button', { name: 'Add file', exact: true }).click();
  const path = page.getByLabel('New file path');
  await expect(path).toBeFocused();
  await page.getByRole('button', { name: 'Add', exact: true }).click();
  await expect(page.locator('#file-error')).toContainText('file path is required');
  await path.fill('components/../App.btsx');
  await expect(page.locator('#file-error')).toContainText('already exists');
  await path.fill('../../outside.ts');
  await expect(page.locator('#file-error')).toContainText('escapes the project');
  await path.fill('notes.md');
  await expect(page.locator('#file-error')).toContainText('Use .btsx');
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Add file', exact: true })).toBeFocused();
  await page.getByRole('button', { name: 'Add file', exact: true }).click();
  await expect(path).toHaveValue('');
  await page.getByRole('button', { name: 'Collapse editor', exact: true }).click();
  await path.fill('data.json');
  await page.getByRole('button', { name: 'Add', exact: true }).click();
  await expect(page.locator('#pane-editor')).toBeVisible();
  await expect(sourceEditor(page)).toBeFocused();
  await expect(sourceEditor(page)).toContainText('{}');
  await expect(page.locator('#active-filename')).toHaveText('data.json');
  const row = page.locator('.file-row').filter({ has: page.getByRole('button', { name: 'Open data.json', exact: true }) });
  await row.hover();
  await page.getByRole('button', { name: 'Delete data.json', exact: true }).click();
  await expect(page.getByRole('tab', { name: 'data.json', exact: true })).toHaveCount(0);
  await expect(page.locator('#active-filename')).toHaveText('App.btsx');
  await expect(page.getByRole('button', { name: 'Delete main.ts', exact: true })).toHaveCount(0);
});

test('responsive orientation changes preserve the editor and preview and hidden editor navigation restores it', async ({ page }) => {
  await ready(page);
  await page.frameLocator('#preview-frame').getByRole('button', { name: 'Increase count' }).click();
  const previewDocument = await page.locator('#preview-frame').getAttribute('srcdoc');
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByRole('separator', { name: 'Resize editor and preview', exact: true })).toHaveAttribute('aria-orientation', 'horizontal');
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  // The binding may collapse Files as it crosses its minimum size at this breakpoint.
  const filesToggle = page.locator('[data-view="files"]');
  if (await filesToggle.getAttribute('aria-pressed') === 'true') await filesToggle.click();
  await expect(page.locator('#pane-files')).toBeHidden();
  await expect(sourceEditor(page)).toContainText("import Counter");
  await page.setViewportSize({ width: 1440, height: 960 });
  await expect(page.getByRole('separator', { name: 'Resize editor and preview', exact: true })).toHaveAttribute('aria-orientation', 'vertical');
  await expect(page.locator('#preview-frame')).toHaveAttribute('srcdoc', previewDocument!);
  await expect(page.frameLocator('#preview-frame').locator('.value')).toHaveText('1');
  await page.locator('[data-view="files"]').click();
  await page.getByRole('button', { name: 'Collapse editor', exact: true }).click();
  await openFile(page, 'Counter.btsx');
  await expect(page.locator('#pane-editor')).toBeVisible();
  await expect(page.locator('#active-filename')).toHaveText('Counter.btsx');
});
