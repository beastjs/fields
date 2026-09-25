import { expect, test } from 'bun:test';
import { ChatController } from '../src/chat/controller';
import { defaultSettings, type ChatRequest } from '../src/chat/contracts';
import { requestedFiles } from '../src/chat/context-request';

const files = { '/src/App.btsx': 'h1 App\n', '/src/Hero.btsx': 'h1 Hero\n' };
const stream = (content: string) => new Response(`data: ${JSON.stringify({ choices: [{ delta: { content } }] })}\n\ndata: [DONE]\n\n`, { headers: { 'Content-Type': 'text/event-stream' } });

test('context requests accept only existing, unattached project paths', () => {
  expect(requestedFiles('```context\n["./src/Hero.btsx", "/etc/passwd", "/src/App.btsx"]\n```', Object.keys(files), ['/src/App.btsx']))
    .toEqual(['/src/Hero.btsx']);
  expect(requestedFiles('Please attach /src/Hero.btsx', Object.keys(files), [])).toEqual(['/src/Hero.btsx']);
});

for (const reply of ['```context\n["/src/Hero.btsx"]\n```', 'Please open /src/Hero.btsx so I can edit it.', '```btsx patch=/src/Hero.btsx\n<<<<<<< SEARCH\nh1 Wrong\n=======\nh1 New\n>>>>>>> REPLACE\n```']) {
  test(`automatically retrieves missing context and regenerates the answer: ${reply.slice(0, 30)}`, async () => {
    const requests: ChatRequest[] = [];
    const chat = new ChatController(defaultSettings, () => {}, async (_url, init) => {
      requests.push(JSON.parse(init!.body as string));
      return stream(requests.length === 1 ? reply : 'The hero is ready for a focused edit.');
    }, () => ({ files, generation: 0 }));
    await chat.submit('Improve the hero', { file: '/src/App.btsx', source: files['/src/App.btsx'] }, 0, [], 1, Object.keys(files));
    expect(requests).toHaveLength(2);
    expect(requests[1].context).toEqual({ file: '/src/Hero.btsx', source: files['/src/Hero.btsx'] });
    expect(requests[1].messages.at(-1)?.content).toBe('Improve the hero');
    expect(chat.getSnapshot().messages).toHaveLength(2);
    expect(chat.getSnapshot().messages[0].attachments).toContain('/src/Hero.btsx');
    expect(chat.getSnapshot().messages[1].state).toBe('complete');
    expect(chat.getSnapshot().error).toBe('');
    chat.dispose();
  });
}

test('gathering context never mixes a replaced project with an old request', async () => {
  let generation = 0;
  const chat = new ChatController(defaultSettings, () => {}, async () => {
    generation++;
    return stream('```context\n["/src/Hero.btsx"]\n```');
  }, () => ({ files, generation }));
  await chat.submit('Improve hero', undefined, 0);
  expect(chat.getSnapshot().messages.at(-1)?.state).toBe('error');
  expect(chat.getSnapshot().error).toContain('project changed');
  chat.dispose();
});

test('a generic request for an attachment recovers using the active workspace file', async () => {
  let calls = 0;
  const chat = new ChatController(defaultSettings, () => {}, async (_url, init) => {
    const request = JSON.parse(init!.body as string) as ChatRequest;
    if (++calls === 1) return stream('Please select the file associated with your query.');
    expect(request.context?.file).toBe('/src/App.btsx');
    return stream('Here is the answer.');
  }, () => ({ files, generation: 0, activeFile: '/src/App.btsx' }));
  await chat.submit('Explain this code', undefined, 0);
  expect(calls).toBe(2);
  expect(chat.getSnapshot().error).toBe('');
  chat.dispose();
});

test('repeated or invalid context requests are bounded and never marked complete', async () => {
  let calls = 0;
  const chat = new ChatController(defaultSettings, () => {}, async () => {
    calls++;
    return stream('```context\n["/does-not-exist.ts"]\n```');
  }, () => ({ files, generation: 0 }));
  await chat.submit('Explain', undefined, 0);
  expect(calls).toBe(5);
  expect(chat.getSnapshot().messages.at(-1)?.state).toBe('error');
  chat.dispose();
});
