import { expect, test } from 'bun:test';
import { createProjectShareURL, decodeSharedProject, encodeSharedProject, MAX_SHARE_BYTES,
  MAX_SHARE_LENGTH, projectPayloadFromHash } from '../src/playground/project-sharing';
import type { SavedWorkspace } from '../src/playground/project-storage';

const workspace = (): SavedWorkspace => ({ version: 1, project: { entry: '/src/main.ts', files: {
  '/src/main.ts': 'import "./App.btsx";', '/src/App.btsx': 'h1 Shared 🌱 世界\n',
} }, activeFile: '/src/main.ts', preview: { width: '375px' } });

async function rawPayload(raw: string) {
  const compressed = await new Response(new Blob([raw]).stream().pipeThrough(new CompressionStream('gzip'))).arrayBuffer();
  return 'v1.' + Buffer.from(compressed).toString('base64url');
}

test('share links round-trip Unicode files and settings and exclude unrelated state', async () => {
  const input = { ...workspace(), apiKey: 'secret', console: ['secret'], chat: 'secret' };
  const url = new URL(await createProjectShareURL(input, 'https://user:pass@example.com/play?key=secret&dock=0,70,30#old'));
  expect(url.pathname).toBe('/play'); expect(url.search).toBe(''); expect(url.username).toBe('');
  const payload = projectPayloadFromHash(url.hash)!;
  expect(await decodeSharedProject(payload)).toEqual(workspace());
  expect(JSON.stringify(await decodeSharedProject(payload))).not.toContain('secret');
  expect(projectPayloadFromHash('#unrelated')).toBeUndefined();
});

test('sharing rejects broken encodings, unsupported versions, invalid projects and oversized links', async () => {
  for (const payload of ['v9.abc', 'v1.', 'v1.%%%', 'v1.a', 'v1.aGVsbG8', 'v1.' + 'a'.repeat(MAX_SHARE_LENGTH),
    await rawPayload('{broken'), await rawPayload(JSON.stringify({ ...workspace(), version: 99 })),
    await rawPayload(JSON.stringify({ ...workspace(), project: { entry: '/missing.ts', files: { '/a.ts': '' } } })),
    await rawPayload(JSON.stringify({ ...workspace(), project: { entry: '/a.ts', files: { '/a.ts': '', '../../escape.ts': '' } } }))]) {
    await expect(decodeSharedProject(payload)).rejects.toThrow();
  }
});

test('decompression stops at the decoded limit even for a tiny compressed payload', async () => {
  const payload = await rawPayload(' '.repeat(MAX_SHARE_BYTES + 1));
  expect(payload.length).toBeLessThan(5000);
  await expect(decodeSharedProject(payload)).rejects.toThrow('project limits');
});

test('share creation reports size limits without changing the source', async () => {
  const input = workspace();
  input.project.files['/src/App.btsx'] = '🌱'.repeat(MAX_SHARE_BYTES / 3);
  await expect(encodeSharedProject(input)).rejects.toThrow('too large');
  expect(input.project.files['/src/App.btsx'].length).toBeGreaterThan(1_000_000);
  input.project.files['/src/App.btsx'] = Array.from({ length: 6000 }, (_, i) => `${i}:${crypto.randomUUID()}`).join('\n');
  await expect(encodeSharedProject(input)).rejects.toThrow('too large');
});
