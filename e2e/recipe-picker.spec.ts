import { expect, test } from '@playwright/test';

test('Recipes opens a four-column gallery with search and returns the chosen page to the designer', async ({ page }) => {
  await page.goto('/playground');
  await page.getByRole('button', { name: 'Design Studio', exact: true }).click();
  const studio = page.getByRole('dialog', { name: 'Design Studio' });
  const trigger = studio.getByRole('tab', { name: 'Recipes', exact: true });
  await trigger.click();
  const gallery = studio.getByRole('region', { name: 'Page recipes' });
  await expect(gallery.getByRole('heading', { name: 'Find your starting point.' })).toBeVisible();
  await expect.poll(() => gallery.locator('article').count()).toBeGreaterThan(4);
  const cards = await gallery.locator('article').evaluateAll(items => items.slice(0, 5).map(item => item.getBoundingClientRect().toJSON()));
  expect(new Set(cards.slice(0, 4).map(card => Math.round(card.top))).size).toBe(1);
  expect(cards[4].top).toBeGreaterThan(cards[0].top + cards[0].height);
  expect(cards[0].width).toBeGreaterThan(200);
  await page.screenshot({ path: '/tmp/recipes-gallery-desktop.png' });

  await gallery.getByRole('searchbox', { name: 'Search recipes' }).fill('no-such-recipe-123');
  await expect(gallery.locator('article')).toHaveCount(0);
  await expect(gallery.getByText('No matching recipes.', { exact: false })).toBeVisible();
  await gallery.getByRole('searchbox').fill('waitlist');
  await expect(gallery.getByRole('article', { name: 'Pre-launch waitlist', exact: true })).toBeVisible();
  await gallery.getByRole('button', { name: 'Use recipe: Pre-launch waitlist', exact: true }).click();
  await expect(gallery).toHaveCount(0);
  await expect(trigger).toBeFocused();
  await expect(studio.getByText('Your page is empty')).toHaveCount(0);
  await expect(page.frameLocator('iframe[data-front="true"]').getByRole('heading', { name: 'The calm way to run your company' })).toBeVisible();

  await trigger.click();
  await expect(gallery.getByRole('button', { name: 'Use recipe: Pre-launch waitlist', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await page.keyboard.press('Escape');
  await expect(gallery).toHaveCount(0);
  await expect(trigger).toBeFocused();
  await trigger.click();
  await gallery.getByRole('button', { name: '← Page designer' }).click();
  await expect(gallery).toHaveCount(0);
  await expect(trigger).toBeFocused();

  const fullstackTrigger = studio.getByRole('tab', { name: 'Fullstack', exact: true });
  await fullstackTrigger.click();
  const apps = studio.getByRole('region', { name: 'Fullstack apps' });
  await expect(apps.locator('article')).toHaveCount(2);
  await page.keyboard.press('Escape');
  await expect(apps).toHaveCount(0);
  await expect(fullstackTrigger).toBeFocused();
  await fullstackTrigger.click();
  await apps.getByRole('button', { name: 'Close Fullstack gallery', exact: true }).click();
  await expect(apps).toHaveCount(0);
  await expect(studio).toBeVisible();
  await expect(fullstackTrigger).toBeFocused();
});

test('Recipes uses two columns on tablets and one on phones without horizontal overflow', async ({ page }) => {
  await page.setViewportSize({ width: 850, height: 900 });
  await page.goto('/playground');
  await page.getByRole('button', { name: 'Design Studio', exact: true }).click();
  await page.getByRole('tab', { name: 'Recipes', exact: true }).click();
  const gallery = page.getByRole('region', { name: 'Page recipes' });
  await expect.poll(() => gallery.locator('article').count()).toBeGreaterThan(4);
  const tablet = await gallery.locator('article').evaluateAll(items => items.slice(0, 3).map(item => item.getBoundingClientRect().toJSON()));
  expect(Math.abs(tablet[0].top - tablet[1].top)).toBeLessThan(2);
  expect(tablet[2].top).toBeGreaterThan(tablet[0].top);

  await page.setViewportSize({ width: 390, height: 844 });
  const mobile = await gallery.locator('article').evaluateAll(items => items.slice(0, 2).map(item => item.getBoundingClientRect().toJSON()));
  expect(Math.abs(mobile[0].left - mobile[1].left)).toBeLessThan(2);
  expect(mobile[1].top).toBeGreaterThan(mobile[0].top);
  expect(await gallery.locator('.gallery-scroll').evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
  await page.screenshot({ path: '/tmp/recipes-gallery-mobile.png' });
  await gallery.getByRole('button', { name: 'Close Recipes gallery', exact: true }).click();
  await expect(gallery).toHaveCount(0);
  await expect(page.getByRole('dialog', { name: 'Design Studio' })).toBeVisible();
  await expect(page.getByRole('tab', { name: 'Recipes', exact: true })).toBeFocused();
});
