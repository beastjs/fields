import { beforeEach, describe, expect, test } from 'bun:test';
import { handler as worker, LIMITS, MODULE_PREFIX, type Bucket, type Env, type RouteStore } from '../hosting/src/app';
import { SITE_MODULE_PREFIX } from '../src/playground/site-build';

const TOKEN = 'test-admin-token-0123456789abcdefghijklmnop';

class MemoryBucket implements Bucket {
  objects = new Map<string, { value: string; contentType?: string }>();
  async get(key: string) {
    const object = this.objects.get(key);
    if (!object) return null;
    return { body: new Response(object.value).body!, httpEtag: `"${Bun.hash(object.value).toString(16)}"`, httpMetadata: { contentType: object.contentType } };
  }
  async head(key: string) { return this.objects.has(key) ? { key } : null; }
  async put(key: string, value: string, options?: { httpMetadata?: { contentType?: string } }) {
    this.objects.set(key, { value, contentType: options?.httpMetadata?.contentType });
  }
  async list({ prefix, cursor, limit = 1000 }: { prefix: string; cursor?: string; limit?: number }) {
    const keys = [...this.objects.keys()].filter(key => key.startsWith(prefix)).sort();
    const start = cursor ? Number(cursor) : 0;
    const page = keys.slice(start, start + limit);
    const truncated = start + limit < keys.length;
    return { objects: page.map(key => ({ key })), truncated, cursor: truncated ? String(start + limit) : undefined };
  }
  async delete(keys: string | string[]) { for (const key of [keys].flat()) this.objects.delete(key); }
}
class MemoryRoutes implements RouteStore {
  values = new Map<string, string>();
  async get(key: string) { return this.values.get(key) ?? null; }
  async put(key: string, value: string) { this.values.set(key, value); }
  async delete(key: string) { this.values.delete(key); }
}

let env: Env & { SITES: MemoryBucket; ROUTES: MemoryRoutes };
beforeEach(() => { env = { SITES: new MemoryBucket(), ROUTES: new MemoryRoutes(), SITES_DOMAIN: 'sites.test', ADMIN_TOKEN: TOKEN }; });

const call = (url: string, init: RequestInit = {}) => worker.fetch(new Request(url, init), env);
const adminCall = (path: string, method: string, body?: unknown, token = TOKEN) => call(`https://admin.example${path}`, {
  method, headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
  body: body === undefined ? undefined : JSON.stringify(body),
});
const html = (content: string) => ({ path: '/index.html', content, contentType: 'text/html; charset=utf-8' });
const module = (path: string, content: string) => ({ path, content, contentType: 'text/javascript; charset=utf-8' });

async function publish(slug: string, deploymentId: string, files = [html(`<p>${deploymentId}</p>`), module('/_m/abc/src/main.ts.js', 'export {}')]) {
  expect((await adminCall(`/_admin/deployments/${deploymentId}`, 'PUT', { files })).status).toBe(201);
  expect((await adminCall(`/_admin/routes/${slug}`, 'PUT', { deploymentId })).status).toBe(200);
}

describe('hosting worker: sites', () => {
  test('agrees with the site build on where modules live', () => expect(MODULE_PREFIX).toBe(SITE_MODULE_PREFIX));

  test('serves a routed deployment with the right caching', async () => {
    await publish('hello', 'd1');
    const page = await call('https://hello.sites.test/');
    expect(page.status).toBe(200);
    expect(await page.text()).toBe('<p>d1</p>');
    expect(page.headers.get('content-type')).toBe('text/html; charset=utf-8');
    expect(page.headers.get('cache-control')).toContain('must-revalidate');
    expect(page.headers.get('x-content-type-options')).toBe('nosniff');
    const code = await call('https://hello.sites.test/_m/abc/src/main.ts.js');
    expect(await code.text()).toBe('export {}');
    expect(code.headers.get('cache-control')).toContain('immutable');
  });

  test('falls back to the app shell for client routes, but not for missing files', async () => {
    await publish('hello', 'd1');
    expect(await (await call('https://hello.sites.test/about/team')).text()).toBe('<p>d1</p>');
    expect((await call('https://hello.sites.test/missing.png')).status).toBe(404);
    expect((await call('https://hello.sites.test/_m/nope/x')).status).toBe(404);
  });

  test('revalidates with ETags and answers HEAD without a body', async () => {
    await publish('hello', 'd1');
    const etag = (await call('https://hello.sites.test/')).headers.get('etag')!;
    const cached = await call('https://hello.sites.test/', { headers: { 'if-none-match': etag } });
    expect(cached.status).toBe(304);
    const head = await call('https://hello.sites.test/', { method: 'HEAD' });
    expect(head.status).toBe(200);
    expect(await head.text()).toBe('');
    expect((await call('https://hello.sites.test/', { method: 'POST' })).status).toBe(405);
  });

  test('switches deployments atomically and unpublishes', async () => {
    await publish('hello', 'd1');
    await publish('hello', 'd2');
    expect(await (await call('https://hello.sites.test/')).text()).toBe('<p>d2</p>');
    // Rollback is just a route change back to a sealed deployment.
    expect((await adminCall('/_admin/routes/hello', 'PUT', { deploymentId: 'd1' })).status).toBe(200);
    expect(await (await call('https://hello.sites.test/')).text()).toBe('<p>d1</p>');
    await adminCall('/_admin/routes/hello', 'DELETE');
    expect((await call('https://hello.sites.test/')).status).toBe(404);
  });

  test('unknown slugs, other hosts and odd paths find nothing', async () => {
    await publish('hello', 'd1');
    expect((await call('https://other.sites.test/')).status).toBe(404);
    expect((await call('https://a.b.sites.test/')).status).toBe(404);
    expect((await call('https://sites.test/')).status).toBe(404);
    expect((await call('https://hello.sites.test/%E0%A4%A')).status).toBe(404);
    // `%2e%2e` alone is normalized away by the URL parser; an encoded slash survives it and must be refused here.
    expect((await call('https://hello.sites.test/a/%2E%2E%2Findex.html')).status).toBe(404);
    // A site host never reaches the admin API, even with the token.
    const probe = await call('https://hello.sites.test/_admin/routes/hello', { headers: { authorization: `Bearer ${TOKEN}` } });
    expect(await probe.text()).toBe('<p>d1</p>');
  });
});

describe('hosting worker: admin API', () => {
  test('requires a configured token and the right bearer', async () => {
    expect((await adminCall('/_admin/routes/hello', 'GET', undefined, 'wrong')).status).toBe(401);
    expect((await call('https://admin.example/_admin/routes/hello')).status).toBe(401);
    env.ADMIN_TOKEN = 'short';
    expect((await adminCall('/_admin/routes/hello', 'GET', undefined, 'short')).status).toBe(500);
  });

  test('seals deployments: no overwrites, no routing to an unsealed one', async () => {
    expect((await adminCall('/_admin/routes/hello', 'PUT', { deploymentId: 'ghost' })).status).toBe(409);
    await publish('hello', 'd1');
    const again = await adminCall('/_admin/deployments/d1', 'PUT', { files: [html('changed')] });
    expect(again.status).toBe(409);
    const manifest = await (await adminCall('/_admin/deployments/d1', 'GET')).json() as { files: { path: string }[]; bytes: number };
    expect(manifest.files.map(file => file.path)).toEqual(['/index.html', '/_m/abc/src/main.ts.js']);
    expect(manifest.bytes).toBe('<p>d1</p>'.length + 'export {}'.length);
  });

  test('validates uploads', async () => {
    const put = (files: unknown) => adminCall('/_admin/deployments/bad', 'PUT', { files });
    expect((await put([])).status).toBe(400);
    expect((await put([module('/a.js', '')])).status).toBe(400); // no index.html
    expect((await put([html(''), html('')])).status).toBe(400);
    expect((await put([html(''), module('/../x.js', '')])).status).toBe(400);
    expect((await put([html(''), module('//x.js', '')])).status).toBe(400);
    expect((await put([html(''), { path: '/x', content: '', contentType: 'application/x-msdownload' }])).status).toBe(400);
    expect((await put(Array.from({ length: LIMITS.files + 1 }, (_, i) => module(`/${i}.js`, '')))).status).toBe(413);
    expect((await adminCall('/_admin/deployments/UPPER', 'PUT', { files: [html('')] })).status).toBe(400);
    expect((await adminCall('/_admin/routes/-bad-', 'PUT', { deploymentId: 'd1' })).status).toBe(400);
    expect(env.SITES.objects.size).toBe(0);
  });

  test('deletes a deployment completely, manifest first', async () => {
    const files = [html('x'), ...Array.from({ length: 30 }, (_, i) => module(`/_m/h/${i}.js`, ''))];
    await publish('hello', 'd1', files);
    await publish('other', 'd2');
    const response = await adminCall('/_admin/deployments/d1', 'DELETE');
    expect(await response.json()).toEqual({ deploymentId: 'd1', deleted: 31 });
    expect([...env.SITES.objects.keys()].some(key => key.includes('d1'))).toBe(false);
    expect((await adminCall('/_admin/routes/hello', 'PUT', { deploymentId: 'd1' })).status).toBe(409);
    expect(await (await call('https://other.sites.test/')).text()).toBe('<p>d2</p>');
  });
});
