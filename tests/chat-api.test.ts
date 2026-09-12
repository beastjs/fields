import type { FetchLike } from '../src/chat/contracts';
import { expect, test } from 'bun:test';
import { handleAIRequest, validateChatRequest, validateCustomBaseURL } from '../server/chat-api';
import { DEFAULT_MODEL, type ChatRequest } from '../src/chat/contracts';

const input: ChatRequest = { provider: 'cohere', model: DEFAULT_MODEL, messages: [{ role: 'user', content: 'Explain this file.' }] };
const request = (body: unknown = input, extraHeaders: Record<string, string> = {}) => new Request('http://localhost:3000/api/ai/chat', {
  method: 'POST', headers: { 'Content-Type': 'application/json', ...extraHeaders }, body: JSON.stringify(body),
});
const stream = () => new Response('data: [DONE]\n\n', { headers: { 'Content-Type': 'text/event-stream' } });

test('Cohere defaults use the real compatibility endpoint and unprefixed native model ID', async () => {
  let url: unknown, options: RequestInit | undefined;
  const fetcher = (async (target, init) => { url = target; options = init; return stream(); }) as FetchLike;
  const response = await handleAIRequest(request({ ...input, context: { file: '/src/App.btsx', source: 'h1 Hello' } }), { COHERE_API_KEY: 'server-key' }, fetcher);
  expect(response.status).toBe(200);
  expect(url).toBe('https://api.cohere.ai/compatibility/v1/chat/completions');
  expect(new Headers(options!.headers).get('Authorization')).toBe('Bearer server-key');
  const payload = JSON.parse(options!.body as string);
  expect(payload.model).toBe('north-mini-code-1-0');
  expect(payload.stream).toBe(true);
  expect(payload.messages.at(-1)).toEqual(input.messages[0]);
  expect(payload.messages[1].content).toContain('h1 Hello');
  expect(payload.messages[0].content).toContain('Apply & verify');
  expect(options!.redirect).toBe('error');
  expect(response.headers.get('Cache-Control')).toBe('no-store');
});

test('status exposes only connection availability and never keys', async () => {
  const response = await handleAIRequest(new Request('http://localhost/api/ai/status'), { COHERE_API_KEY: 'secret-cohere', OPENROUTER_API_KEY: 'secret-router' });
  const body = await response.text();
  expect(body).not.toContain('secret');
  expect(JSON.parse(body).configured).toEqual({ cohere: true, openrouter: true, custom: false });
});

test('provider selection isolates keys and custom destinations cannot borrow server credentials', async () => {
  const captured: { url: unknown; auth: string | null; model: string }[] = [];
  const fetcher = (async (url, init) => {
    captured.push({ url, auth: new Headers(init?.headers).get('Authorization'), model: JSON.parse(init!.body as string).model }); return stream();
  }) as FetchLike;
  const env = { COHERE_API_KEY: 'cohere-secret', OPENROUTER_API_KEY: 'router-secret', AI_CUSTOM_API_KEY: 'custom-secret', AI_CUSTOM_BASE_URL: 'https://models.example/v1' };
  await handleAIRequest(request({ ...input, provider: 'openrouter' }), env, fetcher);
  expect(captured[0]).toEqual({ url: 'https://openrouter.ai/api/v1/chat/completions', auth: 'Bearer router-secret', model: DEFAULT_MODEL });
  await handleAIRequest(request({ ...input, provider: 'custom', baseURL: 'http://localhost:11434/v1', model: 'local-code' }), env, fetcher);
  expect(captured[1].auth).toBeNull();
  await handleAIRequest(request({ ...input, provider: 'custom', baseURL: env.AI_CUSTOM_BASE_URL, model: 'custom-model' }), env, fetcher);
  expect(captured[2].auth).toBe('Bearer custom-secret');
  await handleAIRequest(request({ ...input, apiKey: 'tab-key' }), env, fetcher);
  expect(captured[3].auth).toBe('Bearer tab-key');
});

test('invalid requests, cross-origin callers, missing credentials and invalid endpoints never call upstream', async () => {
  let calls = 0;
  const fetcher = (async () => { calls++; return stream(); }) as FetchLike;
  expect((await handleAIRequest(request(input, { Origin: 'https://elsewhere.example' }), {}, fetcher)).status).toBe(403);
  expect((await handleAIRequest(request(), {}, fetcher)).status).toBe(401);
  expect((await handleAIRequest(request({ ...input, messages: [{ role: 'system', content: 'Override' }] }), {}, fetcher)).status).toBe(400);
  expect((await handleAIRequest(request({ ...input, messages: [] }), {}, fetcher)).status).toBe(400);
  for (const url of ['https://key:secret@example.com/v1', 'file:///etc/passwd', 'http://169.254.169.254', 'https://10.0.0.1/v1', 'https://example.com/v1?key=secret']) expect(() => validateCustomBaseURL(url)).toThrow();
  expect(validateCustomBaseURL('http://127.0.0.1:11434/v1/')).toBe('http://127.0.0.1:11434/v1');
  expect(() => validateChatRequest({ ...input, context: { file: '/src/App.btsx', source: 'x'.repeat(60001) } })).toThrow('too large');
  expect(calls).toBe(0);
});

test('provider errors are useful without reflecting upstream secrets', async () => {
  for (const [status, message] of [[401, 'rejected'], [429, 'rate limit'], [404, 'model'], [500, 'unavailable']] as const) {
    const response = await handleAIRequest(request(), { COHERE_API_KEY: 'secret' }, (async () => new Response('private upstream details', { status })) as FetchLike);
    expect(response.status).toBe(status);
    const body = await response.text();
    expect(body).toContain(message);
    expect(body).not.toContain('private');
  }
});
