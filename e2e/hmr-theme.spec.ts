import { expect, test, type Page } from '@playwright/test';
import { helloWorld } from '../src/playground/examples';

const frame = (page: Page) => page.frameLocator('#preview-frame');
const editor = (page: Page) => page.getByRole('textbox', { name: 'Source editor' });
async function ready(page: Page) {
  await page.goto('/playground?panes=24,36,30,10&rows=75,25');
  await expect(frame(page).getByRole('heading', { name: 'Hello, world.' })).toBeVisible({ timeout: 20000 });
}
async function edit(page: Page, name: string, source: string) {
  await page.getByRole('tab', { name, exact: true }).click();
  await editor(page).focus();
  await page.keyboard.press('ControlOrMeta+a');
  await page.keyboard.insertText(source);
}

test('consecutive component and stylesheet updates preserve state and preview document', async ({ page }) => {
  await ready(page);
  const previewDocument = await page.locator('#preview-frame').getAttribute('srcdoc');
  await frame(page).getByRole('button', { name: 'Increase count' }).click();
  for (const label of ['First hot update', 'Second hot update']) {
    await edit(page, 'Counter.btsx', helloWorld.files['/src/Counter.btsx'].replace('A LITTLE INTERACTION', label));
    await expect(frame(page).getByText(label)).toBeVisible();
    await expect(page.locator('#pane-preview').getByText('Live · HMR', { exact: true })).toHaveText('Live · HMR');
    await expect(frame(page).locator('.value')).toHaveText('1');
    await expect(page.locator('#preview-frame')).toHaveAttribute('srcdoc', previewDocument!);
  }
  await edit(page, 'style.css', helloWorld.files['/src/style.css'] + '\n.value { color: rgb(180, 40, 70); }\n');
  await expect(frame(page).locator('.value')).toHaveCSS('color', 'rgb(180, 40, 70)');
  await expect(frame(page).locator('.value')).toHaveText('1');
  await expect(page.locator('#preview-frame')).toHaveAttribute('srcdoc', previewDocument!);
  await page.getByRole('button', { name: 'Reload preview', exact: true }).click();
  await expect(frame(page).locator('.value')).toHaveText('0');
  await expect(page.locator('#preview-frame')).not.toHaveAttribute('srcdoc', previewDocument!);
});

test('compile errors preserve the live counter and non-component edits trigger a clean reload', async ({ page }) => {
  await ready(page);
  await frame(page).getByRole('button', { name: 'Increase count' }).click();
  const previewDocument = await page.locator('#preview-frame').getAttribute('srcdoc');
  await edit(page, 'Counter.btsx', 'h1(title={) Broken\n');
  await expect(page.locator('#build-status')).toHaveText('Build failed');
  await expect(frame(page).locator('.value')).toHaveText('1');
  await edit(page, 'Counter.btsx', helloWorld.files['/src/Counter.btsx'].replace('A LITTLE INTERACTION', 'Recovered component'));
  await expect(frame(page).getByText('Recovered component')).toBeVisible();
  await expect(frame(page).locator('.value')).toHaveText('1');
  await expect(page.locator('#preview-frame')).toHaveAttribute('srcdoc', previewDocument!);
  await edit(page, 'main.ts', helloWorld.files['/src/main.ts'] + '\nconsole.log("New entry");');
  await expect(page.locator('#preview-frame')).not.toHaveAttribute('srcdoc', previewDocument!);
  await expect(frame(page).locator('.value')).toHaveText('0');
});

test('light theme covers editor and chat, persists, and preserves preview state and undo', async ({ page }) => {
  await ready(page);
  await edit(page, 'App.btsx', helloWorld.files['/src/App.btsx'].replace('Hello, world.', 'Theme test'));
  await expect(frame(page).getByRole('heading', { name: 'Theme test' })).toBeVisible();
  await frame(page).getByRole('button', { name: 'Increase count' }).click();
  const previewDocument = await page.locator('#preview-frame').getAttribute('srcdoc');
  await page.getByRole('button', { name: 'Light mode', exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await expect(page.locator('.cm-editor')).toHaveCSS('background-color', 'rgb(253, 252, 248)');
  await expect(frame(page).locator('html')).toHaveCSS('color-scheme', 'light');
  await expect(page.locator('#preview-frame')).toHaveAttribute('srcdoc', previewDocument!);
  await expect(frame(page).locator('.value')).toHaveText('1');
  await page.getByRole('tab', { name: 'Counter.btsx', exact: true }).click();
  await page.getByRole('tab', { name: 'App.btsx', exact: true }).click();
  await editor(page).focus(); await page.keyboard.press('ControlOrMeta+z');
  await expect(frame(page).getByRole('heading', { name: 'Hello, world.' })).toBeVisible();
  await editor(page).press('ArrowRight');
  await page.locator('[data-view="chat"]').click();
  await expect(page.locator('#pane-chat')).toBeVisible();
  await page.screenshot({ path: 'test-results/light-theme-desktop.png', fullPage: true });
  await page.getByRole('button', { name: 'AI settings', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'AI settings' })).toBeVisible();
  await page.screenshot({ path: 'test-results/light-theme-settings.png', fullPage: true });
  await page.keyboard.press('Escape');
  await page.reload();
  await expect(frame(page).getByRole('heading', { name: 'Hello, world.' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Light mode', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByRole('separator', { name: 'Resize editor and preview', exact: true })).toHaveAttribute('aria-orientation', 'horizontal');
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await page.screenshot({ path: 'test-results/light-theme-mobile.png', fullPage: true });
  await page.getByRole('button', { name: 'Light mode', exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
});

test('hot updates dispose module callbacks and component effects exactly once', async ({ page }) => {
  await ready(page);
  const source = `import { useEffect, useState } from 'octane'
module
  import.meta.hot?.dispose(() => console.info('module disposed v1'));
setup
  const [count, setCount] = useState(0);
  useEffect(() => {
    const handler = () => setCount(value => value + 1);
    window.addEventListener('playground-ping', handler);
    console.info('effect mounted v1');
    return () => {
      window.removeEventListener('playground-ping', handler);
      console.info('effect disposed v1');
    };
  }, []);
section
  button(onClick={() => window.dispatchEvent(new Event('playground-ping'))}) Trigger event
  strong.value #{count}
  p Version v1
`;
  await edit(page, 'Counter.btsx', source);
  await expect(frame(page).getByText('Version v1')).toBeVisible();
  await frame(page).getByRole('button', { name: 'Trigger event' }).click();
  await expect(frame(page).locator('.value')).toHaveText('1');
  const previewDocument = await page.locator('#preview-frame').getAttribute('srcdoc');
  await edit(page, 'Counter.btsx', source.replaceAll('v1', 'v2'));
  await expect(frame(page).getByText('Version v2')).toBeVisible();
  await frame(page).getByRole('button', { name: 'Trigger event' }).click();
  await expect(frame(page).locator('.value')).toHaveText('2');
  await expect(page.locator('#preview-frame')).toHaveAttribute('srcdoc', previewDocument!);
  await page.getByRole('tab', { name: /Console/ }).click();
  for (const message of ['module disposed v1', 'effect disposed v1', 'effect mounted v2']) {
    await expect(page.locator('.console-message').filter({ hasText: message })).toHaveCount(1);
  }
});

test('runtime errors after hot replacement map to updated source and recover on the next edit', async ({ page }) => {
  await ready(page);
  const previewDocument = await page.locator('#preview-frame').getAttribute('srcdoc');
  const source = `import { useState } from 'octane'
setup
  const [count] = useState(0);
  const fail = () => { throw new Error('Hot component failure'); };
button(onClick={fail}) Throw updated error
`;
  await edit(page, 'Counter.btsx', source);
  await expect(frame(page).getByRole('button', { name: 'Throw updated error' })).toBeVisible();
  await expect(page.locator('#preview-frame')).toHaveAttribute('srcdoc', previewDocument!);
  await frame(page).getByRole('button', { name: 'Throw updated error' }).click();
  await expect(page.locator('#preview-error')).toContainText('Hot component failure');
  const link = page.locator('.runtime-source-link').filter({ hasText: /^Counter\.btsx:4:/ }).first();
  await expect(link).toBeEnabled(); await link.click();
  await expect(page.locator('.cm-activeLine')).toContainText('Hot component failure');
  await edit(page, 'Counter.btsx', helloWorld.files['/src/Counter.btsx']);
  await expect(frame(page).getByRole('button', { name: 'Increase count' })).toBeVisible();
  await expect(page.locator('#preview-error')).toBeHidden();
});
