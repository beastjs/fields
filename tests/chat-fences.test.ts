import { expect, test } from 'bun:test';
import { marked } from 'marked';
import { normalizeFences } from '../src/chat/fences';
import { fileRecommendation } from '../src/chat/recommendation';

const F = '```';
const render = (source: string) => marked.parse(normalizeFences(source), { async: false, gfm: true, breaks: true });
const hunk = '<<<<<<< SEARCH\n  h2 Ideas\n=======\n  h2 New\n>>>>>>> REPLACE';

test('an opening fence glued to prose moves onto its own line', () => {
  const reply = `Here is the fix: ${F}btsx patch=/src/App.btsx\n${hunk}\n${F}\nDone.`;
  expect(normalizeFences(reply)).toBe(`Here is the fix:\n${F}btsx patch=/src/App.btsx\n${hunk}\n${F}\nDone.`);
  expect(render(reply)).not.toContain('<blockquote>');
  expect(render(reply)).toContain('<p>Done.</p>');
  expect(fileRecommendation(reply, { file: '/src/App.btsx', source: '  h2 Ideas\n' })?.source).toBe('  h2 New\n');
});

test('text after a closing fence is not swallowed into the block', () => {
  expect(normalizeFences(`Fix:\n${F}btsx\nh1 Hi\n${F}That's it.`)).toBe(`Fix:\n${F}btsx\nh1 Hi\n${F}\nThat's it.`);
  expect(render(`${F}btsx\nh1 Hi\n${F}Done.`)).toContain('<p>Done.</p>');
});

test('a closing fence glued to the last code line is split off', () => {
  expect(normalizeFences(`${F}btsx\nh1 Hi${F}\nafter`)).toBe(`${F}btsx\nh1 Hi\n${F}\nafter`);
  expect(fileRecommendation(`${F}btsx file=/src/App.btsx\nh1 New${F}`, { file: '/src/App.btsx', source: 'h1 Old' })?.source).toBe('h1 New\n');
});

test('well-formed markdown is left unchanged', () => {
  for (const source of [
    `Text\n${F}ts\nconst a = 1\n${F}\nafter`,
    `1. Step\n   ${F}btsx\n   h1 Hi\n   ${F}\n2. Two`,
    `${F}\`md\n${F}js\nx\n${F}\n${F}\``,
    `~~~btsx\nh1 Hi\n~~~`,
    `Use ${F}inline${F} here`,
    `${F}btsx file=/src/App.btsx\np Use ${F}code${F} here\n${F}`,
    `Partial:\n${F}btsx patch=/src/App.btsx\n<<<<<<< SEARCH`,
  ]) expect(normalizeFences(source)).toBe(source);
});
