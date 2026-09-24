import { expect, test } from 'bun:test';
import { smoothChatStream } from '../server/smooth-chat';
import { streamChat } from '../src/chat/transport';
import { defaultSettings } from '../src/chat/contracts';

const data = (delta: Record<string, string>, finish_reason: string | null = null) => `data: ${JSON.stringify({ choices: [{ delta, finish_reason }] })}\n\n`;
const input = { ...defaultSettings, messages: [{ role: 'user' as const, content: 'Change the heading' }] };
const response = (wire: string, signal = new AbortController().signal) => {
  const bytes = new TextEncoder().encode(wire);
  let cursor = 0;
  return new Response(smoothChatStream(new ReadableStream<Uint8Array>({
    pull(controller) { if (cursor === bytes.length) controller.close(); else controller.enqueue(bytes.slice(cursor, ++cursor)); },
  }), signal, null), { headers: { 'Content-Type': 'text/event-stream' } });
};

test('SDK smoothing retains exact patch bytes and streams reasoning separately across UTF-8 boundaries', async () => {
  const content = '```btsx patch=/src/Hero.btsx\n<<<<<<< SEARCH\n  h1 Hello 世界\n=======\n  h1 Welcome ✧\n>>>>>>> REPLACE\n```';
  const texts: string[] = [], thoughts: string[] = [];
  await streamChat(input, text => texts.push(text), new AbortController().signal,
    async () => response((data({ reasoning_content: 'Check the heading.' }) + data({ content }) + 'data: [DONE]\n\n').replaceAll('\n', '\r\n')),
    reasoning => thoughts.push(reasoning));
  expect(texts.at(-1)).toBe(content);
  expect(texts.length).toBeGreaterThan(5);
  expect(thoughts.at(-1)).toBe('Check the heading.');
  expect(texts.at(-1)).not.toContain('Check the heading');
});

test('completion flushes an unspaced final token exactly once, including events without trailing separators', async () => {
  let text = '';
  await streamChat(input, next => { text = next; }, new AbortController().signal,
    async () => response(data({ content: '最後' }, 'stop').trimEnd()));
  expect(text).toBe('最後');
});

test('truncated streams retain the last word but cannot masquerade as completed responses', async () => {
  let text = '';
  await expect(streamChat(input, next => { text = next; }, new AbortController().signal,
    async () => response(data({ content: 'Partial output' })))).rejects.toThrow('before the response finished');
  expect(text).toBe('Partial output');
});

test('provider errors and malformed events remain errors after smoothing', async () => {
  for (const wire of ['data: {"error":{"message":"failed"}}\n\n', 'data: malformed\n\n']) {
    await expect(streamChat(input, () => {}, new AbortController().signal, async () => response(wire))).rejects.toThrow();
  }
});

test('cancelling smoothing cancels the upstream stream', async () => {
  let cancelled = false;
  const abort = new AbortController();
  const body = new ReadableStream<Uint8Array>({
    start(controller) { controller.enqueue(new TextEncoder().encode(data({ content: 'One two three four five ' }))); },
    cancel() { cancelled = true; },
  });
  const reader = smoothChatStream(body, abort.signal).getReader();
  await reader.read();
  abort.abort();
  await expect(reader.read()).rejects.toBeDefined();
  await new Promise(resolve => setTimeout(resolve, 25));
  expect(cancelled).toBe(true);
});
