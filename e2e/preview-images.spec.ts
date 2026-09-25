import { expect, test } from '@playwright/test';
import { helloWorld } from '../src/playground/examples';
import { PROJECT_STORAGE_KEY } from '../src/playground/project-storage';

for (const hosted of [false, true]) {
  test(`${hosted ? 'hosted' : 'local'} preview loads HTTPS product images while fetch stays blocked`, async ({ page }) => {
    const requests: string[] = [];
    await page.route('https://images.example.test/**', route => {
      requests.push(route.request().url());
      expect(route.request().headers().referer).toBeUndefined();
      return route.fulfill({ contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="120" height="80"><rect width="120" height="80" fill="tomato"/></svg>' });
    });
    const workspace = { ...helloWorld, files: { ...helloWorld.files,
      '/src/App.btsx': 'section\n  h1 Products\n  img(src="https://images.example.test/product.svg" alt="Example product")\n',
    } };
    await page.addInitScript(({ key, project }) => localStorage.setItem(key, JSON.stringify({ version: 1, project, activeFile: '/src/App.btsx', preview: { width: '100%' } })), { key: PROJECT_STORAGE_KEY, project: workspace });
    await page.goto('/playground');
    const local = page.frameLocator('#preview-frame');
    await expect(local.getByRole('heading', { name: 'Products' })).toBeVisible({ timeout: 20000 });
    if (hosted) {
      await page.evaluate(() => {
        const frame = document.createElement('iframe');
        frame.id = 'hosted-image-test';
        frame.style.cssText = 'position:fixed;inset:0;width:300px;height:200px;z-index:100';
        frame.setAttribute('sandbox', 'allow-scripts');
        frame.src = '/preview.html';
        document.body.append(frame);
      });
      await expect(page.frameLocator('#hosted-image-test').locator('meta[http-equiv="Content-Security-Policy"]')).toHaveAttribute('content', /img-src https:/);
      await page.frameLocator('#hosted-image-test').locator('body').evaluate(body => {
        const image = document.createElement('img');
        image.alt = 'Example product';
        image.src = 'https://images.example.test/hosted-product.svg';
        body.append(image);
      });
    }
    const preview = hosted ? page.frameLocator('#hosted-image-test') : local;
    const image = preview.getByRole('img', { name: 'Example product' });
    await expect.poll(() => image.evaluate(node => (node as HTMLImageElement).naturalWidth)).toBe(120);
    await preview.locator('body').evaluate(body => {
      body.style.backgroundImage = 'url(https://images.example.test/background.svg)';
    });
    await expect.poll(() => requests.some(url => url.endsWith('/background.svg'))).toBe(true);
    expect(await preview.locator('body').evaluate(async () => {
      try { await fetch('https://images.example.test/api'); return false; } catch { return true; }
    })).toBe(true);
    expect(requests.some(url => url.endsWith('/api'))).toBe(false);
  });
}
