import { expect, test } from 'bun:test';
import { fixUpPrompt, MAX_ATTEMPTS } from '../src/chat/iterate';
import { ChatController } from '../src/chat/controller';
import { defaultSettings } from '../src/chat/contracts';

test('failed changes are fed back with the error until the attempts run out', () => {
  const prompt = fixUpPrompt('/src/App.btsx:3:5 Unexpected token', '/src/App.btsx', 1)!;
  expect(prompt).toContain('/src/App.btsx:3:5 Unexpected token');
  expect(prompt).toContain('attempt 1 of 5');
  expect(fixUpPrompt('A hunk does not match', '/src/App.btsx', MAX_ATTEMPTS - 1)).toContain('attempt 4 of 5');
  expect(fixUpPrompt('A hunk does not match', '/src/App.btsx', MAX_ATTEMPTS)).toBeUndefined();
});

test('failures another reply cannot fix do not iterate', () => {
  for (const error of ['No file was attached to this message', 'This change is already in the file.', 'Verification cancelled. No files changed.']) {
    expect(fixUpPrompt(error, '/src/App.btsx', 1)).toBeUndefined();
  }
});

test('fix-up rounds carry their attempt number onto both turns', async () => {
  const stream = () => new Response('data: {"choices":[{"delta":{"content":"ok"}}]}\n\ndata: [DONE]\n\n', { headers: { 'Content-Type': 'text/event-stream' } });
  const chat = new ChatController({ ...defaultSettings, apiKey: 'k' }, () => {}, (async () => stream()) as never);
  await chat.submit('Fix it', { file: '/src/App.btsx', source: 'h1 A' }, 0);
  await chat.submit('Retry with error', { file: '/src/App.btsx', source: 'h1 A' }, 0, [], 2);
  const [first, reply, fixUp, fixReply] = chat.getSnapshot().messages;
  expect([first.attempt, reply.attempt, fixUp.attempt, fixReply.attempt]).toEqual([undefined, 1, 2, 2]);
});
