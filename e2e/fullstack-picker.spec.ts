import { expect, test } from '@playwright/test';

test('Fullstack gallery keeps roomy cards, visible actions, and restores the designer', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto('/playground');
  await page.getByRole('button', { name: 'Design Studio', exact: true }).click();
  await page.getByRole('tab', { name: 'Fullstack', exact: true }).click();
  const list = page.getByRole('region', { name: 'Fullstack apps' });
  await expect(list.getByRole('heading', { name: 'Start with a spark.' })).toBeVisible();
  await expect(list.locator('article')).toHaveCount(2);
  await page.screenshot({ path: '/tmp/fullstack-gallery-desktop.png' });
  const cards = await list.locator('article').evaluateAll(items => items.map(item => item.getBoundingClientRect().toJSON()));
  expect(cards[0].width).toBeGreaterThan(400);
  expect(Math.abs(cards[0].top - cards[1].top)).toBeLessThan(2);
  // The gallery scrolls; cards never shrink to clip their controls.
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
  await preview.getByRole('button', { name: 'Close fullstack preview' }).click();
  await page.keyboard.press('Escape');
  await expect(list).toHaveCount(0);
  await expect(page.getByRole('tab', { name: 'Fullstack', exact: true })).toBeFocused();
  await page.getByRole('tab', { name: 'Fullstack', exact: true }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  await expect.poll(() => list.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
  await expect(list.locator('article')).toHaveCount(2);
  await expect(list.getByRole('button', { name: 'Explore Margin Notes' })).toBeVisible();
  await list.locator('.gallery-scroll').evaluate(element => element.scrollTo(0, 0));
  await page.screenshot({ path: '/tmp/fullstack-gallery-mobile.png' });
});
