import { expect, test, type Page } from '@playwright/test';
import type { ChatRequest } from '../src/chat/contracts';

const broken = "setup\n  const value = ;\nh1 Broken\n";
const fixed = 'h1 Repaired automatically\n';
const answer = (text: string) => `data: ${JSON.stringify({ choices: [{ delta: { content: text } }] })}\n\ndata: [DONE]\n\n`;

async function ready(page: Page) {
  await page.route('**/api/jev/status', route => route.fulfill({ json: { configured: false } }));
  await page.route('**/api/ai/status', route => route.fulfill({ json: { configured: { meta: true, cohere: false, openrouter: false, custom: false } } }));
  await page.goto('/playground');
  await expect(page.getByRole('region', { name: 'Application preview', exact: true }).getByText('Live', { exact: true })).toBeVisible({ timeout: 20000 });
  if (await page.locator('[data-view="editor"]').getAttribute('aria-pressed') !== 'true') await page.locator('[data-view="editor"]').click();
  await expect(page.getByRole('textbox', { name: 'Source editor' })).toBeVisible();
}

async function edit(page: Page, source: string) {
  await page.getByRole('textbox', { name: 'Source editor' }).focus();
  await page.keyboard.press('ControlOrMeta+a');
  await page.keyboard.insertText(source);
}

test('a detected editor error opens chat and applies a compiled, startup-verified repair', async ({ page }) => {
  const requests: ChatRequest[] = [];
  await page.route('**/api/ai/chat', route => {
    requests.push(route.request().postDataJSON());
    return route.fulfill({ contentType: 'text/event-stream', body: answer('```btsx file=/src/App.btsx\n' + fixed + '```') });
  });
  await ready(page);
  // The detector keeps working even while the chat pane is collapsed.
  if (await page.locator('[data-view="chat"]').getAttribute('aria-pressed') === 'true') await page.locator('[data-view="chat"]').click();
  await edit(page, broken);
  await expect(page.getByRole('region', { name: 'AI chat', exact: true })).toBeVisible();
  await expect(page.locator('.chat-message.user').getByText('Auto-fix', { exact: true })).toBeVisible();
  await expect(page.locator('.chat-apply')).toContainText('startup verified', { timeout: 20000 });
  await expect(page.getByRole('textbox', { name: 'Source editor' })).toContainText('h1 Repaired automatically');
  await expect(page.frameLocator('#preview-frame').getByRole('heading', { name: 'Repaired automatically' })).toBeVisible();
  expect(requests).toHaveLength(1);
  expect(requests[0].model).toBe('muse-spark-1.3-contributor');
  expect(requests[0].context).toEqual({ file: '/src/App.btsx', source: broken });
  expect(requests[0].messages[0].content).toContain('The editor detected an error');
});

test('Auto off preserves the error and does not send a repair request', async ({ page }) => {
  let requests = 0;
  await page.route('**/api/ai/chat', route => { requests++; return route.fulfill({ contentType: 'text/event-stream', body: answer('No automatic request expected.') }); });
  await ready(page);
  await page.getByRole('checkbox', { name: /^Auto-apply and fix editor errors/ }).click();
  await edit(page, broken);
  await expect(page.locator('#build-status')).toHaveText('Build failed');
  await page.waitForTimeout(800);
  expect(requests).toBe(0);
  await expect(page.getByRole('textbox', { name: 'Source editor' })).toContainText('const value = ;');
});

test('editing while an automatic response is pending keeps the newer source', async ({ page }) => {
  const requests: ChatRequest[] = [];
  let release!: () => void;
  const held = new Promise<void>(resolve => { release = resolve; });
  await page.route('**/api/ai/chat', async route => {
    requests.push(route.request().postDataJSON());
    await held;
    await route.fulfill({ contentType: 'text/event-stream', body: answer('```btsx file=/src/App.btsx\n' + fixed + '```') }).catch(() => {});
  });
  await ready(page); await edit(page, broken);
  await expect(page.locator('.chat-message.assistant')).toHaveAttribute('data-message-state', 'streaming');
  await edit(page, 'h1 My newer edit\n');
  await expect(page.locator('.chat-message.assistant')).toHaveAttribute('data-message-state', 'stopped');
  release();
  await expect(page.frameLocator('#preview-frame').getByRole('heading', { name: 'My newer edit' })).toBeVisible();
  await expect(page.getByRole('textbox', { name: 'Source editor' })).toContainText('h1 My newer edit');
  expect(requests).toHaveLength(1);
});

test('a repair that fails verification sends feedback and verifies the next attempt', async ({ page }) => {
  const requests: ChatRequest[] = [];
  await page.route('**/api/ai/chat', route => {
    requests.push(route.request().postDataJSON());
    const source = requests.length === 1 ? 'setup\n  const repaired = ;\nh1 Broken\n' : fixed;
    return route.fulfill({ contentType: 'text/event-stream', body: answer('```btsx file=/src/App.btsx\n' + source + '```') });
  });
  await ready(page); await edit(page, broken);
  await expect(page.locator('.chat-apply').last()).toContainText('startup verified', { timeout: 20000 });
  await expect(page.frameLocator('#preview-frame').getByRole('heading', { name: 'Repaired automatically' })).toBeVisible();
  expect(requests).toHaveLength(2);
  expect(requests[1].messages).toHaveLength(1);
  expect(requests[1].context?.source).toBe(broken);
  await expect(page.locator('.chat-message.user').last()).toContainText('ATTEMPT 2/5');
});
