import { expect, test } from 'bun:test';
import type { CompilationResult, WorkerRequest } from '../src/playground/contracts';
import type { CompilerWorker } from '../src/playground/coordinator';
import { PlaygroundSession } from '../src/playground/session';

class FakeWorker implements CompilerWorker {
  onmessage: CompilerWorker['onmessage'] = null;
  onerror: CompilerWorker['onerror'] = null;
  request?: WorkerRequest;
  terminated = false;
  postMessage(message: unknown) { this.request = message as WorkerRequest; }
  terminate() { this.terminated = true; }
  reply(result: CompilationResult) {
    this.onmessage?.({ data: { version: 1, type: 'compile-result', id: this.request!.id, result } } as MessageEvent);
  }
}
const project = { entry: '/src/main.ts', files: { '/src/main.ts': '', '/src/App.btsx': 'h1 Hello\n' } };
const result: CompilationResult = { entry: '/src/main.js', modules: [], assets: [], diagnostics: [], intermediate: {},
  metadata: { duration: 5, modules: 1, transformedFiles: 1, compilerVersion: 'test', timings: { beast: 1, octane: 2, web: 2 } } };
const tick = () => new Promise(resolve => setTimeout(resolve, 10));

test('view selection and keymap changes do not compile or replace the current preview', async () => {
  const worker = new FakeWorker();
  const preferences: string[] = [];
  const session = new PlaygroundSession({ project, createWorker: () => worker, persistKeymap: key => preferences.push(key) });
  session.start(); await tick(); worker.reply(result);
  const build = session.getSnapshot().previewBuild;
  const revision = worker.request!.id;
  session.openFile('/src/main.ts', { line: 1, column: 1 }, true);
  session.selectTool('output'); session.toggleKeymap();
  expect(session.getSnapshot().previewBuild).toBe(build);
  expect(worker.request!.id).toBe(revision);
  expect(preferences).toEqual(['vim']);
  expect(session.getSnapshot().editorFocus?.position).toBeUndefined();
  session.dispose();
  expect(worker.terminated).toBe(true);
});

test('failed builds retain the last executable build and explicit reload reuses it', async () => {
  const worker = new FakeWorker();
  const session = new PlaygroundSession({ project, createWorker: () => worker, debounce: 0 });
  session.start(); await tick(); worker.reply(result);
  session.handlePreviewEvent({ version: 1, type: 'rendered', channel: 'test', build: 1 });
  const build = session.getSnapshot().previewBuild;
  session.updateSource('/src/App.btsx', 'broken'); await tick();
  const failure: CompilationResult = { ...result, entry: undefined, diagnostics: [
    { file: '/src/App.btsx', message: 'Broken syntax', severity: 'error', source: 'beast', start: { line: 1, column: 1 } },
  ] };
  worker.reply(failure);
  expect(session.getSnapshot().previewBuild).toBe(build);
  expect(session.getSnapshot().lastResult).toBe(failure);
  expect(session.getSnapshot().previewStatus).toBe('Last successful build');
  expect(session.getSnapshot().toolPanel).toBe('problems');
  session.reloadPreview();
  expect(session.getSnapshot().previewBuild?.result).toBe(result);
  expect(session.getSnapshot().previewBuild?.revision).not.toBe(build?.revision);
  session.dispose();
});

test('file changes publish independent snapshots, clear obsolete diagnostics, and bound console history', () => {
  const session = new PlaygroundSession({ project, createWorker: () => new FakeWorker() });
  const before = session.getSnapshot();
  expect(session.getSnapshot()).toBe(before);
  const file = session.addFile('Nested.btsx');
  expect(before.project.files).not.toHaveProperty(file);
  expect(session.getSnapshot().activeFile).toBe(file);
  session.handlePreviewEvent({ version: 1, type: 'runtime-error', channel: 'test', build: 1, message: 'Oops', frames: [
    { raw: 'at Nested', location: { file, position: { line: 1, column: 1 }, sourceContent: session.read(file)! } },
  ] });
  expect(session.getSnapshot().diagnostics).toHaveLength(1);
  session.deleteFile(file);
  expect(session.getSnapshot().diagnostics).toEqual([]);
  expect(session.getSnapshot().activeFile).toBe('/src/App.btsx');
  for (let i = 0; i < 205; i++) session.handlePreviewEvent({ version: 1, type: 'console', channel: 'test', build: 1, level: 'log', args: [String(i)], timestamp: i });
  expect(session.getSnapshot().console).toHaveLength(200);
  expect(session.getSnapshot().console[0].message).toBe('5');
  session.clearConsole();
  expect(session.getSnapshot().console).toEqual([]);
  session.dispose();
});

test('explicit preview recovery clears runtime failure state without compiling or losing source', async () => {
  const worker = new FakeWorker();
  const session = new PlaygroundSession({ project, createWorker: () => worker });
  session.start(); await tick(); worker.reply(result);
  const request = worker.request;
  session.handlePreviewEvent({ version: 1, type: 'runtime-error', channel: 'test', build: 1, message: 'Hosted preview did not start.' });
  expect(session.getSnapshot().buildError).toBe(true);
  session.reloadPreview();
  expect(session.getSnapshot()).toMatchObject({ buildError: false, previewFailed: false, previewError: '', hasPreview: false });
  expect(session.getSnapshot().project).toEqual(project);
  expect(worker.request).toBe(request);
  session.handlePreviewEvent({ version: 1, type: 'rendered', channel: 'new', build: 1 });
  expect(session.getSnapshot().previewStatus).toBe('Live');
  session.dispose();
});

test('mode changes restart in one notification and stay outside saved project state', async () => {
  const worker = new FakeWorker();
  const session = new PlaygroundSession({ project, createWorker: () => worker });
  session.start(); await tick(); worker.reply(result);
  const request = worker.request;
  const before = session.exportWorkspace();
  const states: ReturnType<typeof session.getSnapshot>[] = [];
  const unsubscribe = session.subscribe(() => states.push(session.getSnapshot()));
  session.setPreviewMode('hosted');
  expect(states).toHaveLength(1);
  expect(states[0]).toMatchObject({ previewMode: 'hosted', previewStatus: 'Loading', previewBuild: { result, forceReload: true } });
  expect(worker.request).toBe(request);
  expect(session.exportWorkspace()).toEqual(before);
  session.setPreviewMode('hosted');
  expect(states).toHaveLength(1);
  unsubscribe();
  session.resetProject(project);
  expect(session.getSnapshot().previewMode).toBe('hosted');
  session.dispose();
});

test('a Design Studio theme preview is ephemeral and does not compile or enter saved project state', () => {
  const worker = new FakeWorker();
  const session = new PlaygroundSession({ project, createWorker: () => worker });
  const before = session.exportWorkspace();
  const states: ReturnType<typeof session.getSnapshot>[] = [];
  const unsubscribe = session.subscribe(() => states.push(session.getSnapshot()));
  session.setStudioThemePreview(':root { --studio-bg: red; }');
  expect(states).toHaveLength(1);
  expect(states[0].studioThemeCss).toContain('--studio-bg: red');
  expect(session.exportWorkspace()).toEqual(before);
  expect(worker.request).toBeUndefined();
  session.setStudioThemePreview(undefined);
  expect(session.getSnapshot().studioThemeCss).toBeUndefined();
  unsubscribe();
  session.dispose();
});

test('recommendations compile before mutation and reject intervening edits', async () => {
  const workers: FakeWorker[] = [];
  const session = new PlaygroundSession({ project, verifyRuntime: async () => {}, createWorker: () => { const worker = new FakeWorker(); workers.push(worker); return worker; } });
  const source = project.files['/src/App.btsx'];
  const pending = session.applyRecommendation('/src/App.btsx', source, 'h1 Recommended\n', 0, new AbortController().signal);
  await tick();
  expect(session.read('/src/App.btsx')).toBe(source);
  expect(workers[0].request!.project.files['/src/App.btsx']).toBe('h1 Recommended\n');
  const checked = { ...result, modules: [{ id: 'app', source: '/src/App.btsx', code: '' }] };
  workers[0].reply(checked); await pending;
  expect(session.read('/src/App.btsx')).toBe('h1 Recommended\n');
  expect(workers[0].terminated).toBe(true);
  await expect(session.applyRecommendation('/src/App.btsx', source, 'h1 Stale\n', 0, new AbortController().signal)).rejects.toThrow('changed');
  const next = session.applyRecommendation('/src/App.btsx', 'h1 Recommended\n', 'h1 Later\n', 0, new AbortController().signal);
  // Attach the rejection handler before delivering the worker response.
  const rejected = next.catch(error => error as Error);
  await tick();
  session.updateSource('/src/main.ts', '// changed elsewhere');
  workers.at(-1)!.reply(checked);
  expect((await rejected)?.message).toContain('changed during verification');
  expect(session.read('/src/App.btsx')).toBe('h1 Recommended\n');
  session.dispose();
});

test('failed and cancelled recommendation checks leave files intact', async () => {
  const worker = new FakeWorker();
  const session = new PlaygroundSession({ project, createWorker: () => worker });
  const source = project.files['/src/App.btsx'];
  const pending = session.applyRecommendation('/src/App.btsx', source, 'broken', 0, new AbortController().signal);
  const failed = pending.catch(error => error as Error);
  await tick();
  worker.reply({ ...result, entry: undefined, diagnostics: [{ file: '/src/App.btsx', start: { line: 1, column: 1 }, severity: 'error', source: 'beast', message: 'Broken syntax' }] });
  expect((await failed)?.message).toContain('Broken syntax');
  expect(session.read('/src/App.btsx')).toBe(source);
  const abort = new AbortController();
  const cancelled = session.applyRecommendation('/src/App.btsx', source, 'h1 Fine', 0, abort.signal).catch(error => error as Error);
  abort.abort(); expect((await cancelled)?.message).toContain('cancelled');
  expect(session.read('/src/App.btsx')).toBe(source);
  session.dispose();
});

test('runtime verification must succeed before mutation and receives the project build', async () => {
  const worker = new FakeWorker();
  let rejectRuntime!: (error: Error) => void;
  let checked: CompilationResult | undefined;
  const session = new PlaygroundSession({ project, createWorker: () => worker, verifyRuntime: async result => {
    checked = result;
    await new Promise<void>((_resolve, reject) => { rejectRuntime = reject; });
  } });
  const source = project.files['/src/App.btsx'];
  const pending = session.applyRecommendation('/src/App.btsx', source, 'h1 Candidate\n', 0, new AbortController().signal).catch(error => error as Error);
  await tick();
  // App is unimported: compile it separately, but run the actual application entry.
  worker.reply(result); await tick();
  worker.reply({ ...result, entry: '/src/App.js' }); await tick();
  expect(checked).toBe(result);
  expect(session.read('/src/App.btsx')).toBe(source);
  rejectRuntime(new Error('Runtime verification failed: mount crashed'));
  expect((await pending)?.message).toContain('mount crashed');
  expect(session.read('/src/App.btsx')).toBe(source);
  session.dispose();
});

test('verification also compiles an unimported recommended file and aborts on session disposal', async () => {
  const worker = new FakeWorker();
  const session = new PlaygroundSession({ project, createWorker: () => worker });
  const source = project.files['/src/App.btsx'];
  const pending = session.applyRecommendation('/src/App.btsx', source, 'h1 Unimported\n', 0, new AbortController().signal).catch(error => error as Error);
  await tick(); worker.reply(result); await tick();
  expect(worker.request!.project.entry).toBe('/src/App.btsx');
  expect(session.read('/src/App.btsx')).toBe(source);
  session.dispose();
  expect((await pending)?.message).toContain('cancelled');
  expect(worker.terminated).toBe(true);
});

test('writing several files is one project change that opens the requested file', () => {
  const session = new PlaygroundSession({ project, createWorker: () => new FakeWorker() });
  const states: ReturnType<typeof session.getSnapshot>[] = [];
  const unsubscribe = session.subscribe(() => states.push(session.getSnapshot()));
  session.writeFiles({ '/src/Topbar.btsx': 'header Top\n', '/src/App.btsx': "import Topbar from './Topbar.btsx'\n\nTopbar\nh1 Hello\n" }, '/src/Topbar.btsx');
  expect(states).toHaveLength(1);
  expect(states[0].activeFile).toBe('/src/Topbar.btsx');
  expect(states[0].project.files['/src/Topbar.btsx']).toBe('header Top\n');
  expect(states[0].projectGeneration).toBe(0);
  session.writeFiles({ '/src/Topbar.btsx': 'header Top\n' });
  expect(states).toHaveLength(1);
  unsubscribe();
  session.dispose();
});
