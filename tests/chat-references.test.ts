import { expect, test } from 'bun:test';
import { MAX_REFERENCE_CHARS, MAX_REFERENCES } from '../src/chat/contracts';
import { selectChatReferences, type RankReferences, type ReferenceSelection } from '../src/chat/references';
import { runJev } from '../src/jev/browser';
import { rankReferences, type RankedFile } from '../src/jev/chat';
import { forgetJevStatus } from '../src/jev/status';

const input: ReferenceSelection = {
  prompt: 'Use the theme colors in this component',
  activeFile: '/App.btsx', includeActive: true, picked: ['/notes.ts'], excluded: ['/excluded.ts'],
  project: { entry: '/App.btsx', files: {
    '/App.btsx': "import Button from './Button.btsx'\nButton\n",
    '/Button.btsx': 'button Click',
    '/theme.css': ':root { --brand: tomato; }',
    '/notes.ts': 'export const notes = 1;',
    '/excluded.ts': 'export const excluded = true;',
  } },
};
const ranked = (...paths: string[]): RankedFile[] => paths.map(path => ({ path, score: 1.9, confidence: 0.9, band: 'act' }));
const select = (options: ReferenceSelection, rank: RankReferences) => selectChatReferences(options, new AbortController().signal, rank);

test('Jev adds an unlinked file before imports while keeping manual choices and exclusions', async () => {
  let calls = 0;
  const result = await select(input, async request => {
    calls++;
    expect(request.prompt).toBe(input.prompt);
    expect(request.candidates).toEqual([
      { path: '/Button.btsx', outline: 'button Click' },
      { path: '/theme.css', outline: ':root { --brand: tomato; }' },
    ]);
    return ranked('/theme.css', '/excluded.ts', '/App.btsx', '/missing.ts', '/theme.css');
  });
  expect(calls).toBe(1);
  expect(result.references.map(file => file.file)).toEqual(['/notes.ts', '/theme.css', '/Button.btsx']);
  expect(result.references[1].source).toBe(input.project.files['/theme.css']);
});

test('an unchecked active file stays out of automatic references, but can be picked explicitly', async () => {
  const result = await select({ ...input, includeActive: false }, async request => {
    expect(request.candidates.some(file => file.path === input.activeFile)).toBe(false);
    return ranked('/App.btsx', '/theme.css');
  });
  expect(result.references.map(file => file.file)).toEqual(['/notes.ts', '/theme.css']);
  const explicit = await select({ ...input, includeActive: false, picked: ['/App.btsx'] }, async () => []);
  expect(explicit.references.map(file => file.file)).toEqual(['/App.btsx']);
});

test('the final attachment budget keeps scanning lower-ranked files when a higher one cannot fit', async () => {
  const files = { '/big.ts': 'x'.repeat(35000), '/medium.ts': 'x'.repeat(30000), '/small.ts': 'x'.repeat(20000),
    ...Object.fromEntries(Array.from({ length: 12 }, (_, index) => [`/tiny${index}.ts`, 'x'])) };
  const result = await select({ ...input, project: { entry: '/big.ts', files }, includeActive: false, picked: [], excluded: [] },
    async () => ranked(...Object.keys(files)));
  expect(result.references.map(file => file.file)).toEqual(['/big.ts', '/small.ts', ...Array.from({ length: 6 }, (_, i) => `/tiny${i}.ts`)]);
  expect(result.references).toHaveLength(MAX_REFERENCES);
  expect(result.references.reduce((sum, file) => sum + file.source.length, 0)).toBeLessThanOrEqual(MAX_REFERENCE_CHARS);
  expect(result.skipped).toContain('/medium.ts');
});

test('unavailable Jev and no matches retain picked and import-related files', async () => {
  for (const rank of [async () => { throw new Error('Unavailable'); }, async () => []]) {
    const result = await select(input, rank);
    expect(result.references.map(file => file.file)).toEqual(['/notes.ts', '/Button.btsx']);
  }
});

test('empty candidate sets and exhausted manual budgets do not call Jev', async () => {
  const unexpected: RankReferences = async () => { throw new Error('Should not be called'); };
  let calls = 0;
  const rank: RankReferences = async (...args) => { calls++; return unexpected(...args); };
  const single = { ...input, picked: [], project: { entry: '/App.btsx', files: { '/App.btsx': 'h1 Hello' } } };
  expect((await select(single, rank)).references).toEqual([]);
  const full = { ...input, project: { ...input.project, files: { ...input.project.files, '/notes.ts': 'x'.repeat(60001) } } };
  expect((await select(full, rank)).references[0].source.length).toBe(60001);
  expect(calls).toBe(0);
});

test('candidate excerpts stay bounded and final attachments retain their full source', async () => {
  const files = Object.fromEntries(Array.from({ length: 200 }, (_, index) => [`/f${index}.ts`, 'x'.repeat(10000)]));
  const result = await select({ ...input, project: { entry: '/f0.ts', files }, picked: [] }, async request => {
    expect(request.candidates).toHaveLength(200);
    expect(request.candidates.reduce((sum, file) => sum + file.outline!.length, 0)).toBeLessThanOrEqual(48000);
    return ranked('/f199.ts');
  });
  expect(result.references[0].source).toBe(files['/f199.ts']);
});

test('cancellation rejects without falling back, even when a ranker ignores the signal', async () => {
  const abort = new AbortController();
  let resolve!: (value: RankedFile[]) => void;
  let signal!: AbortSignal;
  const pending = selectChatReferences(input, abort.signal, (_request, supplied) => {
    signal = supplied;
    return new Promise(done => { resolve = done; });
  });
  abort.abort();
  await expect(pending).rejects.toHaveProperty('name', 'AbortError');
  expect(signal.aborted).toBe(true);
  resolve(ranked('/theme.css'));
});

test('the selection deadline falls back and aborts a stalled evaluation', async () => {
  let signal!: AbortSignal;
  const result = await select(input, (_request, supplied) => {
    signal = supplied;
    return new Promise(() => {});
  });
  expect(signal.aborted).toBe(true);
  expect(result.references.map(file => file.file)).toEqual(['/notes.ts', '/Button.btsx']);
}, 7000);

test('cancelling a browser Jev workflow aborts its evaluation fetch', async () => {
  forgetJevStatus();
  const abort = new AbortController();
  let upstream!: AbortSignal;
  let started!: () => void;
  const ready = new Promise<void>(resolve => { started = resolve; });
  const pending = runJev(rankReferences({ prompt: 'theme', candidates: [{ path: '/theme.css' }] }), async (url, init) => {
    if (String(url).endsWith('/status')) return Response.json({ configured: true });
    upstream = init!.signal!;
    started();
    return new Promise((_resolve, reject) => upstream.addEventListener('abort', () => reject(upstream.reason), { once: true }));
  }, abort.signal);
  await ready;
  abort.abort();
  await expect(pending).rejects.toBeDefined();
  expect(upstream.aborted).toBe(true);
  forgetJevStatus();
});
