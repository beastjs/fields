/**
 * Serves every published project from one Worker.
 *
 * `{slug}.{SITES_DOMAIN}` → KV `route:{slug}` → deployment id → R2 `deployments/{id}/…`. Deployments are immutable
 * once sealed, so publishing and rolling back are a single KV write. The private admin API (bearer token, used only
 * by the Convex backend) answers on any other host under `/_admin/`; site hosts never reach it.
 */

/** The parts of an R2 bucket this Worker uses. The real binding satisfies it. */
export interface Bucket {
  get(key: string): Promise<StoredObject | null>;
  head(key: string): Promise<{ key: string } | null>;
  put(key: string, value: string, options?: { httpMetadata?: { contentType?: string } }): Promise<unknown>;
  list(options: { prefix: string; cursor?: string; limit?: number }): Promise<{ objects: { key: string }[]; truncated: boolean; cursor?: string }>;
  delete(keys: string | string[]): Promise<void>;
}
export interface StoredObject {
  body: ReadableStream;
  httpEtag: string;
  httpMetadata?: { contentType?: string };
}
/** The parts of a KV namespace this Worker uses. */
export interface RouteStore {
  get(key: string, options?: { cacheTtl?: number }): Promise<string | null>;
  put(key: string, value: string): Promise<void>;
  delete(key: string): Promise<void>;
}
export interface Env {
  SITES: Bucket;
  ROUTES: RouteStore;
  /** Sites answer on its subdomains, e.g. `playsites.dev` → `hello.playsites.dev`. `localhost` in development. */
  SITES_DOMAIN: string;
  /** Shared with the Convex backend. */
  ADMIN_TOKEN: string;
}

/** Must match `SITE_MODULE_PREFIX` in src/playground/site-build.ts; the tests hold them together. */
export const MODULE_PREFIX = '/_m';
export const LIMITS = { files: 500, bytes: 25 * 1024 * 1024, pathLength: 1024 };
/** KV reads may lag a write by this long at any one edge, so publish/unpublish take up to a minute to show. */
const ROUTE_CACHE_SECONDS = 60;

const SLUG = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;
const DEPLOYMENT_ID = /^[a-z0-9_-]{1,64}$/;
const CONTENT_TYPE = /^(?:text\/(?:html|javascript|css|plain|xml)|application\/(?:json|javascript|manifest\+json|xml)|image\/svg\+xml)(?:; ?charset=utf-8)?$/;

const routeKey = (slug: string) => `route:${slug}`;
const fileKey = (deploymentId: string, path: string) => `deployments/${deploymentId}${path}`;
const manifestKey = (deploymentId: string) => `manifests/${deploymentId}.json`;

export const handler = {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const host = url.hostname.toLowerCase();
    const suffix = `.${env.SITES_DOMAIN.toLowerCase()}`;
    if (host.endsWith(suffix)) {
      const slug = host.slice(0, -suffix.length);
      return SLUG.test(slug) ? serveSite(request, url, env, slug) : noSite();
    }
    if (url.pathname.startsWith('/_admin/')) return admin(request, url, env);
    return noSite();
  },
};

// ---------------------------------------------------------------------------------------------------------------
// Public sites

async function serveSite(request: Request, url: URL, env: Env, slug: string): Promise<Response> {
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    return new Response('Method not allowed', { status: 405, headers: { allow: 'GET, HEAD' } });
  }
  const deploymentId = await env.ROUTES.get(routeKey(slug), { cacheTtl: ROUTE_CACHE_SECONDS });
  if (!deploymentId) return noSite();
  let path: string;
  try { path = decodeURIComponent(url.pathname); } catch { return notFound(); }
  if (path.endsWith('/')) path += 'index.html';
  if (!isSafePath(path)) return notFound();

  let object = await env.SITES.get(fileKey(deploymentId, path));
  // Client-side routes: an extensionless path outside the module prefix falls back to the app shell.
  if (!object && !path.startsWith(`${MODULE_PREFIX}/`) && !/\.[^/]+$/.test(path)) {
    path = '/index.html';
    object = await env.SITES.get(fileKey(deploymentId, path));
  }
  if (!object) return notFound();

  const headers = new Headers({
    'content-type': object.httpMetadata?.contentType ?? 'application/octet-stream',
    etag: object.httpEtag,
    // Module URLs are content-addressed; everything else must revalidate so a publish shows up immediately.
    'cache-control': path.startsWith(`${MODULE_PREFIX}/`) ? 'public, max-age=31536000, immutable' : 'public, max-age=0, must-revalidate',
    'x-content-type-options': 'nosniff',
    'referrer-policy': 'strict-origin-when-cross-origin',
  });
  if (request.headers.get('if-none-match') === object.httpEtag) {
    await object.body.cancel();
    return new Response(null, { status: 304, headers });
  }
  if (request.method === 'HEAD') {
    await object.body.cancel();
    return new Response(null, { headers });
  }
  return new Response(object.body, { headers });
}

const noSite = () => new Response(
  '<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>No site here</title><body style="font:16px system-ui;display:grid;place-items:center;min-height:90vh;margin:0"><p>There is no published site at this address.</p>',
  { status: 404, headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' } },
);
const notFound = () => new Response('Not found', { status: 404, headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' } });

/** Absolute, no empty/dot segments, no control characters. R2 keys are opaque, but stored paths should be canonical. */
function isSafePath(path: string): boolean {
  if (!path.startsWith('/') || path.length > LIMITS.pathLength || /[\u0000-\u001f\u007f\\]/.test(path)) return false;
  return path.slice(1).split('/').every(segment => segment !== '' && segment !== '.' && segment !== '..');
}

// ---------------------------------------------------------------------------------------------------------------
// Admin API

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });
const fail = (status: number, error: string, message: string) => json({ error, message }, status);

async function admin(request: Request, url: URL, env: Env): Promise<Response> {
  if (!env.ADMIN_TOKEN || env.ADMIN_TOKEN.length < 32) return fail(500, 'NOT_CONFIGURED', 'ADMIN_TOKEN must be set to at least 32 characters.');
  const presented = request.headers.get('authorization')?.match(/^Bearer (.+)$/)?.[1] ?? '';
  if (!timingSafeEqual(presented, env.ADMIN_TOKEN)) return fail(401, 'UNAUTHORIZED', 'Invalid admin token.');

  const [, , kind, name, ...rest] = url.pathname.split('/');
  if (rest.length || !name) return fail(404, 'NOT_FOUND', 'Unknown admin route.');
  if (kind === 'deployments') {
    if (!DEPLOYMENT_ID.test(name)) return fail(400, 'INVALID_DEPLOYMENT_ID', 'Deployment ids are 1–64 of [a-z0-9_-].');
    if (request.method === 'PUT') return putDeployment(request, env, name);
    if (request.method === 'DELETE') return deleteDeployment(env, name);
    if (request.method === 'GET') {
      const manifest = await env.SITES.get(manifestKey(name));
      return manifest ? new Response(manifest.body, { headers: { 'content-type': 'application/json' } }) : fail(404, 'NOT_FOUND', 'No such deployment.');
    }
  } else if (kind === 'routes') {
    if (!SLUG.test(name)) return fail(400, 'INVALID_SLUG', 'Slugs are 1–63 of [a-z0-9-], not starting or ending with a hyphen.');
    if (request.method === 'GET') return json({ slug: name, deploymentId: await env.ROUTES.get(routeKey(name)) });
    if (request.method === 'PUT') return putRoute(request, env, name);
    if (request.method === 'DELETE') {
      await env.ROUTES.delete(routeKey(name));
      return json({ slug: name, deploymentId: null });
    }
  } else return fail(404, 'NOT_FOUND', 'Unknown admin route.');
  return fail(405, 'METHOD_NOT_ALLOWED', `${request.method} is not supported here.`);
}

function timingSafeEqual(a: string, b: string): boolean {
  const left = new TextEncoder().encode(a);
  const right = new TextEncoder().encode(b);
  let difference = left.length ^ right.length;
  for (let index = 0; index < right.length; index++) difference |= (left[index] ?? 0) ^ right[index];
  return difference === 0;
}

interface UploadFile { path: string; content: string; contentType: string }

async function readJSON(request: Request, maxBytes: number): Promise<unknown> {
  const declared = Number(request.headers.get('content-length'));
  if (declared > maxBytes) throw new RangeError('Request body is too large.');
  const text = await request.text();
  if (text.length > maxBytes) throw new RangeError('Request body is too large.');
  return JSON.parse(text);
}

/** Uploads a whole deployment in one request, then seals it with a manifest. A sealed deployment never changes. */
async function putDeployment(request: Request, env: Env, deploymentId: string): Promise<Response> {
  if (await env.SITES.head(manifestKey(deploymentId))) return fail(409, 'DEPLOYMENT_SEALED', 'This deployment is already uploaded.');
  let body: unknown;
  // JSON string escaping can at most double a UTF-8 payload's size, so this bound never rejects a legal upload.
  try { body = await readJSON(request, LIMITS.bytes * 2 + 64 * 1024); }
  catch (error) { return error instanceof RangeError ? fail(413, 'TOO_LARGE', error.message) : fail(400, 'INVALID_JSON', 'Body must be JSON.'); }
  const files = (body as { files?: unknown } | null)?.files;
  if (!Array.isArray(files) || files.length === 0) return fail(400, 'INVALID_FILES', 'Body must be { files: [{ path, content, contentType }] }.');
  if (files.length > LIMITS.files) return fail(413, 'TOO_MANY_FILES', `A deployment has at most ${LIMITS.files} files.`);
  const encoder = new TextEncoder();
  const seen = new Set<string>();
  let bytes = 0;
  const entries: (UploadFile & { bytes: number })[] = [];
  for (const file of files as Partial<UploadFile>[]) {
    if (!file || typeof file.path !== 'string' || typeof file.content !== 'string' || typeof file.contentType !== 'string') {
      return fail(400, 'INVALID_FILES', 'Every file needs a string path, content and contentType.');
    }
    if (!isSafePath(file.path)) return fail(400, 'INVALID_PATH', `Invalid path: ${file.path.slice(0, 200)}`);
    if (seen.has(file.path)) return fail(400, 'DUPLICATE_PATH', `Duplicate path: ${file.path}`);
    if (!CONTENT_TYPE.test(file.contentType)) return fail(400, 'INVALID_CONTENT_TYPE', `Unsupported content type for ${file.path}: ${file.contentType.slice(0, 100)}`);
    seen.add(file.path);
    const size = encoder.encode(file.content).byteLength;
    bytes += size;
    entries.push({ path: file.path, content: file.content, contentType: file.contentType, bytes: size });
  }
  if (!seen.has('/index.html')) return fail(400, 'MISSING_INDEX', 'A deployment must include /index.html.');
  if (bytes > LIMITS.bytes) return fail(413, 'TOO_LARGE', `A deployment is at most ${LIMITS.bytes} bytes.`);

  // Each put is one subrequest; batches keep concurrency modest and well under the per-request limit.
  for (let start = 0; start < entries.length; start += 25) {
    await Promise.all(entries.slice(start, start + 25).map(file =>
      env.SITES.put(fileKey(deploymentId, file.path), file.content, { httpMetadata: { contentType: file.contentType } })));
  }
  const manifest = { deploymentId, bytes, createdAt: new Date().toISOString(),
    files: entries.map(({ path, contentType, bytes }) => ({ path, contentType, bytes })) };
  await env.SITES.put(manifestKey(deploymentId), JSON.stringify(manifest), { httpMetadata: { contentType: 'application/json' } });
  return json({ deploymentId, files: entries.length, bytes }, 201);
}

/** Removes a deployment's files. The backend must first point every route elsewhere; KV cannot be searched by value. */
async function deleteDeployment(env: Env, deploymentId: string): Promise<Response> {
  // Unseal first, so a half-deleted deployment can never be routed to.
  await env.SITES.delete(manifestKey(deploymentId));
  let deleted = 0;
  let cursor: string | undefined;
  do {
    const page = await env.SITES.list({ prefix: `deployments/${deploymentId}/`, cursor, limit: 1000 });
    if (page.objects.length) await env.SITES.delete(page.objects.map(object => object.key));
    deleted += page.objects.length;
    cursor = page.truncated ? page.cursor : undefined;
  } while (cursor);
  return json({ deploymentId, deleted });
}

async function putRoute(request: Request, env: Env, slug: string): Promise<Response> {
  let body: unknown;
  try { body = await readJSON(request, 4096); } catch { return fail(400, 'INVALID_JSON', 'Body must be { deploymentId }.'); }
  const deploymentId = (body as { deploymentId?: unknown } | null)?.deploymentId;
  if (typeof deploymentId !== 'string' || !DEPLOYMENT_ID.test(deploymentId)) return fail(400, 'INVALID_DEPLOYMENT_ID', 'Body must be { deploymentId }.');
  if (!(await env.SITES.head(manifestKey(deploymentId)))) return fail(409, 'DEPLOYMENT_NOT_SEALED', 'Upload the deployment before routing to it.');
  await env.ROUTES.put(routeKey(slug), deploymentId);
  return json({ slug, deploymentId });
}
