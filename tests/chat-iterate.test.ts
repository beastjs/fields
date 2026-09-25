import { expect, test } from 'bun:test';
import { EXHAUSTED, fixUpPrompt, MAX_ATTEMPTS, planRepair } from '../src/chat/iterate';
import type { RepairPlan } from '../src/jev/chat';
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
  for (const error of ['This change is already in the file.', 'Verification cancelled. No files changed.']) {
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

const plan = (over: Partial<RepairPlan> = {}): RepairPlan => ({ remedy: 'retry', confidence: 0.8, certain: true, prospect: 0.8, fixable: true, ...over });
const decide = (over?: Partial<RepairPlan>) => {
  const calls: unknown[] = [];
  const fn = async (input: unknown) => { calls.push(input); return plan(over); };
  return Object.assign(fn, { calls });
};
const failure = { prompt: 'make the heading tomato', file: '/src/App.btsx', error: 'A hunk does not match the current file closely enough.', attempt: 2 };

test('the deterministic answers short-circuit before any evaluation is spent', async () => {
  const jev = decide();
  expect(await planRepair({ ...failure, attempt: MAX_ATTEMPTS }, jev)).toEqual({ action: 'stop', reason: EXHAUSTED });
  expect(await planRepair({ ...failure, error: 'Verification cancelled. No files changed.' }, jev)).toMatchObject({ action: 'stop' });
  // Cancellation is deterministic and never costs a call.
  expect(jev.calls).toHaveLength(0);
});

test('an uncertain reading keeps the blind retry rather than spending an attempt on a guess', async () => {
  const unsure = await planRepair(failure, decide({ certain: false, remedy: 'ask_user', confidence: 0.3 }));
  expect(unsure).toMatchObject({ action: 'retry', remedy: 'retry' });
  expect(unsure.action === 'retry' && unsure.prompt).toContain('attempt 2 of 5');

  // Unreachable, unconfigured or rate limited: the loop must not depend on Jev being there.
  const offline = await planRepair(failure, async () => { throw new Error('unreachable'); });
  expect(offline).toMatchObject({ action: 'retry', remedy: 'retry' });
  expect(await planRepair(failure, null)).toMatchObject({ action: 'retry', remedy: 'retry' });
});

test('Jev cannot abandon a recoverable patch failure based on confidence alone', async () => {
  for (const judgment of [{ remedy: 'stop' as const }, { remedy: 'ask_user' as const }, { fixable: false }, { prospect: 0.1 }]) {
    expect(await planRepair(failure, decide(judgment))).toMatchObject({ action: 'retry' });
  }
  expect(await planRepair({ ...failure, error: 'An external product decision is required' }, decide({ remedy: 'ask_user' })))
    .toMatchObject({ action: 'stop', reason: expect.stringContaining('decision from you') });
});

test('a remedy shapes the follow-up instead of resending the same request', async () => {
  const smaller = await planRepair(failure, decide({ remedy: 'simplify' }));
  expect(smaller).toMatchObject({ action: 'retry', remedy: 'simplify' });
  expect(smaller.action === 'retry' && smaller.prompt).toContain('smallest change');

  const split = await planRepair(failure, decide({ remedy: 'split' }));
  expect(split.action === 'retry' && split.prompt).toContain('automatically');

  // The developer's own request reaches the decision, not just the error text.
  const jev = decide();
  await planRepair(failure, jev);
  expect(jev.calls[0]).toMatchObject({ prompt: 'make the heading tomato', attempt: 2, maxAttempts: MAX_ATTEMPTS });
});

test('cancelled repair decisions never fall back to another request', async () => {
  const abort = new AbortController();
  let finish!: (value: ReturnType<typeof plan>) => void;
  const pending = planRepair(failure, (_input, signal) => {
    expect(signal).toBe(abort.signal);
    return new Promise(resolve => { finish = resolve; });
  }, abort.signal);
  abort.abort();
  finish(plan({ remedy: 'retry' }));
  await expect(pending).rejects.toThrow();
  const unused = decide();
  await expect(planRepair(failure, unused, abort.signal)).rejects.toThrow();
  expect(unused.calls).toHaveLength(0);
});
