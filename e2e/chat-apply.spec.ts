import { expect, test, type Page } from '@playwright/test';
const replacement = (source: string) => 'Use this complete file:\n\n```btsx file=/src/App.btsx\n' + source + '```';
async function start(page: Page, content: string) {
  await page.route('**/api/ai/status', route => route.fulfill({ json: { configured: { cohere: true, openrouter: false, custom: false } } }));
  await page.route('**/api/ai/chat', route => route.fulfill({ contentType: 'text/event-stream', body: `data: ${JSON.stringify({ choices: [{ delta: { content } }] })}\n\ndata: [DONE]\n\n` }));
  await page.goto('/?dock=0,70,30');
  await expect(page.locator('#preview-status')).toHaveText('Live', { timeout: 20000 });
  const autoApply = page.getByRole('checkbox', { name: 'Auto-apply', exact: true });
  if (await autoApply.isChecked()) await autoApply.click();
  await page.getByRole('textbox', { name: 'Message AI' }).fill('Improve this file');
  await page.getByRole('button', { name: 'Send message', exact: true }).click();
  await expect(page.locator('.chat-message.assistant')).toHaveAttribute('data-message-state', 'complete');
}

test('recommendation applies to the attached file after tab switching, compiles, persists and supports undo', async ({ page }) => {
  await start(page, replacement('h1 Applied from chat\n'));
  await page.getByRole('tab', { name: 'Counter.btsx', exact: true }).click();
  await page.getByRole('button', { name: 'Apply & verify', exact: true }).click();
  await expect(page.locator('.chat-apply')).toContainText(/applied\s*compiled/);
  await expect(page.locator('#active-filename')).toHaveText('App.btsx');
  const editor = page.getByRole('textbox', { name: 'Source editor' });
  await expect(editor).toContainText('h1 Applied from chat');
  await expect(page.frameLocator('#preview-frame').getByRole('heading', { name: 'Applied from chat' })).toBeVisible();
  await expect(page.locator('#problem-count')).toHaveText('0');
  await page.screenshot({ path: `test-results/chat-applied-${test.info().project.name}.png`, fullPage: true });
  await editor.focus(); await page.keyboard.press('ControlOrMeta+z');
  await expect(page.frameLocator('#preview-frame').getByRole('heading', { name: 'Hello, world.' })).toBeVisible();
  await page.keyboard.press('ControlOrMeta+Shift+z');
  await expect(page.frameLocator('#preview-frame').getByRole('heading', { name: 'Applied from chat' })).toBeVisible();
  await page.reload();
  await expect(page.frameLocator('#preview-frame').getByRole('heading', { name: 'Applied from chat' })).toBeVisible();
});

test('a uniquely matching end-of-file hunk applies when the model includes a final newline', async ({ page }) => {
  const content = [
    'Update the heading.', '', '```btsx patch=/src/App.btsx',
    '<' + '<<<<<< SEARCH', 'h1 Before', '=======', 'h1 After', '>' + '>>>>>> REPLACE', '```'
  ].join('\n');
  await page.route('**/api/ai/status', route => route.fulfill({ json: { configured: { cohere: true, openrouter: false, custom: false } } }));
  await page.route('**/api/ai/chat', route => route.fulfill({ contentType: 'text/event-stream', body: `data: ${JSON.stringify({ choices: [{ delta: { content } }] })}\n\ndata: [DONE]\n\n` }));
  await page.goto('/?dock=0,70,30');
  await expect(page.locator('#preview-status')).toHaveText('Live', { timeout: 20000 });
  const editor = page.getByRole('textbox', { name: 'Source editor' });
  await editor.focus();
  await page.keyboard.press('ControlOrMeta+a');
  await page.keyboard.insertText('h1 Before');
  await expect(page.frameLocator('#preview-frame').getByRole('heading', { name: 'Before' })).toBeVisible();
  const autoApply = page.getByRole('checkbox', { name: 'Auto-apply', exact: true });
  if (await autoApply.isChecked()) await autoApply.click();
  await page.getByRole('textbox', { name: 'Message AI' }).fill('Update the heading');
  await page.getByRole('button', { name: 'Send message', exact: true }).click();
  await page.getByRole('button', { name: 'Apply & verify', exact: true }).click();
  await expect(page.locator('.chat-apply')).toContainText(/applied\s*compiled/);
  await expect(editor).toContainText('h1 After');
  await expect(page.frameLocator('#preview-frame').getByRole('heading', { name: 'After' })).toBeVisible();
});

test('compiler errors are reported in chat without replacing source or preview', async ({ page }) => {
  await start(page, replacement('h1(title={) Broken\n'));
  await page.getByRole('button', { name: 'Apply & verify', exact: true }).click();
  await expect(page.locator('.chat-apply-error')).toContainText('/src/App.btsx:');
  await expect(page.getByRole('textbox', { name: 'Source editor' })).toContainText('import Counter');
  await expect(page.frameLocator('#preview-frame').getByRole('heading', { name: 'Hello, world.' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Apply & verify', exact: true })).toBeEnabled();
});

test('stale recommendations cannot overwrite user edits and illustrative snippets have no apply action', async ({ page }) => {
  await start(page, replacement('h1 Stale proposal\n'));
  const editor = page.getByRole('textbox', { name: 'Source editor' });
  await editor.focus(); await page.keyboard.press('ControlOrMeta+a'); await page.keyboard.insertText('h1 Keep my edit\n');
  await page.getByRole('button', { name: 'Apply & verify', exact: true }).click();
  await expect(page.locator('.chat-apply-error')).toContainText('changed since this response');
  await expect(editor).toContainText('Keep my edit');
  await page.getByRole('button', { name: 'New chat', exact: true }).click();
  await page.unroute('**/api/ai/chat');
  await page.route('**/api/ai/chat', route => route.fulfill({ contentType: 'text/event-stream', body: `data: ${JSON.stringify({ choices: [{ delta: { content: 'Example:\n```btsx\nh1 Just a snippet\n```' } }] })}\n\ndata: [DONE]\n\n` }));
  await page.getByRole('textbox', { name: 'Message AI' }).fill('Explain');
  await page.getByRole('button', { name: 'Send message', exact: true }).click();
  await expect(page.locator('.chat-message.assistant')).toHaveAttribute('data-message-state', 'complete');
  await expect(page.getByRole('button', { name: 'Apply & verify', exact: true })).toHaveCount(0);
});
