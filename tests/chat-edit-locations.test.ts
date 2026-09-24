import { expect, test } from 'bun:test';
import { locateEditLines, formatEditLocations } from '../src/chat/edit-locations';
import { planRepair } from '../src/chat/iterate';
import { ChatController } from '../src/chat/controller';
import { defaultSettings } from '../src/chat/contracts';

const file = '/src/sections/Topbar.btsx';
const source = "header\n  nav\n    a(href='/signin') Sign in\n    a(href='/start') Get started\n";
const prompt = 'replace sign in with Sign in with Google';
const hallucinated = '```btsx patch=' + file + "\n<<<<<<< SEARCH\n    button Google\n=======\n    button Sign in with Google\n>>>>>>> REPLACE\n```";

test('text traversal locates the actual sign-in line and preserves exact source', () => {
  const locations = locateEditLines(source, prompt);
  expect(locations[0].line).toBe(3);
  expect(locations[0].source).toContain("    a(href='/signin') Sign in");
  expect(formatEditLocations(file, locations)).toContain(file + ':2-4');
  expect(locateEditLines(source, 'xyznotpresent')).toEqual([]);
  expect(locateEditLines('x'.repeat(10000), 'xx')).toEqual([]);
});

test('repair gives Jev the original request and real candidate lines, then copies selected evidence', async () => {
  const result = await planRepair({ file, source, prompt, attempt: 1, error: 'A hunk does not match' }, async input => {
    expect(input.prompt).toBe(prompt);
    expect(input.locations?.[0].line).toBe(3);
    return { remedy: 'retry', confidence: 1, certain: true, prospect: 1, fixable: true, lines: [3, 999] };
  });
  expect(result.action).toBe('retry');
  if (result.action !== 'retry') return;
  expect(result.prompt).toContain('Original developer request:\n' + prompt);
  expect(result.prompt).toContain("    a(href='/signin') Sign in");
  expect(result.prompt).not.toContain('999');
});

test('retries exclude invented patches and repair loops from provider history', async () => {
  const requests: { messages: { content: string }[] }[] = [];
  const chat = new ChatController(defaultSettings, () => {}, async (_url, init) => {
    requests.push(JSON.parse(init!.body as string));
    return new Response(`data: ${JSON.stringify({ choices: [{ delta: { content: hallucinated } }] })}\n\ndata: [DONE]\n\n`, { headers: { 'Content-Type': 'text/event-stream' } });
  });
  await chat.submit(prompt, { file, source }, 0);
  await chat.submit('Original developer request: ' + prompt, { file, source }, 0, [], 2);
  expect(requests[1].messages).toHaveLength(1);
  await chat.submit('Try the sign-in label again', { file, source }, 0);
  expect(JSON.stringify(requests[2])).not.toContain('button Google');
  expect(JSON.stringify(requests[2])).not.toContain('Original developer request:');
  expect(chat.getSnapshot().messages).toHaveLength(6);
});
