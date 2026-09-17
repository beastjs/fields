import { expect, test } from '@playwright/test';

test('design studio composes a page from a recipe, swaps a design, installs it, and reads it back', async ({ page }) => {
  await page.goto('/');
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await expect(page.frameLocator('#preview-frame').getByRole('heading', { name: 'Hello, world.' })).toBeVisible();

  await page.getByRole('button', { name: 'Design Studio' }).click();
  const studio = page.getByRole('dialog', { name: 'Design Studio' });
  await expect(studio).toBeVisible();
  await expect(studio.getByText('Your page is empty')).toBeVisible();
  const draft = page.frameLocator('iframe[data-front="true"]');

  await studio.getByRole('button', { name: /Pre-launch waitlist/ }).first().click();
  const outline = studio.getByRole('complementary', { name: 'Page outline' });
  await expect(outline.getByRole('button', { name: /^0\d/ })).toHaveCount(6);
  await expect(draft.getByRole('heading', { name: 'The calm way to run your company' })).toBeVisible();
  await draft.getByLabel('Email address').fill('ada@example.com');
  await draft.getByRole('button', { name: 'Join the waitlist' }).click();
  await expect(draft.getByRole('status')).toContainText('ada@example.com');

  await outline.getByRole('button', { name: /Hero Waitlist signup/ }).click();
  const library = studio.getByRole('complementary', { name: 'Section library' });
  await library.getByRole('button', { name: /^Centered launch/ }).click();
  await expect(library.getByRole('button', { name: /^Centered launch/ })).toHaveAttribute('aria-pressed', 'true');
  await expect(draft.getByRole('heading', { name: 'Launch your idea in days, not months' })).toBeVisible();

  await library.getByRole('searchbox').fill('pricing table');
  await library.getByRole('button', { name: /^Pricing · Comparison table/ }).click();
  await expect(outline.getByRole('button', { name: /Pricing Comparison table/ })).toBeVisible();
  await expect(studio.getByRole('status').filter({ hasText: 'Replaces the starter app' })).toBeVisible();

  await studio.getByRole('button', { name: 'Add page to project' }).click();
  await expect(studio).not.toBeVisible();
  const preview = page.frameLocator('#preview-frame');
  await expect(preview.getByRole('heading', { name: 'Launch your idea in days, not months' })).toBeVisible();
  await expect(preview.getByRole('heading', { name: 'Compare plans' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Open Page.btsx' })).toBeVisible();

  await page.getByRole('button', { name: 'Design Studio' }).click();
  await expect(outline.getByRole('button', { name: /^0\d/ })).toHaveCount(7);
  await expect(studio.getByRole('button', { name: 'Page is up to date' })).toBeDisabled();
  expect(errors).toEqual([]);
});
