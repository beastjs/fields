import { decodeWorkspace, encodeWorkspace, type SavedWorkspace } from './project-storage';

/** Versioned, compressed authored state. Transport is independent of the UI/storage. */
export const MAX_SHARE_LENGTH = 64_000;
export const MAX_SHARE_BYTES = 2_000_000;
const PREFIX = 'v1.';

function base64url(bytes: Uint8Array): string {
  let binary = '';
  for (let index = 0; index < bytes.length; index += 8192) {
    binary += String.fromCharCode(...bytes.subarray(index, index + 8192));
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function readBounded(stream: ReadableStream<Uint8Array>, limit: number): Promise<Uint8Array> {
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.length;
      if (length > limit) throw new Error('This project is too large for a share link.');
      chunks.push(value);
    }
  } catch (error) {
    await reader.cancel().catch(() => {});
    throw error;
  } finally { reader.releaseLock(); }
  const result = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) { result.set(chunk, offset); offset += chunk.length; }
  return result;
}

export async function encodeSharedProject(workspace: SavedWorkspace): Promise<string> {
  const bytes = new TextEncoder().encode(encodeWorkspace(workspace));
  if (bytes.length > MAX_SHARE_BYTES) throw new Error('This project is too large for a share link.');
  const stream = new Blob([bytes]).stream().pipeThrough(new CompressionStream('gzip'));
  const payload = PREFIX + base64url(await readBounded(stream, MAX_SHARE_LENGTH));
  if (payload.length > MAX_SHARE_LENGTH) throw new Error('This project is too large for a share link.');
  return payload;
}

export async function decodeSharedProject(payload: string): Promise<SavedWorkspace> {
  if (payload.length > MAX_SHARE_LENGTH) throw new Error('This share link is too large.');
  if (!payload.startsWith(PREFIX)) throw new Error('This share link uses an unsupported version.');
  const encoded = payload.slice(PREFIX.length);
  if (!/^[A-Za-z0-9_-]+$/.test(encoded)) throw new Error('This share link is invalid or incomplete.');
  try {
    const bytes = Uint8Array.from(atob(encoded.replace(/-/g, '+').replace(/_/g, '/')), char => char.charCodeAt(0));
    if (base64url(bytes) !== encoded) throw new Error('Invalid encoding.');
    const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
    const raw = new TextDecoder('utf-8', { fatal: true }).decode(await readBounded(stream, MAX_SHARE_BYTES));
    return decodeWorkspace(raw);
  } catch {
    throw new Error('This share link is invalid, incomplete, or exceeds the project limits.');
  }
}

export async function createProjectShareURL(workspace: SavedWorkspace, base: string): Promise<string> {
  const url = new URL(base);
  url.username = ''; url.password = ''; url.search = '';
  url.hash = 'project=' + await encodeSharedProject(workspace);
  return url.href;
}

export function projectPayloadFromHash(hash: string): string | undefined {
  return hash.startsWith('#project=') ? hash.slice('#project='.length) : undefined;
}
