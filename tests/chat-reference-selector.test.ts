import { expect, test } from 'bun:test';
import { ReferenceSelector } from '../src/chat/reference-selector';
import type { ReferenceSelection } from '../src/chat/references';

const input: ReferenceSelection = { prompt: 'Change the top bar', project: { entry: '/Page.btsx', files: {
  '/Page.btsx': 'h1 Page', '/Topbar.btsx': 'header Notice', '/Hero.btsx': 'h1 Hero',
} }, activeFile: '/Page.btsx', includeActive: true, picked: [], excluded: [] };
const result = { references: [{ file: '/Topbar.btsx', source: 'header Notice' }], skipped: [] };

test('automatic preview and submit share the same pending selection and sources', async () => {
  let calls = 0;
  const selector = new ReferenceSelector(async () => { calls++; return result; }, 1);
  selector.update(input);
  await new Promise(resolve => setTimeout(resolve, 10));
  expect(selector.getSnapshot().result).toEqual(result);
  expect(selector.getSnapshot().pending).toBe(false);
  expect(await selector.resolve({ ...input, picked: [], excluded: [] }, new AbortController().signal)).toEqual(result);
  expect(calls).toBe(1);
  selector.dispose();
});
test('changed prompts cannot be overwritten by late selection results', async () => {
  let resolveOld!: (value: typeof result) => void;
  const selector = new ReferenceSelector(async request => request.prompt === input.prompt
    ? new Promise(resolve => { resolveOld = resolve; }) : { references: [], skipped: [] }, 1);
  selector.update(input);
  await new Promise(resolve => setTimeout(resolve, 10));
  selector.update({ ...input, prompt: 'Explain nothing' });
  await new Promise(resolve => setTimeout(resolve, 10));
  resolveOld(result);
  await new Promise(resolve => setTimeout(resolve, 0));
  expect(selector.getSnapshot().result.references).toEqual([]);
  selector.dispose();
});
