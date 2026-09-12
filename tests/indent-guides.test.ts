import { expect, test } from 'bun:test';
import { EditorState } from '@codemirror/state';
import { activeIndentGuide } from '../src/playground/indent-guides';

const doc = ['main.page', '  div.card', '    h1 Hi', '', '    p Body', '  footer Done', 'aside'].join('\n');
const at = (line: number) => {
  const state = EditorState.create({ doc });
  return activeIndentGuide(EditorState.create({ doc, selection: { anchor: state.doc.line(line).from } }));
};

test('a line that opens a block highlights its children guide', () => {
  expect(at(1)).toEqual({ column: 0, from: 2, to: 6 });
  expect(at(2)).toEqual({ column: 2, from: 3, to: 5 });
});

test('a leaf line highlights the guide of the block it belongs to, through blank lines', () => {
  expect(at(3)).toEqual({ column: 2, from: 3, to: 5 });
  expect(at(4)).toEqual({ column: 2, from: 3, to: 5 });
  expect(at(6)).toEqual({ column: 0, from: 2, to: 6 });
});

test('top-level leaf lines have no active guide', () => {
  expect(at(7)).toBeUndefined();
});
