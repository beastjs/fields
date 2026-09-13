import { expect, test } from 'bun:test';
import { fileRecommendation } from '../src/chat/recommendation';
import { ChatController } from '../src/chat/controller';
import { defaultSettings } from '../src/chat/contracts';

const context = { file: '/src/App.btsx', source: 'h1 Before\n' };
const block = (file = context.file, source = 'h1 After\n') => '```btsx file=' + file + '\n' + source + '```';
test('only one explicit complete replacement for the attached file is actionable', () => {
  expect(fileRecommendation('Recommended:\n' + block(), context)).toEqual({ file: context.file, source: 'h1 After\n' });
  expect(fileRecommendation('```btsx\nh1 Snippet\n```', context)).toBeUndefined();
  expect(fileRecommendation(block('/src/Other.btsx'), context)).toMatchObject({ file: '/src/Other.btsx', error: expect.stringContaining('attached file is /src/App.btsx') });
  expect(fileRecommendation(block() + '\n' + block(), context)?.error).toContain('more than one change block');
  expect(fileRecommendation(block(context.file, context.source), context)?.error).toContain('already in the file');
  expect(fileRecommendation(block())?.error).toContain('No file was attached');
});

test('a block that renders as a change never fails silently', () => {
  for (const path of ['src/App.btsx', './src/App.btsx']) {
    expect(fileRecommendation('```btsx file=' + path + '\nh1 After\n```', context)).toEqual({ file: context.file, source: 'h1 After\n' });
  }
  expect(fileRecommendation('```tsx2 file=/src/App.btsx\nh1 After\n```', context)).toEqual({ file: context.file, source: 'h1 After\n' });
});
const patched = { file: '/src/App.btsx', source: 'h1 Before\nh2 Keep\np Tail\n' };
const patch = (body: string, file = patched.file) => '```btsx patch=' + file + '\n' + body + '```';
const hunk = (search: string, replace: string) => '<<<<<<< SEARCH\n' + search + '=======\n' + replace + '>>>>>>> REPLACE\n';

test('patch hunks replace, insert and delete without a full rewrite', () => {
  expect(fileRecommendation(patch(hunk('h2 Keep\n', 'h2 Changed\n')), patched))
    .toEqual({ file: patched.file, source: 'h1 Before\nh2 Changed\np Tail\n', hunks: 1 });
  expect(fileRecommendation(patch(hunk('h2 Keep\n', 'h2 Keep\nspan Added\n')), patched))
    .toEqual({ file: patched.file, source: 'h1 Before\nh2 Keep\nspan Added\np Tail\n', hunks: 1 });
  expect(fileRecommendation(patch(hunk('h2 Keep\n', '')), patched))
    .toEqual({ file: patched.file, source: 'h1 Before\np Tail\n', hunks: 1 });
  expect(fileRecommendation(patch(hunk('h1 Before\n', 'h1 One\n') + hunk('p Tail\n', 'p End\n')), patched))
    .toEqual({ file: patched.file, source: 'h1 One\nh2 Keep\np End\n', hunks: 2 });
});

test('patch hunks tolerate safe line-ending differences without guessing a location', () => {
  const noFinalNewline = { file: patched.file, source: 'h1 Before\nh2 Keep' };
  expect(fileRecommendation(patch(hunk('h2 Keep\n', 'h2 Changed\n')), noFinalNewline))
    .toEqual({ file: patched.file, source: 'h1 Before\nh2 Changed\n', hunks: 1 });

  const trailingSpaces = { file: patched.file, source: 'h1 Before  \nh2 Keep\t\np Tail\n' };
  expect(fileRecommendation(patch(hunk('h1 Before\nh2 Keep\n', 'h1 After\nh2 Changed\n')), trailingSpaces))
    .toEqual({ file: patched.file, source: 'h1 After\nh2 Changed\np Tail\n', hunks: 1 });

  const windowsSource = { file: patched.file, source: 'h1 Before\r\nh2 Keep\r\n' };
  expect(fileRecommendation(patch(hunk('h2 Keep\n', 'h2 Changed\n')), windowsSource))
    .toEqual({ file: patched.file, source: 'h1 Before\nh2 Changed\n', hunks: 1 });
});

test('line-aware matching still rejects whitespace-normalized ambiguity', () => {
  const ambiguous = { file: patched.file, source: 'p Same  \np Same\t\n' };
  expect(fileRecommendation(patch(hunk('p Same\n', 'p Other\n')), ambiguous)?.error).toContain('more than once');
});

test('unmatched, ambiguous and empty hunks report an error instead of applying', () => {
  const twice = { file: patched.file, source: 'p Same\np Same\n' };
  expect(fileRecommendation(patch(hunk('h2 Missing\n', 'h2 New\n')), patched)?.error).toContain('does not match');
  expect(fileRecommendation(patch(hunk('p Same\n', 'p Other\n')), twice)?.error).toContain('more than once');
  expect(fileRecommendation(patch(hunk('', 'p New\n')), patched)?.error).toContain('empty SEARCH');
  expect(fileRecommendation(patch('no hunks here\n'), patched)?.error).toContain('no SEARCH/REPLACE');
  expect(fileRecommendation(patch(hunk('h2 Keep\n', 'h2 X\n'), '/src/Other.btsx'), patched)?.error).toContain('targets /src/Other.btsx');
  expect(fileRecommendation(patch(hunk('h2 Keep\n', 'h2 Keep\n')), patched)?.error).toContain('already in the file');
  expect(fileRecommendation(block() + '\n' + patch(hunk('h2 Keep\n', 'h2 X\n')), patched)?.error).toContain('more than one change block');
  expect(fileRecommendation('```btsx\n' + hunk('h2 Keep\n', 'h2 X\n') + '```')?.error).toContain('No file was attached');
});

test('fence variants are actionable and truncated blocks say so', () => {
  const source = 'h1 After\n';
  for (const fence of ['```btsx file=' + context.file, '``` file=' + context.file, '```ts file="' + context.file + '"', '````btsx file=' + context.file]) {
    expect(fileRecommendation(fence + '\n' + source + '```', context)).toMatchObject({ file: context.file, source });
  }
  expect(fileRecommendation('```btsx file=' + context.file + '\n' + source, context)?.error).toContain('cut off');
  expect(fileRecommendation('```btsx patch=' + context.file + '\n' + hunk('h1 Before\n', 'h1 X\n'), context)?.error).toContain('cut off');
  expect(fileRecommendation('```btsx\n' + source + '```', context)).toBeUndefined();
});

test('a fence opened mid-sentence still parses, with or without hunks', () => {
  const inline = 'Set the colour.```btsx patch=' + patched.file + '\n' + hunk('h2 Keep\n', 'h2 Tomato\n') + '```';
  expect(fileRecommendation(inline, patched)).toEqual({ file: patched.file, source: 'h1 Before\nh2 Tomato\np Tail\n', hunks: 1 });
  expect(fileRecommendation('Applying a style.```btsx patch=' + patched.file + '\n  h2 Keep\n\n```', patched)?.error).toContain('no SEARCH/REPLACE hunks');
});

test('hunks apply even when the model omits the patch= marker', () => {
  expect(fileRecommendation('```btsx\n' + hunk('h2 Keep\n', 'h2 Tomato\n') + '```', patched))
    .toEqual({ file: patched.file, source: 'h1 Before\nh2 Tomato\np Tail\n', hunks: 1 });
  expect(fileRecommendation('```btsx title\n' + hunk('h2 Keep\n', 'h2 Tomato\n') + '```', patched)?.source).toBe('h1 Before\nh2 Tomato\np Tail\n');
});

test('several hunk blocks for the attached file apply in order, like one patch', () => {
  const expected = { file: patched.file, source: 'h1 Before\nh2 A\np B\n', hunks: 2 };
  expect(fileRecommendation('```btsx\n' + hunk('h2 Keep\n', 'h2 A\n') + '```\n```btsx\n' + hunk('p Tail\n', 'p B\n') + '```', patched)).toEqual(expected);
  expect(fileRecommendation(patch(hunk('h2 Keep\n', 'h2 A\n')) + '\nThen:\n' + patch(hunk('p Tail\n', 'p B\n')), patched)).toEqual(expected);
  expect(fileRecommendation('```btsx\n<<<<<<< SEARCH\nh2 Keep\n', patched)?.error).toContain('cut off');
});

test('completed replies and retries retain original file and project identity', async () => {
  const chat = new ChatController(defaultSettings, () => {}, async () => new Response(
    `data: ${JSON.stringify({ choices: [{ delta: { content: block() } }] })}\n\ndata: [DONE]\n\n`, { headers: { 'Content-Type': 'text/event-stream' } }));
  await chat.submit('Improve', context, 7);
  expect(chat.getSnapshot().messages.at(-1)).toMatchObject({ state: 'complete', context, projectGeneration: 7 });
  await chat.retry();
  expect(chat.getSnapshot().messages.at(-1)).toMatchObject({ state: 'complete', context, projectGeneration: 7 });
  chat.dispose();
});
