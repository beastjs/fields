import { expect, test } from 'bun:test';
import { chatResponseParts } from '../src/chat/response-parts';

const patch = '```btsx patch=/src/Hero.btsx\n<<<<<<< SEARCH\n  h1 Before\n=======\n  h1 After\n>>>>>>> REPLACE\n```';
test('explanations surround an intact, separately rendered change block', () => {
  const result = chatResponseParts(`Update the hero.\n\n${patch}\n\nOne heading changed.`);
  expect(result.changes.join('').trim()).toBe(patch);
  expect(result.explanation).toContain('Update the hero.');
  expect(result.explanation).toContain('One heading changed.');
  expect(result.explanation).not.toContain('SEARCH');
});
test('an incomplete streaming patch stays in the change area', () => {
  const partial = patch.slice(0, patch.indexOf('======='));
  expect(chatResponseParts(partial).changes.join('')).toBe(partial);
  expect(chatResponseParts(partial).explanation).toBe('');
});
test('plain answers and illustrative snippets belong to the explanation', () => {
  const content = 'A simple example:\n\n```btsx\nh1 Hello\n```';
  expect(chatResponseParts(content)).toEqual({ explanation: content, changes: [] });
});
test('literal diff and full-file blocks are not rewritten by section splitting', () => {
  for (const content of ['```diff\n- Before\n+ After\n```', '```btsx file=/src/Hero.btsx\nh1 After\n```']) {
    expect(chatResponseParts(content)).toEqual({ explanation: '', changes: [content] });
  }
});
