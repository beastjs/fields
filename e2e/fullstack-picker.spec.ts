import { expect, test } from '@playwright/test';

test('Fullstack cards keep their selection controls visible in a short sidebar', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto('/playground');
  await page.getByRole('button', { name: 'Design Studio', exact: true }).click();
  await page.getByRole('tab', { name: 'Fullstack', exact: true }).click();
  const list = page.getByRole('region', { name: 'Fullstack apps' });
  // Locator.click auto-scrolls clipped overflow containers, masking the original bug.
  // Verify each selection button is inside its card's visible box before any such scrolling.
  await expect.poll(() => list.locator('article').evaluateAll(cards => cards.every(card => {
    const button = card.querySelector('div > button:last-child');
    if (!button) return false;
    const bounds = card.getBoundingClientRect();
    const action = button.getBoundingClientRect();
    return action.top >= bounds.top && action.bottom <= bounds.bottom;
  }))).toBe(true);
  await list.getByRole('button', { name: 'Preview Form Supply', exact: true }).click();
  const preview = page.getByRole('dialog', { name: 'Fullstack app preview', exact: true });
  await expect(preview.getByRole('heading', { name: 'Form Supply', exact: true })).toBeVisible();
  await preview.getByRole('button', { name: 'Close fullstack preview' }).click();
  await list.getByRole('button', { name: 'Preview Margin Notes', exact: true }).click();
  await expect(preview.getByRole('heading', { name: 'Margin Notes', exact: true })).toBeVisible();
  await expect(preview.getByRole('button', { name: 'Use this app' })).toBeEnabled({ timeout: 30000 });
});
