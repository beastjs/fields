import { describe, expect, test } from 'bun:test';
import { compileProject } from '../src/playground/compiler';
import type { CompilerWorker } from '../src/playground/coordinator';
import type { WorkerRequest } from '../src/playground/contracts';
import { helloWorld } from '../src/playground/examples';
import { buildSiteForPublishing } from '../src/playground/publish-site';

/** Runs the real compiler in-process behind the worker protocol, and records what it was asked. */
function inlineWorker(requests: WorkerRequest[], state: { terminated: boolean }): CompilerWorker {
  const worker: CompilerWorker = {
    onmessage: null,
    onerror: null,
    terminate: () => { state.terminated = true; },
    postMessage: message => {
      const request = message as WorkerRequest;
      requests.push(request);
      void compileProject(request.project, request.target).then(result =>
        worker.onmessage?.({ data: { version: 1, type: 'compile-result', id: request.id, result } } as MessageEvent));
    },
  };
  return worker;
}

describe('buildSiteForPublishing', () => {
  test('compiles with the site target in its own worker and packages the result', async () => {
    const requests: WorkerRequest[] = [];
    const state = { terminated: false };
    const site = await buildSiteForPublishing(helloWorld, 'Hello & co', () => inlineWorker(requests, state));
    expect(requests.map(request => request.target)).toEqual(['site']);
    expect(state.terminated).toBe(true);
    expect(site.files[0].path).toBe('/index.html');
    expect(site.files[0].content).toContain('<title>Hello &amp; co</title>');
    expect(site.files.every(file => !file.content.includes('__playgroundHot'))).toBe(true);
  });

  test('refuses to publish a project with compile errors, naming the first', async () => {
    const broken = { ...helloWorld, files: { ...helloWorld.files, '/src/main.ts': "import './missing.ts';" } };
    const state = { terminated: false };
    await expect(buildSiteForPublishing(broken, 'x', () => inlineWorker([], state))).rejects.toThrow('/src/main.ts');
    expect(state.terminated).toBe(true);
  });

  test('times out and stops a worker that never answers', async () => {
    const state = { terminated: false };
    const silent: CompilerWorker = { onmessage: null, onerror: null, postMessage() {}, terminate: () => { state.terminated = true; } };
    await expect(buildSiteForPublishing(helloWorld, 'x', () => silent, 20)).rejects.toThrow('timed out');
    expect(state.terminated).toBe(true);
  });
});
