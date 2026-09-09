import { expect, test } from 'bun:test';
import { isPreviewEvent, previewDocument } from '../src/playground/preview';

test('preview protocol rejects malformed, oversized, stale and unrelated messages', () => {
  const event = { version: 1, channel: 'secret', build: 2, type: 'ready' };
  expect(isPreviewEvent(event, 'secret', 2)).toBe(true);
  for (const value of [null, {}, { ...event, channel: 'other' }, { ...event, build: 1 }, { ...event, type: 'console', args: [{}] }, { ...event, type: 'runtime-error', message: {} }]) {
    expect(isPreviewEvent(value, 'secret', 2)).toBe(false);
  }
  expect(isPreviewEvent({ ...event, type: 'console', level: 'log', args: ['ok'], timestamp: 1 }, 'secret', 2)).toBe(true);
  expect(isPreviewEvent({ ...event, type: 'console', level: 'log', args: ['x'.repeat(4001)], timestamp: 1 }, 'secret', 2)).toBe(false);
  expect(isPreviewEvent({ ...event, type: 'module-manifest', modules: [{ id: 'app', url: 'blob:null/app' }] }, 'secret', 2)).toBe(true);
  for (const modules of [null, [{}], [{ id: 'app', url: 'https://example.com/app' }], Array(1001).fill({ id: 'app', url: 'blob:null/app' })]) {
    expect(isPreviewEvent({ ...event, type: 'module-manifest', modules }, 'secret', 2)).toBe(false);
  }
  expect(isPreviewEvent({ ...event, type: 'runtime-error', message: 'error', position: { url: 'blob:null/app', line: -1, column: 2 } }, 'secret', 2)).toBe(false);
});

test('bootstrap is independent from user source and restricts remote execution', () => {
  const document = previewDocument('test-channel', 1);
  expect(document).toContain("connect-src 'none'");
  expect(document).toContain("default-src 'none'");
  expect(document).toContain('event.source !== parent');
  expect(document).not.toContain('allow-same-origin');
  expect(document).not.toContain('Hello, world.');
});
