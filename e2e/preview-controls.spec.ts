import { expect, test } from '@playwright/test';

test('zoom preserves viewport width, running state and iframe identity while keeping overflow reachable', async ({ page }) => {
  await page.goto('/playground');
  const preview = page.frameLocator('#preview-frame');
  await expect(preview.getByRole('heading', { name: 'Hello, world.' })).toBeVisible();
  await preview.getByRole('button', { name: 'Increase count' }).click();
  const original = await page.locator('#preview-frame').getAttribute('srcdoc');
  await page.getByRole('button', { name: 'Tablet preview', exact: true }).click();
  const zoom = page.getByRole('combobox', { name: 'preview-zoom' });
  for (const value of ['50', '75', '100', '125', '150']) {
    await zoom.selectOption(value);
    await expect(page.locator('#preview-frame')).toHaveCSS('width', `${Math.round(76800 / Number(value))}px`);
    const box = (await page.locator('#preview-frame').boundingBox())!;
    const stage = (await page.locator('.preview-stage').boundingBox())!;
    expect(box.width).toBeLessThanOrEqual(stage.width + 1);
    await expect(preview.locator('.value')).toHaveText('1');
    await expect(page.locator('#preview-frame')).toHaveAttribute('srcdoc', original!);
    expect(await page.locator('.preview-stage').evaluate(element => {
      element.scrollLeft = 0;
      return element.querySelector('.preview-canvas')!.getBoundingClientRect().left >= element.getBoundingClientRect().left - 1;
    })).toBe(true);
  }
  await page.getByRole('button', { name: 'Mobile preview', exact: true }).click();
  await zoom.selectOption('50');
  await expect(page.locator('#preview-frame')).toHaveCSS('width', '750px');
  await preview.getByRole('button', { name: 'Increase count' }).click();
  await expect(preview.locator('.value')).toHaveText('2');
  await page.setViewportSize({ width: 320, height: 740 });
  await expect(zoom).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: 'test-results/preview-zoom-mobile.png' });
});

test('native fullscreen enters and exits without restarting preview; external exit restores the control', async ({ page }) => {
  await page.goto('/playground');
  const preview = page.frameLocator('#preview-frame');
  await expect(preview.getByRole('heading', { name: 'Hello, world.' })).toBeVisible();
  const supported = await page.evaluate(() => Boolean(document.fullscreenEnabled && document.documentElement.requestFullscreen));
  const enter = page.getByRole('button', { name: 'Enter fullscreen preview' });
  if (!supported) {
    await expect(enter).toBeDisabled();
    return;
  }
  await preview.getByRole('button', { name: 'Increase count' }).click();
  const original = await page.locator('#preview-frame').getAttribute('srcdoc');
  await page.getByRole('combobox', { name: 'preview-zoom' }).selectOption('75');
  await enter.click();
  const exit = page.getByRole('button', { name: 'Exit fullscreen preview' });
  await expect(exit).toHaveAttribute('aria-pressed', 'true');
  expect(await page.evaluate(() => document.fullscreenElement?.contains(document.querySelector('#preview-frame')))).toBe(true);
  await expect(preview.locator('.value')).toHaveText('1');
  await preview.getByRole('button', { name: 'Increase count' }).click();
  await expect(preview.locator('.value')).toHaveText('2');
  await page.screenshot({ path: 'test-results/preview-fullscreen.png' });
  await exit.click();
  await expect(enter).toHaveAttribute('aria-pressed', 'false');
  await expect(enter).toBeFocused();
  await enter.click();
  await expect(exit).toBeVisible();
  // Browser chrome/Escape also exits outside the component's toggle handler.
  await page.evaluate(() => document.exitFullscreen());
  await expect(enter).toHaveAttribute('aria-pressed', 'false');
  await expect(enter).toBeFocused();
  await expect(preview.locator('.value')).toHaveText('2');
  await expect(page.locator('#preview-frame')).toHaveAttribute('srcdoc', original!);
  await expect(page.getByRole('combobox', { name: 'preview-zoom' })).toHaveValue('75');
});

test('fullscreen rejection is visible and leaves the running app usable', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(document, 'fullscreenEnabled', { configurable: true, value: true });
    Element.prototype.requestFullscreen = () => Promise.reject(new Error('Denied by browser'));
  });
  await page.goto('/playground');
  const preview = page.frameLocator('#preview-frame');
  await expect(preview.getByRole('heading', { name: 'Hello, world.' })).toBeVisible();
  await page.getByRole('button', { name: 'Enter fullscreen preview' }).click();
  await expect(page.locator('.fullscreen-notice')).toContainText('Fullscreen could not be changed.');
  await expect(page.getByRole('button', { name: 'Enter fullscreen preview' })).toBeEnabled();
  await preview.getByRole('button', { name: 'Increase count' }).click();
  await expect(preview.locator('.value')).toHaveText('1');
});
