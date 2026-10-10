import { afterEach, expect, test } from 'bun:test';
import { ChatController } from '../src/chat/controller';
import { defaultSettings, type ChatRequest, type FetchLike } from '../src/chat/contracts';
import { EditorErrorRepair } from '../src/chat/editor-errors';
import type { CompilationResult, Diagnostic, WorkerRequest } from '../src/playground/contracts';
import type { CompilerWorker } from '../src/playground/coordinator';
import { PlaygroundSession } from '../src/playground/session';

class Worker implements CompilerWorker {
  onmessage: CompilerWorker['onmessage'] = null;
  onerror: CompilerWorker['onerror'] = null;
  request?: WorkerRequest;
  postMessage(message: unknown) { this.request = message as WorkerRequest; }
  terminate() {}
  reply(diagnostics: Diagnostic[] = []) {
    const result: CompilationResult = { entry: diagnostics.some(error => error.severity === 'error') ? undefined : '/src/main.js',
      modules: [], assets: [], intermediate: {}, diagnostics,
      metadata: { duration: 1, modules: 1, transformedFiles: 1, compilerVersion: 'test', timings: { beast: 1, octane: 0, web: 0 } } };
    this.onmessage?.({ data: { version: 1, type: 'compile-result', id: this.request!.id, result } } as MessageEvent);
  }
}
const error: Diagnostic = { file: '/src/App.btsx', source: 'beast', severity: 'error',
  start: { line: 2, column: 4 }, message: 'Unexpected token', code: 'BTSX_PARSE' };
const tick = () => new Promise(resolve => setTimeout(resolve, 20));
const wire = (text: string) => `data: ${JSON.stringify({ choices: [{ delta: { content: text } }] })}\n\ndata: [DONE]\n\n`;
const cleanups: (() => void)[] = [];
afterEach(() => { cleanups.splice(0).forEach(cleanup => cleanup()); });

async function setup() {
  const worker = new Worker();
  const session = new PlaygroundSession({ project: { entry: '/src/main.ts', files: {
    '/src/main.ts': "import App from './App.btsx'",
    '/src/App.btsx': "import Child from './Child.btsx'\nh1 Broken\n",
    '/src/Child.btsx': 'h2 Child\n',
  } }, activeFile: '/src/main.ts', createWorker: () => worker, debounce: 0 });
  const requests: ChatRequest[] = [];
  const signals: AbortSignal[] = [];
  let hold = false;
  let failure = false;
  let finish: (() => void) | undefined;
  const chat = new ChatController({ ...defaultSettings }, () => {}, (async (_url, init) => {
    requests.push(JSON.parse(init!.body as string));
    signals.push(init!.signal as AbortSignal);
    if (failure) return Response.json({ error: 'Offline' }, { status: 503 });
    const body = new ReadableStream<Uint8Array>({ start(controller) {
      let closed = false;
      finish = () => { if (!closed) { closed = true; controller.enqueue(new TextEncoder().encode(wire('Explanation only.'))); controller.close(); } };
      init!.signal?.addEventListener('abort', () => { if (!closed) { closed = true; controller.error(new DOMException('Stopped', 'AbortError')); } });
      if (!hold) finish();
    } });
    return new Response(body, { headers: { 'Content-Type': 'text/event-stream' } });
  }) as FetchLike);
  let opened = 0;
  const repair = new EditorErrorRepair(session, chat, { delay: 5, onRepair: () => opened++ });
  cleanups.push(() => { repair.dispose(); chat.dispose(); session.dispose(); });
  session.start(); await tick();
  return { worker, session, chat, repair, requests, signals, opened: () => opened,
    hold: () => { hold = true; }, fail: () => { failure = true; }, finish: () => finish?.() };
}

test('editor errors start a grounded repair for the diagnosed file, including imports and importers', async () => {
  const f = await setup();
  f.repair.setEnabled(true); f.worker.reply([error]); await tick();
  expect(f.requests).toHaveLength(1);
  expect(f.requests[0].context).toEqual({ file: error.file, source: f.session.read(error.file)! });
  expect(f.requests[0].references?.map(file => file.file)).toEqual(['/src/Child.btsx', '/src/main.ts']);
  expect(f.requests[0].messages).toHaveLength(1);
  expect(f.requests[0].messages[0].content).toContain('/src/App.btsx:2:4 (beast BTSX_PARSE): Unexpected token');
  expect(f.requests[0].files).toHaveLength(3);
  expect(f.chat.getSnapshot().messages.every(message => message.origin === 'editor')).toBe(true);
  expect(f.opened()).toBe(1);
});

test('warnings and compiler infrastructure failures do not request source repairs', async () => {
  const f = await setup(); f.repair.setEnabled(true);
  f.worker.reply([{ ...error, severity: 'warning' }]); await tick();
  f.session.run(); await tick();
  f.worker.onerror?.({ message: 'Compiler worker stopped. Run to restart.' } as ErrorEvent); await tick();
  expect(f.requests).toHaveLength(0);
});

test('an existing error waits for Auto and a configured connection to enable repairs', async () => {
  const f = await setup(); f.worker.reply([error]); await tick();
  expect(f.requests).toHaveLength(0);
  f.repair.setEnabled(true); await tick();
  expect(f.requests).toHaveLength(1);
});

test('unchanged errors are sent once across tab switches, reruns, chat clearing and reconnects', async () => {
  const f = await setup(); f.repair.setEnabled(true); f.worker.reply([error]); await tick();
  f.session.openFile('/src/Child.btsx'); f.session.toggleKeymap(); f.chat.clear();
  f.repair.setEnabled(false); f.repair.setEnabled(true);
  f.session.run(); await tick(); f.worker.reply([error]); await tick();
  expect(f.requests).toHaveLength(1);
});

test('network failure does not cause an automatic request loop', async () => {
  const f = await setup(); f.fail(); f.repair.setEnabled(true); f.worker.reply([error]); await tick();
  expect(f.chat.getSnapshot().error).toBe('Offline');
  f.session.openFile('/src/App.btsx'); await tick();
  expect(f.requests).toHaveLength(1);
});

test('typing discards a pending error and a new broken source can request a fresh repair', async () => {
  const f = await setup(); f.repair.setEnabled(true); f.worker.reply([error]);
  f.session.updateSource(error.file, 'h1 Edited\n'); await tick();
  expect(f.requests).toHaveLength(0);
  f.worker.reply([error]); await tick();
  expect(f.requests).toHaveLength(1);
  expect(f.requests[0].context?.source).toBe('h1 Edited\n');
});

test('busy chat queues only the latest source and does not interrupt a manual response', async () => {
  const f = await setup(); f.hold();
  const manual = f.chat.submit('Explain the app');
  f.repair.setEnabled(true); f.worker.reply([error]); await tick();
  f.session.updateSource(error.file, 'h1 New broken source\n'); await tick(); f.worker.reply([error]);
  expect(f.requests).toHaveLength(1); expect(f.signals[0].aborted).toBe(false);
  f.finish(); await manual; await tick();
  expect(f.requests).toHaveLength(2);
  expect(f.requests[1].context?.source).toBe('h1 New broken source\n');
  expect(f.requests[1].messages).toHaveLength(1);
});

test('editing any project file cancels an in-flight editor repair', async () => {
  const f = await setup(); f.hold(); f.repair.setEnabled(true); f.worker.reply([error]); await tick();
  f.session.updateSource('/src/Child.btsx', 'h2 My work\n'); await tick();
  expect(f.signals[0].aborted).toBe(true);
  expect(f.chat.getSnapshot().messages.at(-1)?.state).toBe('stopped');
  expect(f.session.read('/src/Child.btsx')).toBe('h2 My work\n');
  expect(f.requests).toHaveLength(1);
});

test('turning Auto off or disposing cancels pending and streaming repairs', async () => {
  const f = await setup(); f.repair.setEnabled(true); f.worker.reply([error]);
  f.repair.setEnabled(false); await tick(); expect(f.requests).toHaveLength(0);
  f.hold(); f.repair.setEnabled(true); await tick(); f.repair.setEnabled(false); await tick();
  expect(f.signals[0].aborted).toBe(true);
  const g = await setup(); g.repair.setEnabled(true); g.worker.reply([error]); g.repair.dispose(); await tick();
  expect(g.requests).toHaveLength(0);
});

test('runtime errors with current authored locations repair the located source', async () => {
  const f = await setup(); f.repair.setEnabled(true); f.worker.reply();
  f.session.handlePreviewEvent({ version: 1, type: 'runtime-error', channel: 'test', build: 1, message: 'Missing value',
    frames: [{ raw: 'at App', location: { file: error.file, position: { line: 2, column: 1 }, sourceContent: f.session.read(error.file)! } }] });
  await tick(); expect(f.requests).toHaveLength(1);
  expect(f.requests[0].messages[0].content).toContain('(runtime): Missing value');
});

test('automatic repair chatter stays out of later manual conversation history', async () => {
  const f = await setup(); f.repair.setEnabled(true); f.worker.reply([error]); await tick();
  await f.chat.submit('Explain this component');
  expect(f.requests[1].messages).toEqual([{ role: 'user', content: 'Explain this component' }]);
});

test('replacing a project discards a pending repair and grounds the next error in the new project', async () => {
  const f = await setup(); f.repair.setEnabled(true); f.worker.reply([error]);
  f.session.resetProject({ entry: '/src/main.ts', files: { '/src/main.ts': 'const value = ;' } });
  await tick(); expect(f.requests).toHaveLength(0);
  f.worker.reply([{ ...error, file: '/src/main.ts', source: 'web' }]); await tick();
  expect(f.requests).toHaveLength(1);
  expect(f.requests[0].context).toEqual({ file: '/src/main.ts', source: 'const value = ;' });
  expect(f.chat.getSnapshot().messages.at(-1)?.projectGeneration).toBe(1);
});

test('runtime errors without a current source location do not repair unrelated code', async () => {
  const f = await setup(); f.repair.setEnabled(true); f.worker.reply();
  f.session.handlePreviewEvent({ version: 1, type: 'runtime-error', channel: 'test', build: 1, message: 'Old error',
    frames: [{ raw: 'at App', location: { file: error.file, position: { line: 2, column: 1 }, sourceContent: 'Old source' } }] });
  await tick(); expect(f.requests).toHaveLength(0);
});
