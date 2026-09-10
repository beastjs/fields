import type { FetchLike } from '../src/chat/contracts';
import { expect, test } from 'bun:test';
import { streamChat } from '../src/chat/transport';
import { ChatController } from '../src/chat/controller';
import { defaultSettings, DEFAULT_MODEL, type ChatRequest } from '../src/chat/contracts';

const input: ChatRequest = { provider: 'cohere', model: DEFAULT_MODEL, messages: [{ role: 'user', content: 'Hello' }] };
const delta = (text: string) => `data: ${JSON.stringify({ choices: [{ delta: { content: text }, finish_reason: null }] })}\n\n`;
const response = (text: string, split = 1) => {
  const data = new TextEncoder().encode(text); let cursor = 0;
  return new Response(new ReadableStream({ pull(controller) { if (cursor >= data.length) controller.close(); else { controller.enqueue(data.slice(cursor, cursor + split)); cursor += split; } } }), { headers: { 'Content-Type': 'text/event-stream' } });
};

test('SSE survives every UTF-8 boundary, CRLF, comments and a final completion event', async () => {
  const values: string[] = [];
  const wire = (': keepalive\n\n' + delta('Hello ') + delta('世界 ✧') + 'data: [DONE]\n\n').replaceAll('\n', '\r\n');
  await streamChat(input, value => values.push(value), new AbortController().signal, (async () => response(wire)) as FetchLike);
  expect(values).toEqual(['Hello ', 'Hello 世界 ✧']);
});

test('truncated and invalid streams report an error while retaining delivered text', async () => {
  let partial = '';
  await expect(streamChat(input, value => { partial = value; }, new AbortController().signal,
    (async () => response(delta('Partial answer'))) as FetchLike)).rejects.toThrow('before the response finished');
  expect(partial).toBe('Partial answer');
  await expect(streamChat(input, () => {}, new AbortController().signal,
    (async () => response('data: malformed\n\n')) as FetchLike)).rejects.toThrow('invalid stream');
  await expect(streamChat(input, () => {}, new AbortController().signal,
    (async () => response('data: [DONE]\n\n')) as FetchLike)).rejects.toThrow('no answer');
});

test('chat retry retains one user turn and sends changed provider settings', async () => {
  const requests: ChatRequest[] = [];
  const fetcher = (async (_url, init) => {
    requests.push(JSON.parse(init!.body as string));
    return requests.length === 1 ? Response.json({ error: 'Try again' }, { status: 429 }) : response(delta('Recovered') + 'data: [DONE]\n\n', 13);
  }) as FetchLike;
  const chat = new ChatController({ ...defaultSettings }, () => {}, fetcher);
  await chat.submit('Explain', { file: '/src/App.btsx', source: 'h1 Hello' });
  expect(chat.getSnapshot().error).toBe('Try again');
  chat.configure({ ...defaultSettings, provider: 'openrouter', apiKey: 'test-key' });
  await chat.retry();
  expect(chat.getSnapshot().messages.map(message => message.role)).toEqual(['user', 'assistant']);
  expect(chat.getSnapshot().messages.at(-1)?.content).toBe('Recovered');
  expect(requests[1].provider).toBe('openrouter');
  expect(requests[1].context?.file).toBe('/src/App.btsx');
  expect(chat.getSnapshot().busy).toBe(false);
  chat.dispose();
});

test('stopping cancels the request, preserves partial output, and clearing removes the conversation', async () => {
  let signal: AbortSignal | null | undefined;
  const fetcher = (async (_url, options) => {
    signal = options?.signal;
    return new Response(new ReadableStream({ start(controller) {
      controller.enqueue(new TextEncoder().encode(delta('In progress')));
      signal?.addEventListener('abort', () => controller.error(new DOMException('Stopped', 'AbortError')));
    } }), { headers: { 'Content-Type': 'text/event-stream' } });
  }) as FetchLike;
  const chat = new ChatController({ ...defaultSettings }, () => {}, fetcher);
  const pending = chat.submit('Hello');
  await new Promise(resolve => setTimeout(resolve, 5));
  expect(chat.getSnapshot().messages.at(-1)?.content).toBe('In progress');
  chat.stop(); await pending;
  expect(signal?.aborted).toBe(true);
  expect(chat.getSnapshot().messages.at(-1)?.state).toBe('stopped');
  expect(chat.getSnapshot().error).toBe('');
  chat.clear(); expect(chat.getSnapshot().messages).toEqual([]); chat.dispose();
});
