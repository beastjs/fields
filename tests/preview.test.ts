import { runInNewContext } from 'node:vm';
import { expect, test } from 'bun:test';
import { isPreviewEvent, previewDocument } from '../src/playground/preview';
import { hostedPreviewDocument } from '../src/playground/preview-bootstrap';
import { validatePreviewURL } from '../src/playground/preview-config';

test('hosted destinations are deployment URLs without credentials or payload parameters', () => {
  expect(validatePreviewURL(undefined)).toBeUndefined();
  expect(validatePreviewURL('')).toBeUndefined();
  expect(validatePreviewURL('https://preview.example/preview.html')).toBe('https://preview.example/preview.html');
  expect(validatePreviewURL('http://localhost:3100/preview.html')).toBe('http://localhost:3100/preview.html');
  for (const value of ['/preview.html', 'javascript:alert(1)', 'data:text/html,test', 'http://preview.example/',
    'https://user:password@preview.example/', 'https://preview.example/?source=test', 'https://preview.example/#channel']) {
    expect(() => validatePreviewURL(value)).toThrow();
  }
});

test('static hosted bootstrap preserves CSP and waits for a versioned parent handshake', () => {
  const html = hostedPreviewDocument();
  expect(html).toContain("connect-src 'none'");
  expect(html).toMatch(/message\.type !== ["']connect["']/);
  expect(html).toContain('event.source !== parent');
  expect(html).not.toContain('Hello, world.');
  expect(html).not.toContain('allow-same-origin');
});

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

test('runtime-error budget suppresses serialization and resets after one second', () => {
  let now = 0;
  const listeners = new Map<string, (event: { message: unknown }) => void>();
  const messages: { type: string; message?: string }[] = [];
  const sandbox = {
    parent: { postMessage: (message: { type: string; message?: string }) => messages.push(message) },
    performance: { now: () => now },
    console: Object.fromEntries(['log', 'info', 'warn', 'error', 'debug'].map(level => [level, () => {}])),
    addEventListener: (name: string, callback: (event: { message: unknown }) => void) => listeners.set(name, callback),
  };
  const html = previewDocument('budget-test', 1);
  runInNewContext(html.slice(html.indexOf('<script>') + 8, html.indexOf('</script>')), { ...sandbox, window: sandbox });
  const report = listeners.get('error')!;
  for (let index = 0; index < 1000; index++) report({ message: 'burst' });
  expect(messages.filter(message => message.type === 'runtime-error')).toHaveLength(21);
  expect(messages.at(-1)?.message).toContain('Runtime error rate limit reached');
  let inspected = false;
  report({ message: new Proxy({}, { ownKeys() { inspected = true; return []; } }) });
  expect(inspected).toBe(false);
  now = 1000;
  report({ message: 'recovered' });
  expect(messages.at(-1)?.message).toBe('recovered');
});
