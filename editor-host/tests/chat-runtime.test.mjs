import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';

const chat = { provider: 'cohere', model: 'cohere/north-mini-code-1-0', messages: [{ role: 'user', content: 'Hello' }] };
const evaluation = { model: 'jev-1.13.0', answers: { q: { type: 'noul', noul: 0.9 } }, usage: { input_tokens: 1, output_tokens: 1 } };
const judgment = { state: 'hello', questions: { q: { type: 'noul', instructions: 'Is this a greeting?' } } };
let runtime;
let redirectStatus = 0;
let calls = [];

before(async () => {
  const bundle = await build({
    entryPoints: [fileURLToPath(new URL('../src/worker.ts', import.meta.url))],
    bundle: true, write: false, format: 'esm', platform: 'browser', target: 'es2022',
  });
  runtime = new Miniflare(convertV4MiniflareOptions({
    modules: true, script: bundle.outputFiles[0].text, compatibilityDate: '2026-09-01',
    bindings: { COHERE_API_KEY: 'test-cohere', TYPESAFE_API_KEY: 'test-typesafe' },
    outboundService: async request => {
      calls.push({ url: request.url, auth: request.headers.get('authorization') });
      if (redirectStatus) return new Response(null, { status: redirectStatus, headers: { location: 'https://redirect.invalid/secret-sink' } });
      if (new URL(request.url).hostname === 'api.cohere.ai') {
        return new Response('data: {"choices":[{"delta":{"content":"Hello world"},"finish_reason":"stop"}]}\n\ndata: [DONE]\n\n', { headers: { 'content-type': 'text/event-stream' } });
      }
      return Response.json(evaluation);
    },
  }));
});
after(async () => { await runtime?.dispose(); });

const post = (route, body) => runtime.dispatchFetch(`https://editor.test/api/${route}`, {
  method: 'POST', headers: { 'content-type': 'application/json', origin: 'https://editor.test' }, body: JSON.stringify(body),
});

test('deployed Worker streams chat and evaluates TypeSafe using native Workers fetch', async () => {
  calls = [];
  const response = await post('ai/chat', chat);
  assert.equal(response.status, 200);
  const wire = await response.text();
  assert.match(wire, /Hello/);
  assert.match(wire, /world/);
  assert.match(wire, /\[DONE\]/);
  const result = await post('jev/evaluate', judgment);
  assert.equal(result.status, 200);
  assert.deepEqual(await result.json(), evaluation);
  assert.deepEqual(calls.map(call => call.auth), ['Bearer test-cohere', 'Bearer test-typesafe']);
});

test('provider redirects are rejected without forwarding keys or retrying', async () => {
  for (redirectStatus of [301, 302, 303, 307, 308]) {
    for (const [route, body] of [['ai/chat', chat], ['jev/evaluate', judgment]]) {
      calls = [];
      const response = await post(route, body);
      assert.equal(response.status, 502);
      assert.equal(typeof (await response.json()).error, 'string');
      assert.equal(calls.length, 1);
      assert.notEqual(new URL(calls[0].url).hostname, 'redirect.invalid');
    }
  }
  redirectStatus = 0;
});
