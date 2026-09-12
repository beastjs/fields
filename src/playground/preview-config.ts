/** Deployment configuration only: never accept a destination from shared projects or query parameters. */
export function validatePreviewURL(value: string | undefined): string | undefined {
  if (!value?.trim()) return undefined;
  let url: URL;
  try { url = new URL(value); } catch { throw new Error('PLAYGROUND_PREVIEW_URL must be an absolute HTTPS URL.'); }
  const loopback = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  if ((url.protocol !== 'https:' && !(loopback && url.protocol === 'http:')) ||
    url.username || url.password || url.search || url.hash) {
    throw new Error('PLAYGROUND_PREVIEW_URL requires HTTPS (HTTP is allowed on loopback), without credentials, query, or fragment.');
  }
  return url.href;
}
