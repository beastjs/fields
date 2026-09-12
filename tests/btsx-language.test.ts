import { expect, test } from 'bun:test';
import { StringStream } from '@codemirror/language';
import { btsxParser } from '../src/playground/btsx-language';

/** Tokenizes a document and returns [text, token] pairs, skipping untokenized text. */
function tokens(source: string) {
  const state = btsxParser.startState!(2);
  const out: [string, string][] = [];
  for (const line of source.split('\n')) {
    const stream = new StringStream(line, 2, 2);
    while (!stream.eol()) {
      const style = btsxParser.token(stream, state);
      if (stream.pos === stream.start) throw new Error(`No progress on: ${line}`);
      if (style) out.push([line.slice(stream.start, stream.pos), style]);
      stream.start = stream.pos;
    }
  }
  return out;
}
const styleOf = (source: string, text: string) => tokens(source).filter(([value]) => value === text).map(([, style]) => style);

test('template text stays plain while elements, selectors, and interpolations are highlighted', () => {
  const source = 'h1.title#main Hello, World #{count} &rarr;';
  expect(tokens(source)).toEqual([
    ['h1', 'tagName'], ['.title', 'className'], ['#main', 'className'],
    ['#{', 'punctuation.special'], ['count', 'variableName'], ['}', 'punctuation.special'], ['&rarr;', 'character'],
  ]);
});

test('attributes, continuation lines, and nested expressions', () => {
  const source = ['A.Root(', '  ~ data-slot="accordion"', '  ~ style={{ color: fn(1) }}', '  ~ ) Done'].join('\n');
  expect(styleOf(source, 'A.Root')).toEqual(['typeName']);
  expect(styleOf(source, 'data-slot')).toEqual(['attributeName']);
  expect(styleOf(source, '"accordion"')).toEqual(['string']);
  expect(styleOf(source, '~')).toEqual(['punctuation.special', 'punctuation.special', 'punctuation.special']);
  expect(styleOf(source, 'fn')).toEqual(['variableName.function']);
  expect(styleOf(source, '1')).toEqual(['number']);
  expect(styleOf(source, 'Done')).toEqual([]);
});

test('setup and module blocks are TypeScript until they dedent', () => {
  const source = ['setup', '  const count = useState(0);', '', '  if (!count) return null;', 'main.page', '  p Text'].join('\n');
  expect(styleOf(source, 'setup')).toEqual(['keyword']);
  expect(styleOf(source, 'const')).toEqual(['keyword']);
  expect(styleOf(source, 'count')).toEqual(['variableName.definition', 'variableName']);
  expect(styleOf(source, 'useState')).toEqual(['variableName.function']);
  expect(styleOf(source, 'null')).toEqual(['atom']);
  expect(styleOf(source, 'main')).toEqual(['tagName']);
  expect(styleOf(source, 'p')).toEqual(['tagName']);
});

test('template keywords, components, and each loops', () => {
  const source = ['component Card', '  props { title }: CardProps', '  each item, index in items key item.id', '    Row(item={item})', '  elseif !items.length', '    p Empty'].join('\n');
  expect(styleOf(source, 'Card')).toEqual(['typeName.definition']);
  expect(styleOf(source, 'props')).toEqual(['keyword']);
  expect(styleOf(source, 'CardProps')).toEqual(['typeName']);
  expect(styleOf(source, 'index')).toEqual(['variableName.definition']);
  expect(styleOf(source, 'in')).toEqual(['keyword']);
  expect(styleOf(source, 'key')).toEqual(['keyword']);
  expect(styleOf(source, 'Row')).toEqual(['typeName']);
  expect(styleOf(source, 'elseif')).toEqual(['keyword']);
  expect(styleOf(source, 'Empty')).toEqual([]);
});

test('import lines, comments, and pipe text', () => {
  const source = ["import { useState } from 'octane'", '// note', 'div', '  | Plain #{name}'].join('\n');
  expect(styleOf(source, 'import')).toEqual(['keyword']);
  expect(styleOf(source, 'from')).toEqual(['keyword']);
  expect(styleOf(source, "'octane'")).toEqual(['string']);
  expect(styleOf(source, '// note')).toEqual(['comment']);
  expect(styleOf(source, '|')).toEqual(['punctuation.special']);
  expect(styleOf(source, 'Plain')).toEqual([]);
});
