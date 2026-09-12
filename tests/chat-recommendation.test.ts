import { expect, test } from 'bun:test';
import { fileRecommendation } from '../src/chat/recommendation';
import { ChatController } from '../src/chat/controller';
import { defaultSettings } from '../src/chat/contracts';

const context = { file: '/src/App.btsx', source: 'h1 Before\n' };
const block = (file = context.file, source = 'h1 After\n') => '```btsx file=' + file + '\n' + source + '```';
test('only one explicit complete replacement for the attached file is actionable', () => {
  expect(fileRecommendation('Recommended:\n' + block(), context)).toEqual({ file: context.file, source: 'h1 After\n' });
  for (const content of ['```btsx\nh1 Snippet\n```', block('/src/Other.btsx'), block() + '\n' + block(), block().slice(0, -3), block(context.file, context.source)]) {
    expect(fileRecommendation(content, context)).toBeUndefined();
  }
  expect(fileRecommendation(block())).toBeUndefined();
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
