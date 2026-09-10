import { expect, test, type Page } from '@playwright/test';
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

test('panel URLs restore proportions, collapsed views, back navigation, and reset', async ({ page }) => {
  await ready(page, '/?dock=0,75,25&split=60,40&rows=65,35&keep=hello');
  await expect(page.locator('#pane-files')).toBeHidden();
  await expect(page.locator('#pane-chat')).toBeVisible();
  await expect(page.getByRole('separator', { name: 'Resize editor and preview', exact: true })).toHaveAttribute('aria-valuenow', '60');
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
  await page.getByRole('button', { name: 'Explain this file ↗', exact: true }).click();
  await expect(page.getByRole('textbox', { name: 'Message AI' })).toHaveValue('Explain how the active file works.');
  await page.getByRole('button', { name: 'Send message', exact: true }).click();
  await expect(page.locator('.chat-markdown strong')).toHaveText('Counter');
  await expect(page.locator('.chat-markdown pre')).toContainText('h1 Hello');
  await expect(page.locator('.chat-markdown img, .chat-markdown script')).toHaveCount(0);
  expect(await page.evaluate(() => 'chatInjected' in window)).toBe(false);
  expect(requests[0].provider).toBe('cohere');
  expect(requests[0].model).toBe('cohere/north-mini-code-1-0');
  expect(requests[0].context?.file).toBe('/src/App.btsx');
  expect(requests[0].context?.source).toContain("import Counter");
  await page.getByRole('checkbox', { name: /Include active file/ }).uncheck();
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
