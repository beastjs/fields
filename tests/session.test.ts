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
