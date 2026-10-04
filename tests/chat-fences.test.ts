import { expect, test } from 'bun:test';
import { normalizeFences } from '../src/chat/fences';

test('glued fences accept key/value attributes and reject malformed attributes', () => {
  expect(normalizeFences('Here: ```btsx file=/src/App.btsx mode=patch\np Hi\n```'))
    .toBe('Here:\n```btsx file=/src/App.btsx mode=patch\np Hi\n```');
  for (const info of ['btsx invalid', 'btsx =', 'btsx file=path\u00a0invalid']) {
    const source = `Here: \`\`\`${info}\np Hi\n\`\`\``;
    expect(normalizeFences(source)).toBe(source);
  }
});

test('a long invalid info string finishes without regex backtracking', () => {
  const source = 'Here: ```btsx ' + '!==\t'.repeat(20_000) + '!';
  expect(normalizeFences(source)).toBe(source);
}, 1000);
