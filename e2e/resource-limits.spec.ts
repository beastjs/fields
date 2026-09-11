import { expect, test } from '@playwright/test';

test('console bursts are bounded before transport and logging resumes with usable preview', async ({ page }) => {
  await page.goto('/');
  const preview = page.frameLocator('#preview-frame');
  await expect(preview.getByRole('heading', { name: 'Hello, world.' })).toBeVisible();
  const frame = page.frames().find(frame => frame.parentFrame())!;
  await page.evaluate(() => {
    const messages: unknown[] = [];
    Object.assign(window, { capturedConsole: messages });
    window.addEventListener('message', event => {
      if (event.data?.type === 'console') messages.push(event.data.args);
    });
  });
  const getterCalls = await frame.evaluate(() => {
    let calls = 0;
    const object = { get expensive() { calls++; return 'getter was invoked'; }, values: Array(10000).fill('large') };
    console.log(object);
    for (let index = 0; index < 1000; index++) console.log('burst', index);
    return calls;
  });
  expect(getterCalls).toBe(0);
  await expect(page.locator('#console-list')).toContainText('Console rate limit reached');
  const messages = await page.evaluate(() => (window as unknown as { capturedConsole: string[][] }).capturedConsole);
  expect(messages.length).toBeLessThanOrEqual(101);
  expect(messages.flat().join(' ')).toContain('[Getter]');
  expect(messages.flat().join(' ')).toContain('[Truncated]');
  await frame.evaluate(() => new Promise<void>(resolve => setTimeout(() => { console.log('logging resumed'); resolve(); }, 1100)));
  await expect(page.locator('#console-list')).toContainText('logging resumed');
  await preview.getByRole('button', { name: 'Increase count' }).click();
  await expect(preview.locator('.value')).toHaveText('1');
  await page.getByRole('button', { name: 'Reload preview', exact: true }).click();
  await expect(preview.locator('.value')).toHaveText('0');
});
