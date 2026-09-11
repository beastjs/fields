import { expect, test, type Page } from '@playwright/test';

async function expectViewportFit(page: Page) {
  await expect.poll(() => page.evaluate(() => {
    const shell = document.querySelector('.playground')!.getBoundingClientRect();
    return {
      horizontal: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth, shell.right) - innerWidth,
      vertical: Math.max(document.documentElement.scrollHeight, document.body.scrollHeight, shell.bottom) - innerHeight,
    };
  })).toEqual({ horizontal: 0, vertical: 0 });
  await expect(page.locator('.statusbar')).toBeInViewport();
}

test('workspace stays inside the viewport through chat collapse, restore, and screen resizing', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#preview-status')).toHaveText('Live', { timeout: 20000 });
  for (const viewport of [{ width: 1440, height: 900 }, { width: 1024, height: 600 },
    { width: 390, height: 844 }, { width: 320, height: 568 }]) {
    await page.setViewportSize(viewport);
    await expectViewportFit(page);
    await page.locator('[data-view="chat"]').click();
    await expect(page.locator('#pane-chat')).toBeVisible();
    await expectViewportFit(page);
    await page.getByRole('button', { name: 'Collapse ai chat', exact: true }).click();
    await expect(page.locator('#pane-chat')).toBeHidden();
    await expectViewportFit(page);
    await page.getByRole('button', { name: 'Reset layout', exact: true }).click();
    await expectViewportFit(page);
    if (viewport.width <= 760) await expect(page.locator('#pane-files')).toBeHidden();
    if (viewport.width === 320 || viewport.width === 1440) {
      await page.screenshot({ path: `test-results/viewport-${viewport.width}.png`, fullPage: true });
    }
  }
});
