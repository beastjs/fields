import { expect, test } from 'bun:test';
import { diffBlock } from '../src/chat/diff';

const source = 'div\n  h1 Title\n  h2 Ideas\n  p Body\n  footer Done\n';
const hunk = (search: string, replace: string) => '<<<<<<< SEARCH\n' + search + '=======\n' + replace + '>>>>>>> REPLACE\n';
const rows = (html?: string) => [...(html ?? '').matchAll(/<span class="diff-row diff-(\w+)"><span class="diff-num">(\d*)<\/span><span class="diff-text">([^<]*)</g)]
  .map(([, kind, number, text]) => `${kind} ${number || '-'} ${text}`);

test('rows are numbered against the attached file', () => {
  expect(rows(diffBlock(hunk('  h2 Ideas\n', '  h2 Tomato\n'), source)))
    .toEqual(['del 3 -   h2 Ideas', 'add 3 +   h2 Tomato']);
});

test('later hunks account for lines the earlier ones added or removed', () => {
  const two = hunk('  h1 Title\n', '  h1 One\n  h1 Two\n') + hunk('  p Body\n', '');
  expect(rows(diffBlock(two, source))).toEqual([
    'del 2 - ' + '  h1 Title', 'add 2 + ' + '  h1 One', 'add 3 + ' + '  h1 Two',
    'gap - ⋯',
    'del 4 - ' + '  p Body',
  ]);
});

test('duplicate text is numbered by position, not by first match', () => {
  const repeated = 'p Same\np Same\n';
  expect(rows(diffBlock(hunk('p Same\n', 'p A\n') + hunk('p Same\n', 'p B\n'), repeated)))
    .toEqual(['del 1 - p Same', 'add 1 + p A', 'gap - ⋯', 'del 2 - p Same', 'add 2 + p B']);
});

test('unmatched hunks and missing context render without numbers', () => {
  expect(rows(diffBlock(hunk('  h9 Gone\n', '  h9 New\n'), source))).toEqual(['del - - ' + '  h9 Gone', 'add - + ' + '  h9 New']);
  expect(rows(diffBlock(hunk('  h2 Ideas\n', '  h2 Tomato\n')))).toEqual(['del - - ' + '  h2 Ideas', 'add - + ' + '  h2 Tomato']);
});

test('blocks without hunks are left to the normal code renderer', () => {
  expect(diffBlock('const a = 1;\n', source)).toBeUndefined();
});

test('hunk text is escaped', () => {
  expect(diffBlock(hunk('  h2 Ideas\n', '  h2(title="<b>&</b>") Ideas\n'), source)).toContain('&lt;b&gt;&amp;&lt;/b&gt;');
});
