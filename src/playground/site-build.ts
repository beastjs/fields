import { moduleId, type CompilationResult } from './contracts';
import { BASE_DOCUMENT_STYLE } from './preview-bootstrap';

/** One file of a published site, at its absolute URL path. */
export interface SiteFile { path: string; content: string; contentType: string }
export interface SiteBuild { files: SiteFile[]; bytes: number }
export interface SiteOptions {
  title: string;
  /** `system` follows the visitor's color scheme; the others pin the one the project was designed in. */
  theme?: 'light' | 'dark' | 'system';
  /** The studio theme the preview paints with (`installedThemeCss`), so the published page matches it. */
  tokensCss?: string;
}

/** Compiled modules live under one reserved prefix, so every other path is free for client-side routes. */
export const SITE_MODULE_PREFIX = '/_m';
const MODULE_ID_PREFIX = moduleId('');

/** cyrb53: a fast, synchronous 53-bit string hash. Cache-busting only, not integrity. */
function contentHash(text: string): string {
  let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    h1 = Math.imul(h1 ^ code, 2654435761);
    h2 = Math.imul(h2 ^ code, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
}

/**
 * Where a module is served. The content hash makes each URL immutable, so hosts can cache modules forever and only
 * revalidate `index.html`; an unchanged module (the runtime, usually) keeps its URL across publishes. Every module
 * id carries a source extension, so appending `.js` never lets two ids meet (`/a.ts` → `a.ts.js`, `/a.ts.js` →
 * `a.ts.js.js`).
 */
export function sitePathForModule(id: string, code: string): string {
  if (!id.startsWith(MODULE_ID_PREFIX + '/')) throw new Error(`Not a playground module: ${id}`);
  return `${SITE_MODULE_PREFIX}/${contentHash(code)}${id.slice(MODULE_ID_PREFIX.length)}.js`;
}

/** Stored paths are decoded; URLs in the page are encoded one segment at a time (`@` is legal in a path). */
const toURL = (path: string) => path.split('/').map(segment => encodeURIComponent(segment).replaceAll('%40', '@')).join('/');

const escapeHTML = (text: string) =>
  text.replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]!);

/** Anything that closes the enclosing element must not appear raw inside inline script or style. */
const inline = (text: string, tag: 'script' | 'style') => text.replace(new RegExp(`</(${tag})`, 'gi'), '<\\/$1');

/** Turns a `site` compile into the static files a host serves as-is. */
export function buildSite(result: CompilationResult, options: SiteOptions): SiteBuild {
  const errors = result.diagnostics.filter(d => d.severity === 'error');
  if (errors.length || !result.entry) {
    throw new Error(errors.length ? `The project has ${errors.length} compile error${errors.length === 1 ? '' : 's'}.` : 'The project has no entry module.');
  }
  if (result.modules.some(module => module.sourceMap !== undefined || module.hot !== undefined)) {
    throw new Error('Publish a site build: compile with the `site` target.');
  }
  const files: SiteFile[] = [];
  const imports: Record<string, string> = {};
  for (const module of result.modules) {
    const path = sitePathForModule(module.id, module.code);
    imports[module.id] = toURL(path);
    files.push({ path, content: module.code, contentType: 'text/javascript; charset=utf-8' });
  }
  const theme = options.theme ?? 'system';
  const head = [
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width,initial-scale=1">',
    `<meta name="color-scheme" content="${theme === 'system' ? 'light dark' : theme}">`,
    `<title>${escapeHTML(options.title)}</title>`,
    // Set before first paint; `data-theme` is what project styles and Tailwind's `dark:` variant key on.
    theme === 'system' ? `<script>document.documentElement.dataset.theme=matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'</script>` : '',
    `<style>${BASE_DOCUMENT_STYLE}</style>`,
    options.tokensCss ? `<style data-studio-tokens>${inline(options.tokensCss, 'style')}</style>` : '',
    `<script type="importmap">${inline(JSON.stringify({ imports }), 'script')}</script>`,
    `<script type="module">import ${inline(JSON.stringify(result.entry), 'script')};</script>`,
  ].join('');
  const html = `<!doctype html><html${theme === 'system' ? '' : ` data-theme="${theme}"`}><head>${head}</head><body><div id="app"></div></body></html>`;
  files.unshift({ path: '/index.html', content: html, contentType: 'text/html; charset=utf-8' });
  const encoder = new TextEncoder();
  return { files, bytes: files.reduce((total, file) => total + encoder.encode(file.content).byteLength, 0) };
}
