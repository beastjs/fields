import { expect, test } from '@playwright/test';
import { helloWorld } from '../src/playground/examples';
import { PROJECT_STORAGE_KEY } from '../src/playground/project-storage';
import { addSection, planPageInstall } from '../src/playground/studio/page';
import { builtInThemes, THEME_BASE } from '../src/playground/studio/themes';
import { builtInPresets } from '../tests/built-in-presets';

test('design studio composes a page from a recipe, swaps a design, installs it, and reads it back', async ({ page }) => {
  await page.goto('/playground');
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await expect(page.frameLocator('#preview-frame').getByRole('heading', { name: 'Hello, world.' })).toBeVisible();

  await page.getByRole('button', { name: 'Design Studio' }).click();
  const studio = page.getByRole('dialog', { name: 'Design Studio' });
  await expect(studio).toBeVisible();
  await expect(studio.getByText('Your page is empty')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(studio).toBeVisible();
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
  await expect(studio).toBeVisible();
  await studio.getByRole('button', { name: 'Close', exact: true }).click();
  await expect(studio).not.toBeVisible();
  const preview = page.frameLocator('#preview-frame');
  await expect(preview.getByRole('heading', { name: 'Launch your idea in days, not months' })).toBeVisible();
  await expect(preview.getByRole('heading', { name: 'Compare plans' })).toBeVisible();

  await page.getByRole('button', { name: 'Design Studio' }).click();
  await expect(outline.getByRole('button', { name: /^0\d/ })).toHaveCount(7);
  await expect(studio.getByRole('button', { name: 'Page is up to date' })).toBeDisabled();
  const themeSelect = studio.getByLabel('Theme');
  await expect(themeSelect).toHaveValue('inherit');
  await themeSelect.selectOption('midnight');
  // Selection is reflected in the application Preview pane immediately; Apply makes that preview permanent.
  await expect.poll(() => preview.locator('[data-page]').evaluate(element => getComputedStyle(element).getPropertyValue('--studio-bg').trim()))
    .toBe('oklch(0.18 0.02 265)');
  await expect(preview.locator('[data-page]')).toHaveCSS('background-color', 'oklch(0.18 0.02 265)');
  await studio.getByRole('button', { name: 'Apply theme' }).click();
  await expect(studio).toBeVisible();
  await expect(studio.getByRole('button', { name: 'Page is up to date' })).toBeDisabled();
  await studio.getByRole('button', { name: 'Close Design Studio' }).focus();
  await page.keyboard.press('Enter');
  await expect(studio).not.toBeVisible();
  await expect.poll(() => preview.locator('[data-page]').evaluate(element => getComputedStyle(element).getPropertyValue('--studio-bg').trim()))
    .toBe('oklch(0.18 0.02 265)');
  await expect.poll(() => preview.locator('style[data-studio-tokens]').evaluate(element => element.textContent ?? ''))
    .toContain('Design Studio theme id: midnight');

  await page.getByRole('button', { name: 'Design Studio' }).click();
  await expect(themeSelect).toHaveValue('midnight');
  await studio.getByRole('button', { name: 'Close', exact: true }).click();
  await expect(studio).not.toBeVisible();
  expect(errors).toEqual([]);
});

test('an existing page with legacy section styles gains its applied theme in the preview', async ({ page }) => {
  const blocks = addSection([], 'hero-centered', builtInPresets).blocks;
  const midnight = builtInThemes.find(theme => theme.themeId === 'midnight')!;
  const install = planPageInstall(helloWorld, blocks, builtInPresets, midnight);
  const project = { ...helloWorld, files: { ...helloWorld.files, ...install.files } };
  // Reproduce an older saved page: the palette arrived, but the page never consumed its tokens.
  project.files['/src/style.css'] = project.files['/src/style.css'].replace(THEME_BASE, '');
  await page.addInitScript(({ key, project }) => {
    if (sessionStorage.getItem('legacy-theme-seeded')) return;
    localStorage.setItem(key, JSON.stringify(project));
    sessionStorage.setItem('legacy-theme-seeded', 'yes');
  }, { key: PROJECT_STORAGE_KEY, project });
  await page.goto('/playground');
  const preview = page.frameLocator('#preview-frame').locator('[data-page]');
  await expect(preview).toBeVisible();
  await expect(preview).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');

  await page.getByRole('button', { name: 'Design Studio' }).click();
  const studio = page.getByRole('dialog', { name: 'Design Studio' });
  await expect(studio.getByLabel('Theme')).toHaveValue('midnight');
  await studio.getByRole('button', { name: 'Update page', exact: true }).click();
  await expect(studio.getByRole('button', { name: 'Page is up to date' })).toBeDisabled();
  await studio.getByRole('button', { name: 'Close', exact: true }).click();
  await expect(preview).toHaveCSS('background-color', 'oklch(0.18 0.02 265)');
  await expect(preview).toHaveCSS('color', 'oklch(0.93 0.01 265)');
  await page.reload();
  await expect(preview).toHaveCSS('background-color', 'oklch(0.18 0.02 265)');
  await expect(preview).toHaveCSS('color', 'oklch(0.93 0.01 265)');
});
