import { expect, test } from '@playwright/test'

test('guest project memory survives new chats and reloads, and retrieves original messages', async ({ page }) => {
  const requests: { purpose?: string; messages: { content: string }[]; memory?: { view: string; recalled?: string } }[] = []
  await page.route('**/api/jev/status', route => route.fulfill({ json: { configured: false } }))
  await page.route('**/api/ai/status', route => route.fulfill({ json: { configured: { cohere: true, meta: true, openrouter: false, custom: false } } }))
  await page.route('**/api/ai/chat', route => {
    const request = route.request().postDataJSON(); requests.push(request)
    const content = request.purpose === 'compaction' ? 'User chose a sapphire palette; this is a design constraint.'
      : request.messages.at(-1).content === 'Recall my exact original note' && !request.memory?.recalled ? '```memory\n{"id":0,"n":1}\n```'
      : 'Remembered.'
    return route.fulfill({ contentType: 'text/event-stream', body: `data: ${JSON.stringify({ choices: [{ delta: { content } }] })}\n\ndata: [DONE]\n\n` })
  })
  await page.goto('/playground?dock=0,70,30')
  await expect(page.getByText('Project memory · 0 messages', { exact: true })).toBeVisible({ timeout: 20000 })
  const send = async (prompt: string) => {
    await page.getByRole('textbox', { name: 'Message AI' }).fill(prompt)
    await page.getByRole('button', { name: 'Send message', exact: true }).click()
    await expect(page.locator('.chat-message.assistant').last()).toHaveAttribute('data-message-state', 'complete')
  }
  const original = 'Use a sapphire palette. Exact original note: ' + 'Keep the calm ocean mood. '.repeat(40)
  await send(original)
  await expect(page.getByText('Project memory · 2 messages', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'New chat', exact: true }).click()
  await expect(page.locator('.chat-message')).toHaveCount(0)
  await send('Remember my palette')
  expect(requests.filter(request => !request.purpose).at(-1)!.memory!.view).toContain('sapphire')
  await page.reload()
  await expect(page.getByText('Project memory · 4 messages', { exact: true })).toBeVisible()
  await expect(page.locator('.chat-message')).toHaveCount(2)
  await expect(page.locator('.chat-message.user')).toContainText('Remember my palette')
  await expect(page.locator('.chat-message.assistant')).toContainText('Remembered.')
  await send('Recall my exact original note')
  expect(requests.filter(request => !request.purpose).at(-1)!.memory!.recalled).toContain(original.trim())
  await expect(page.getByText('Project memory · 6 messages', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'New chat', exact: true }).click()
  await expect(page.locator('.chat-message')).toHaveCount(0)
  await page.reload()
  await expect(page.getByText('Project memory · 6 messages', { exact: true })).toBeVisible()
  await expect(page.locator('.chat-message')).toHaveCount(0)
  await page.screenshot({ path: `test-results/project-memory-${test.info().project.name}.png`, fullPage: true })
})

test('refresh restores change proposals for reading without applying or repairing them again', async ({ page }) => {
  let requests = 0
  await page.route('**/api/jev/status', route => route.fulfill({ json: { configured: false } }))
  await page.route('**/api/ai/status', route => route.fulfill({ json: { configured: { cohere: true, meta: true, openrouter: false, custom: false } } }))
  await page.route('**/api/ai/chat', route => {
    requests++
    const request = route.request().postDataJSON()
    const content = request.purpose === 'compaction' ? 'Proposed a heading change.' : 'A new heading:\n\n```btsx file=/src/App.btsx\nh1 Saved proposal\n```'
    return route.fulfill({ contentType: 'text/event-stream', body: `data: ${JSON.stringify({ choices: [{ delta: { content } }] })}\n\ndata: [DONE]\n\n` })
  })
  await page.goto('/playground?dock=0,70,30')
  await expect(page.frameLocator('#preview-frame').getByRole('heading', { name: 'Hello, world.' })).toBeVisible({ timeout: 20000 })
  await expect(page.getByText('Project memory · 0 messages', { exact: true })).toBeVisible()
  await page.getByRole('checkbox', { name: /^Auto-apply/ }).uncheck()
  await page.getByRole('textbox', { name: 'Message AI' }).fill('Suggest a new heading')
  await page.getByRole('button', { name: 'Send message', exact: true }).click()
  await expect(page.locator('.chat-message.assistant')).toHaveAttribute('data-message-state', 'complete')
  await expect(page.getByRole('button', { name: 'Apply & verify', exact: true })).toBeVisible()
  await page.reload()
  await expect(page.locator('.chat-message')).toHaveCount(2)
  await expect(page.locator('.chat-message.user')).toContainText('Suggest a new heading')
  await expect(page.locator('.chat-message.assistant')).toContainText('h1 Saved proposal')
  await expect(page.locator('.chat-message.assistant')).toContainText('HISTORY')
  await expect(page.getByRole('checkbox', { name: /^Auto-apply/ })).toBeChecked()
  await expect(page.getByRole('button', { name: 'Apply & verify', exact: true })).toHaveCount(0)
  await expect(page.frameLocator('#preview-frame').getByRole('heading', { name: 'Hello, world.' })).toBeVisible()
  await expect(page.locator('iframe[title="Verifying proposed change"]')).toHaveCount(0)
  expect(requests).toBe(1)
})
