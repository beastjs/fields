import { expect, test, type Page } from '@playwright/test';
import { helloWorld } from '../src/playground/examples';

const preview = (page: Page) => page.frameLocator('#preview-frame');
const editor = (page: Page) => page.getByRole('textbox', { name: 'Source editor' });
async function ready(page: Page) {
  await page.goto('/?previewURL=https://untrusted.invalid/');
  await expect(preview(page).getByRole('heading', { name: 'Hello, world.' })).toBeVisible({ timeout: 20000 });
  await page.getByRole('combobox', { name: 'Preview mode' }).selectOption('hosted');
  await expect(page.locator('#preview-frame')).toHaveAttribute('src', 'http://localhost:3100/preview.html');
  await expect(page.locator('#preview-frame')).not.toHaveAttribute('srcdoc');
  await expect(page.locator('#preview-status')).toHaveText('Live');
  await expect(preview(page).getByRole('heading', { name: 'Hello, world.' })).toBeVisible();
}
async function edit(page: Page, name: string, source: string) {
  await page.getByRole('tab', { name, exact: true }).click();
  await editor(page).focus();
  await page.keyboard.press('ControlOrMeta+a');
  await page.keyboard.insertText(source);
}

test('hosted imports, console, consecutive HMR, styles, theme, reload and editor undo', async ({ page }) => {
  await ready(page);
  const frame = preview(page);
  await expect(page.locator('#console-list')).toContainText('Hello from the preview.');
  await frame.getByRole('button', { name: 'Increase count' }).click();
  for (const label of ['Hosted first', 'Hosted second']) {
    await edit(page, 'Counter.btsx', helloWorld.files['/src/Counter.btsx'].replace('A LITTLE INTERACTION', label));
    await expect(frame.getByText(label)).toBeVisible();
    await expect(page.locator('#preview-status')).toHaveText('Live · HMR');
    await expect(frame.locator('.value')).toHaveText('1');
  }
  await edit(page, 'style.css', helloWorld.files['/src/style.css'] + '\n.value { color: rgb(180, 40, 70); }');
  await expect(frame.locator('.value')).toHaveCSS('color', 'rgb(180, 40, 70)');
  await expect(frame.locator('.value')).toHaveText('1');
  await page.getByRole('button', { name: 'Light mode', exact: true }).click();
  await expect(frame.locator('html')).toHaveAttribute('data-theme', 'light');
  await expect(frame.locator('.value')).toHaveText('1');
  await page.getByRole('button', { name: 'Reload preview', exact: true }).click();
  await expect(frame.locator('.value')).toHaveText('0');
  await expect(frame.locator('html')).toHaveAttribute('data-theme', 'light');
  await page.getByRole('tab', { name: 'Counter.btsx', exact: true }).click();
  await editor(page).focus();
  await page.keyboard.press('ControlOrMeta+z');
  // CodeMirror may group rapid whole-file edits into one history event.
  await expect(frame.locator('.caption')).toHaveText(/^(Hosted first|A LITTLE INTERACTION)$/);
  const undone = await frame.locator('.caption').innerText();
  await page.keyboard.press('ControlOrMeta+Shift+z');
  await expect(frame.locator('.caption')).toHaveText('Hosted second');
  await page.getByRole('combobox', { name: 'Preview mode' }).selectOption('local');
  await expect(page.locator('#preview-frame')).toHaveAttribute('srcdoc', /doctype/);
  await expect(frame.locator('.caption')).toHaveText('Hosted second');
  await editor(page).focus();
  await page.keyboard.press('ControlOrMeta+z');
  await expect(frame.locator('.caption')).toHaveText(undone);
});

test('hosted errors map to source and recover; project replacement and viewport controls survive', async ({ page }) => {
  await ready(page);
  const frame = preview(page);
  await edit(page, 'Counter.btsx', "setup\n  const fail = () => { throw new Error('Hosted failure'); };\nbutton(onClick={fail}) Throw hosted error\n");
  await frame.getByRole('button', { name: 'Throw hosted error' }).click();
  await expect(page.locator('#preview-error')).toContainText('Hosted failure');
  const link = page.locator('.runtime-source-link').filter({ hasText: /^Counter\.btsx:2:/ }).first();
  await expect(link).toBeEnabled();
  await link.click();
  await expect(page.locator('.cm-activeLine')).toContainText('Hosted failure');
  await edit(page, 'Counter.btsx', helloWorld.files['/src/Counter.btsx']);
  await expect(frame.getByRole('button', { name: 'Increase count' })).toBeVisible();
  await expect(page.locator('#preview-error')).toBeHidden();
  await page.getByRole('button', { name: 'Examples', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Example library' });
  await dialog.getByLabel('Choose an example').selectOption('props');
  await dialog.getByRole('button', { name: 'Load example', exact: true }).click();
  await expect(frame.getByRole('heading', { name: 'Props & components', exact: true })).toBeVisible();
  await frame.getByLabel('Your name').fill('Hosted');
  await expect(frame.getByRole('heading', { name: 'Hello, Hosted!' })).toBeVisible();
  await page.getByRole('button', { name: 'Mobile preview', exact: true }).click();
  await page.getByRole('combobox', { name: 'Preview zoom' }).selectOption('0.75');
  await expect(page.locator('#preview-frame')).toHaveCSS('width', '375px');
  const fullscreen = page.getByRole('button', { name: 'Enter fullscreen preview' });
  if (await fullscreen.isEnabled()) {
    await fullscreen.click();
    await expect(page.getByRole('button', { name: 'Exit fullscreen preview' })).toBeVisible();
    await expect(frame.getByRole('heading', { name: 'Hello, Hosted!' })).toBeVisible();
    await page.getByRole('button', { name: 'Exit fullscreen preview' }).click();
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByRole('combobox', { name: 'Preview mode' })).toHaveValue('hosted');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: `test-results/hosted-mobile-${test.info().project.name}.png`, fullPage: true });
});

test('unavailable endpoint preserves source and requires deliberate local fallback', async ({ page }) => {
  await page.route('http://localhost:3100/preview.html', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><title>Unavailable bootstrap</title>' }));
  await page.goto('/');
  await edit(page, 'App.btsx', 'h1 Keep this work\n');
  await expect(preview(page).getByRole('heading', { name: 'Keep this work' })).toBeVisible();
  await page.getByRole('combobox', { name: 'Preview mode' }).selectOption('hosted');
  await expect(page.locator('#preview-error')).toContainText('Hosted preview did not start', { timeout: 15000 });
  await expect(page.getByRole('combobox', { name: 'Preview mode' })).toHaveValue('hosted');
  await expect(editor(page)).toContainText('Keep this work');
  await page.getByRole('combobox', { name: 'Preview mode' }).selectOption('local');
  await expect(preview(page).getByRole('heading', { name: 'Keep this work' })).toBeVisible();
  await expect(page.locator('#preview-error')).toBeHidden();
  await page.getByRole('combobox', { name: 'Preview mode' }).selectOption('hosted');
  await page.unroute('http://localhost:3100/preview.html');
  await page.getByRole('button', { name: 'Reload preview', exact: true }).click();
  await expect(preview(page).getByRole('heading', { name: 'Keep this work' })).toBeVisible();
  await expect(page.locator('#preview-frame')).not.toHaveAttribute('srcdoc');
});

test('hosted sandbox rejects stale and wrong-window messages and blocks parent, storage and network access', async ({ page }) => {
  await page.addInitScript(() => {
    const scope = window as typeof window & { lastPreviewEvent?: Record<string, unknown> };
    window.addEventListener('message', event => {
      if (event.data?.type === 'rendered') scope.lastPreviewEvent = event.data;
    });
  });
  await ready(page);
  const old = await page.evaluate(() => (window as typeof window & { lastPreviewEvent?: Record<string, unknown> }).lastPreviewEvent!);
  await page.evaluate(message => window.postMessage({ ...message, type: 'runtime-error', message: 'Wrong window' }, '*'), old);
  await preview(page).getByRole('button', { name: 'Increase count' }).click();
  await page.getByRole('button', { name: 'Reload preview', exact: true }).click();
  await expect(preview(page).locator('.value')).toHaveText('0');
  const child = page.frames().find(frame => frame.url() === 'http://localhost:3100/preview.html')!;
  const access = await child.evaluate(async message => {
    let dom = false, storage = false, network = false;
    try { void parent.document.body; dom = true; } catch {}
    try { void localStorage.length; storage = true; } catch {}
    try { await fetch('https://example.com'); network = true; } catch {}
    parent.postMessage({ ...message, type: 'runtime-error', message: 'Stale document' }, '*');
    console.info('Sandbox checks finished');
    return { dom, storage, network };
  }, old);
  expect(access).toEqual({ dom: false, storage: false, network: false });
  await expect(page.locator('#console-list')).toContainText('Sandbox checks finished');
  await expect(page.locator('#preview-error')).toBeHidden();
  await expect(page.locator('#preview-frame')).toHaveAttribute('sandbox', 'allow-scripts');
  await expect(page.locator('#preview-frame')).toHaveAttribute('referrerpolicy', 'no-referrer');
});

test('static bootstrap accepts only one valid parent handshake before requesting a build', async ({ page }) => {
  await page.goto('/');
  const events = await page.evaluate(async () => {
    const frame = document.createElement('iframe');
    frame.sandbox = 'allow-scripts';
    frame.src = 'http://localhost:3100/preview.html';
    const channel = crypto.randomUUID();
    const connect = { version: 1, type: 'connect', channel, build: 1, theme: 'light' };
    const received: { type: string; channel: string; build: number }[] = [];
    return await new Promise<typeof received>((resolve, reject) => {
      const timeout = setTimeout(() => { cleanup(); reject(new Error('Handshake timed out')); }, 5000);
      const cleanup = () => { clearTimeout(timeout); removeEventListener('message', listener); frame.remove(); };
      const listener = (event: MessageEvent) => {
        if (event.source !== frame.contentWindow) return;
        received.push(event.data);
        if (event.data.type === 'ready') {
          frame.contentWindow!.postMessage({ ...connect, channel: crypto.randomUUID(), build: 2 }, '*');
          frame.contentWindow!.postMessage({ version: 1, channel, build: 1, type: 'load',
            entry: '@handshake', modules: [{ id: '@handshake', code: 'console.info("Handshake build");' }] }, '*');
        } else if (event.data.type === 'console') {
          cleanup(); resolve(received);
        }
      };
      addEventListener('message', listener);
      frame.onload = () => {
        for (const invalid of [{ version: 2 }, { channel: 'bad' }, { build: 0 }, { theme: 'invalid' }]) {
          frame.contentWindow!.postMessage({ ...connect, ...invalid }, '*');
        }
        frame.contentWindow!.postMessage(connect, '*');
      };
      document.body.append(frame);
    });
  });
  expect(events.filter(event => event.type === 'ready')).toHaveLength(1);
  expect(events.at(-1)).toMatchObject({ type: 'console', build: 1, args: ['Handshake build'] });
  expect(new Set(events.map(event => event.channel)).size).toBe(1);
});
