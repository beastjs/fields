import { expect, test } from '@playwright/test';

test('console bursts are bounded before transport and logging resumes with usable preview', async ({ page }) => {
  await page.goto('/playground?panes=24,36,30,10&rows=75,25');
  const preview = page.frameLocator('#preview-frame');
  await expect(preview.getByRole('heading', { name: 'Hello, world.' })).toBeVisible();
  const frame = (await (await page.locator('#preview-frame').elementHandle())!.contentFrame())!;
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

test('runtime errors and rejections share a budget and recover on reload', async ({ page }) => {
  await page.goto('/playground?panes=24,36,30,10&rows=75,25');
  const preview = page.frameLocator('#preview-frame');
  await expect(preview.getByRole('heading', { name: 'Hello, world.' })).toBeVisible();
  await page.evaluate(() => {
    Object.assign(window, { capturedErrors: [] });
    window.addEventListener('message', event => {
      if (event.data?.type === 'runtime-error') (window as unknown as { capturedErrors: string[] }).capturedErrors.push(event.data.message);
    });
  });
  const frame = (await (await page.locator('#preview-frame').elementHandle())!.contentFrame())!;
  await frame.evaluate(() => {
    for (let i = 0; i < 1000; i++) {
      if (i % 2) window.dispatchEvent(new ErrorEvent('error', { message: 'repeated error' }));
      else window.dispatchEvent(new PromiseRejectionEvent('unhandledrejection', { promise: Promise.resolve(), reason: 'repeated rejection' }));
    }
  });
  await expect(page.locator('#console-list')).toContainText('Runtime error rate limit reached');
  const errors = await page.evaluate(() => (window as unknown as { capturedErrors: string[] }).capturedErrors);
  expect(errors).toHaveLength(21);
  expect(errors).toContain('repeated error');
  expect(errors).toContain('repeated rejection');
  await frame.evaluate(() => new Promise<void>(resolve => setTimeout(() => {
    dispatchEvent(new ErrorEvent('error', { message: 'errors resumed' })); resolve();
  }, 1100)));
  await expect(page.locator('#console-list')).toContainText('errors resumed');
  await page.getByRole('button', { name: 'Reload preview', exact: true }).click();
  await expect(preview.getByRole('heading', { name: 'Hello, world.' })).toBeVisible();
  await preview.getByRole('button', { name: 'Increase count' }).click();
  await expect(preview.locator('.value')).toHaveText('1');
});
