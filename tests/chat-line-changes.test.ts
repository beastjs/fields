import { expect, test } from 'bun:test';
import { lineChanges, sourceChanges } from '../src/chat/line-changes';
import { diffBlock } from '../src/chat/diff';
import { fileRecommendation } from '../src/chat/recommendation';

test('separated edits preserve unchanged islands and original editor offsets', () => {
  const before = 'header\nold\nkeep\nold2\nfooter\n';
  const after = 'header\nnew\nkeep\nnew2\nfooter\n';
  expect(sourceChanges(before, after)).toEqual([{ from: 7, to: 11, insert: 'new\n' }, { from: 16, to: 21, insert: 'new2\n' }]);
  expect(lineChanges(before, after).filter(line => line.kind === 'same').map(line => line.text)).toEqual(['header\n', 'keep\n', 'footer\n']);
});

test('context lines are neutral in the rendered diff', () => {
  const html = diffBlock('<<<<<<< SEARCH\nheader\nold\nfooter\n=======\nheader\nnew\nfooter\n>>>>>>> REPLACE\n', 'header\nold\nfooter\n')!;
  expect(html.match(/diff-del/g)).toHaveLength(1);
  expect(html.match(/diff-add/g)).toHaveLength(1);
  expect(html.match(/diff-same/g)).toHaveLength(2);
});

test('patches preserve unchanged context whitespace and CRLF outside the changed line', () => {
  const source = 'header  \r\nold\r\nfooter\t\r\n';
  const patch = '```btsx patch=/src/App.btsx\n<<<<<<< SEARCH\nheader\nold\nfooter\n=======\nheader\nnew\nfooter\n>>>>>>> REPLACE\n```';
  expect(fileRecommendation(patch, { file: '/src/App.btsx', source })?.source).toBe('header  \r\nnew\r\nfooter\t\r\n');
});

test('line edits reconstruct insertions, deletions, repeated lines, EOF and large files', () => {
  const cases = [['', 'a'], ['a', ''], ['a\nb\na\n', 'a\na\n'], ['x', 'x\n'], ['x\n', 'x'], ['x\r\ny\r\n', 'x\r\nz\r\n'],
    [Array.from({ length: 1600 }, (_, i) => `line ${i}\n`).join(''), Array.from({ length: 1600 }, (_, i) => `${i % 500 === 0 ? 'change' : 'line'} ${i}\n`).join('')]];
  for (const [before, after] of cases) {
    let actual = before;
    for (const change of sourceChanges(before, after).reverse()) actual = actual.slice(0, change.from) + change.insert + actual.slice(change.to);
    expect(actual).toBe(after);
  }
});

test('inserting after an EOF anchor supplies a newline without gluing the new line', () => {
  const patch = '```btsx patch=/src/App.btsx\n<<<<<<< SEARCH\nh1 Before\n=======\nh1 Before\np Added\n>>>>>>> REPLACE\n```';
  expect(fileRecommendation(patch, { file: '/src/App.btsx', source: 'h1 Before' })?.source).toBe('h1 Before\np Added\n');
});

test('distant edits in a large repetitive file preserve the middle lines', () => {
  const middle = 'unchanged\n'.repeat(2000);
  const changes = sourceChanges('old\n' + middle + 'old\n', 'new\n' + middle + 'new\n');
  expect(changes).toHaveLength(2);
  expect(changes.reduce((sum, change) => sum + change.to - change.from, 0)).toBe(8);
});
