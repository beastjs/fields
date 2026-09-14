import { expect, test, type Locator, type Page } from '@playwright/test';
import type { ChatRequest } from '../src/chat/contracts';

async function ready(page: Page, url = '/') {
  await page.route('**/api/ai/status', route => route.fulfill({ json: { configured: { cohere: true, openrouter: false, custom: false } } }));
  await page.goto(url);
  await expect(page.locator('#preview-status')).toHaveText('Live', { timeout: 20000 });
}
const answer = (text: string) => `data: ${JSON.stringify({ choices: [{ delta: { content: text } }] })}\n\ndata: [DONE]\n\n`;
const openChat = async (page: Page) => {
  if (await page.locator('[data-view="chat"]').getAttribute('aria-pressed') !== 'true') await page.locator('[data-view="chat"]').click();
};
const dragBetween = async (page: Page, source: Locator, target: Locator) => {
  const sourceBox = (await source.boundingBox())!;
  const targetBox = (await target.boundingBox())!;
  await page.mouse.move(sourceBox.x + sourceBox.width / 2, sourceBox.y + sourceBox.height / 2);
  await page.mouse.down();
  const targetX = sourceBox.x > targetBox.x ? targetBox.x + 8 : targetBox.x + targetBox.width - 8;
  await page.mouse.move(targetX, targetBox.y + targetBox.height / 2, { steps: 2 });
  await page.mouse.up();
};

test('panel URLs restore proportions, collapsed views, back navigation, and reset', async ({ page }) => {
  await ready(page, '/?dock=0,75,25&split=60,40&rows=65,35&keep=hello');
  await expect(page.locator('#pane-files')).toBeHidden();
  await expect(page.locator('#pane-chat')).toBeVisible();
  await expect(page.getByRole('separator', { name: 'Resize editor and preview', exact: true })).toHaveAttribute('aria-valuenow', '45');
  await expect(page.getByRole('separator', { name: 'Resize output', exact: true })).toHaveAttribute('aria-valuenow', '65');
  const preview = await page.locator('#preview-frame').getAttribute('srcdoc');
  await page.evaluate(() => history.pushState({}, '', location.href));
  await page.locator('[data-view="output"]').click();
  await expect(page).toHaveURL(/rows=100,0/);
  await page.goBack();
  await expect(page.locator('#pane-output')).toBeVisible();
  await expect(page.getByRole('separator', { name: 'Resize output', exact: true })).toHaveAttribute('aria-valuenow', '65');
  await expect(page.locator('#preview-frame')).toHaveAttribute('srcdoc', preview!);
  await page.reload();
  await expect(page.locator('#pane-files')).toBeHidden();
  await expect(page.locator('#pane-chat')).toBeVisible();
  await page.getByRole('button', { name: 'Reset layout', exact: true }).click();
  await expect(page).toHaveURL('/?keep=hello');
  await expect(page.locator('#pane-files')).toBeVisible();
  await expect(page.locator('#pane-chat')).toBeHidden();
});

test('workbench panes reorder without losing state and restore from the URL', async ({ page, browserName }) => {
  await page.route('**/api/ai/chat', route => route.fulfill({
    contentType: 'text/event-stream',
    body: answer('This message stays put.'),
  }));
  await ready(page, '/?dock=14,68,18');
  const composer = page.getByRole('textbox', { name: 'Message AI' });
  await expect(composer).toBeEnabled({ timeout: 20000 });
  await composer.fill('Keep this message');
  await page.getByRole('button', { name: 'Send message', exact: true }).click();
  await expect(page.locator('.chat-markdown')).toContainText('This message stays put.');

  await page.getByRole('button', { name: 'Arrange panes', exact: true }).click();
  await expect(page.locator('.workspace')).toHaveAttribute('data-arranging', 'true');
  await expect.poll(() => page.evaluate(() => document.getAnimations().filter(animation => animation.playState === 'running').length)).toBe(0);
  await expect(page.locator('[data-reorder-handle]')).toHaveCount(0);
  const chatPane = page.locator('[data-slot="sortable-item"][aria-label="Move Assistant pane"]');
  const filesPane = page.locator('[data-slot="sortable-item"][aria-label="Move Files pane"]');
  if (browserName === 'webkit') {
    await chatPane.press('Space');
    await chatPane.press('ArrowLeft');
    await chatPane.press('ArrowLeft');
    await chatPane.press('ArrowLeft');
    await chatPane.press('Space');
  } else {
    await dragBetween(page, chatPane, filesPane);
  }
  await expect.poll(() => page.locator('.view-toolbar [data-view]').evaluateAll(nodes =>
    nodes.map(node => node.getAttribute('data-view'))
  )).toEqual(['chat', 'files', 'editor', 'preview', 'output']);
  await expect.poll(() => new URL(page.url()).searchParams.get('order')).toBeNull();
  await page.getByRole('button', { name: 'Finish arranging panes', exact: true }).click();
  await expect(page.locator('.view-toolbar [data-view]')).toHaveCount(5);
  expect(await page.locator('.view-toolbar [data-view]').evaluateAll(nodes =>
    nodes.map(node => node.getAttribute('data-view'))
  )).toEqual(['chat', 'files', 'editor', 'preview', 'output']);
  await expect.poll(() => new URL(page.url()).searchParams.get('order')).toBe('chat,files,editor,preview');
  await expect.poll(async () => {
    const chatBox = (await page.locator('#pane-chat').boundingBox())!;
    const filesBox = (await page.locator('#pane-files').boundingBox())!;
    return chatBox.x < filesBox.x;
  }).toBe(true);
  await expect(page.locator('.chat-markdown')).toContainText('This message stays put.');

  await page.reload();
  await expect(page.locator('#preview-status')).toHaveText('Live', { timeout: 20000 });
  expect((await page.locator('#pane-chat').boundingBox())!.x).toBeLessThan((await page.locator('#pane-files').boundingBox())!.x);
  await page.getByRole('button', { name: 'Arrange panes', exact: true }).click();
  await expect.poll(() => page.evaluate(() => document.getAnimations().filter(animation => animation.playState === 'running').length)).toBe(0);
  await page.locator('[data-slot="sortable-item"][aria-label="Move Assistant pane"]').press('Space');
  await page.locator('[data-slot="sortable-item"][aria-label="Move Assistant pane"]').press('ArrowRight');
  await page.locator('[data-slot="sortable-item"][aria-label="Move Assistant pane"]').press('Space');
  await page.getByRole('button', { name: 'Finish arranging panes', exact: true }).click();
  await expect.poll(() => new URL(page.url()).searchParams.get('order')).toBe('files,chat,editor,preview');
  await page.getByRole('button', { name: 'Reset layout', exact: true }).click();
  await expect.poll(() => new URL(page.url()).searchParams.get('order')).toBeNull();
});

test('collapsed panes keep a boundary handle and any remaining workbench pane permits closing', async ({ page }) => {
  await ready(page);
  await openChat(page);
  await page.getByRole('button', { name: 'Collapse preview', exact: true }).click();
  await page.getByRole('button', { name: 'Collapse files', exact: true }).click();
  await expect(page.getByRole('separator', { name: 'Resize files', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Collapse editor', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: 'Collapse editor', exact: true }).click();
  await expect(page.locator('#pane-files')).toBeHidden();
  await expect(page.locator('#pane-editor')).toBeHidden();
  await expect(page.locator('#pane-preview')).toBeHidden();
  await expect(page.locator('#pane-chat')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Collapse assistant', exact: true })).toBeDisabled();
});

test('preview fit mode stays flush while the pane narrows', async ({ page }) => {
  await ready(page);
  await expect(page.getByLabel('Preview zoom', { exact: true })).toHaveValue('1');

  const separator = page.getByRole('separator', { name: 'Resize editor and preview', exact: true });
  const box = (await separator.boundingBox())!;
  const samples = page.locator('.preview-stage').evaluate(async stage => {
    const measurements: Array<{ overflowX: number; overflowY: number; canvasDelta: number }> = [];
    for (let frame = 0; frame < 50; frame++) {
      const canvas = stage.querySelector<HTMLElement>('.preview-canvas')!;
      measurements.push({
        overflowX: stage.scrollWidth - stage.clientWidth,
        overflowY: stage.scrollHeight - stage.clientHeight,
        canvasDelta: Math.abs(canvas.getBoundingClientRect().width - stage.getBoundingClientRect().width),
      });
      await new Promise(requestAnimationFrame);
    }
    return measurements;
  });

  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + 300, box.y + box.height / 2, { steps: 30 });
  await page.mouse.up();

  for (const measurement of await samples) {
    expect(measurement.overflowX).toBeLessThanOrEqual(1);
    expect(measurement.overflowY).toBeLessThanOrEqual(1);
    expect(measurement.canvasDelta).toBeLessThanOrEqual(1);
  }
});

test('invalid layout parameters recover and file search filters the explorer', async ({ page }) => {
  await ready(page, '/?dock=NaN&split=-10,110&rows=0,0');
  await expect(page.locator('#pane-editor')).toBeVisible();
  await expect(page.locator('#pane-preview')).toBeVisible();
  const search = page.getByRole('searchbox', { name: 'Search files' });
  await search.fill('counter');
  await expect(page.getByRole('button', { name: 'Open Counter.btsx', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Open App.btsx', exact: true })).toHaveCount(0);
  await search.fill('does not exist');
  await expect(page.locator('#file-list')).toHaveText('No matching files.');
  await search.fill('');
  await expect(page.getByRole('button', { name: 'Open App.btsx', exact: true })).toBeVisible();
});

test('chat sends the default model with optional file context and safely renders answers', async ({ page }) => {
  const requests: ChatRequest[] = [];
  await page.route('**/api/ai/chat', async route => {
    requests.push(route.request().postDataJSON());
    await route.fulfill({ contentType: 'text/event-stream', body: answer('The **Counter** component owns the count.\n\n```btsx\nh1 Hello\n```\n\n<img src=x onerror="window.chatInjected=true"><script>window.chatInjected=true</script>') });
  });
  await ready(page); await openChat(page);
  await expect(page.locator('.connection-label')).toHaveText('READY');
  await page.getByRole('button', { name: 'Improve this file ↗', exact: true }).click();
  await expect(page.getByRole('textbox', { name: 'Message AI' })).toHaveValue('Improve active file.');
  await page.getByRole('button', { name: 'Send message', exact: true }).click();
  await expect(page.locator('.chat-markdown strong')).toHaveText('Counter');
  await expect(page.locator('.chat-markdown pre')).toContainText('h1 Hello');
  await expect(page.locator('.chat-markdown img, .chat-markdown script')).toHaveCount(0);
  expect(await page.evaluate(() => 'chatInjected' in window)).toBe(false);
  expect(requests[0].provider).toBe('cohere');
  expect(requests[0].model).toBe('cohere/north-mini-code-1-0');
  expect(requests[0].context?.file).toBe('/src/App.btsx');
  expect(requests[0].context?.source).toContain("import Counter");
  await page.getByRole('checkbox', { name: /Include App\.btsx/ }).uncheck();
  await page.getByRole('textbox', { name: 'Message AI' }).fill('Thanks');
  await page.getByRole('textbox', { name: 'Message AI' }).press('Enter');
  await expect(page.locator('.chat-message.assistant[data-message-state="complete"]')).toHaveCount(2);
  expect(requests[1].context).toBeUndefined();
  expect(requests[1].messages.map(message => message.role)).toEqual(['user', 'assistant', 'user']);
  await page.locator('[data-view="chat"]').click();
  await openChat(page);
  await expect(page.locator('.chat-message')).toHaveCount(4);
  await page.screenshot({ path: 'test-results/charcoal-chat.png', fullPage: true });
});

test('provider and model settings persist while API keys stay out of storage and URLs', async ({ page }) => {
  const requests: ChatRequest[] = [];
  await page.route('**/api/ai/chat', route => {
    requests.push(route.request().postDataJSON());
    return route.fulfill({ contentType: 'text/event-stream', body: answer('Custom connection works.') });
  });
  await ready(page); await openChat(page);
  await page.getByRole('button', { name: 'AI settings', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'AI settings' })).toBeVisible();
  await page.getByLabel('Provider', { exact: true }).selectOption('custom');
  await page.getByLabel('Model ID', { exact: true }).fill('my-coding-model');
  await page.getByLabel('API base URL', { exact: true }).fill('http://127.0.0.1:11434/v1');
  await page.getByLabel('API key', { exact: true }).fill('test-key-not-for-storage');
  await page.getByRole('button', { name: 'Save connection', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.locator('.model-name')).toHaveText('my-coding-model');
  await page.getByRole('textbox', { name: 'Message AI' }).fill('Hello');
  await page.getByRole('button', { name: 'Send message', exact: true }).click();
  await expect(page.locator('.chat-markdown')).toContainText('Custom connection works.');
  expect(requests[0].apiKey).toBe('test-key-not-for-storage');
  expect(requests[0].provider).toBe('custom');
  const storage = await page.evaluate(() => JSON.stringify({ ...localStorage }));
  expect(storage).toContain('my-coding-model');
  expect(storage).not.toContain('test-key-not-for-storage');
  expect(page.url()).not.toContain('test-key');
  await page.reload(); await openChat(page);
  await page.getByRole('button', { name: 'AI settings', exact: true }).click();
  // Values exist before the mount effect opens the native dialog; wait before Escape.
  await expect(page.getByRole('dialog', { name: 'AI settings' })).toBeVisible();
  await expect(page.getByLabel('Model ID', { exact: true })).toHaveValue('my-coding-model');
  await expect(page.getByLabel('API key', { exact: true })).toHaveValue('');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
});

test('chat recovers from provider errors, stops pending requests and clears history', async ({ page }) => {
  let calls = 0;
  let release: (() => void) | undefined;
  await page.route('**/api/ai/chat', async route => {
    calls++;
    if (calls === 1) { await route.fulfill({ status: 429, json: { error: 'Provider rate limit. Retry shortly.' } }); return; }
    if (calls === 3) await new Promise<void>(resolve => { release = resolve; });
    await route.fulfill({ contentType: 'text/event-stream', body: answer('Recovered answer.') }).catch(() => {});
  });
  await ready(page); await openChat(page);
  await page.getByRole('textbox', { name: 'Message AI' }).fill('Try a response');
  await page.getByRole('button', { name: 'Send message', exact: true }).click();
  await expect(page.locator('.chat-error')).toContainText('Provider rate limit');
  await page.getByRole('button', { name: 'Retry response', exact: true }).click();
  await expect(page.locator('.chat-markdown')).toContainText('Recovered answer.');
  await expect(page.locator('.chat-message.user')).toHaveCount(1);
  await page.getByRole('textbox', { name: 'Message AI' }).fill('Slow response');
  await page.getByRole('button', { name: 'Send message', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Stop response', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Stop response', exact: true }).click();
  await expect(page.locator('.chat-message[data-message-state="stopped"]')).toHaveCount(1);
  release?.();
  await page.getByRole('button', { name: 'New chat', exact: true }).click();
  await expect(page.locator('.chat-message')).toHaveCount(0);
  await expect(page.locator('.chat-welcome')).toBeVisible();
});
