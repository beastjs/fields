import { expect, test } from 'bun:test';
import { CompilationCoordinator, type CompilerWorker } from '../src/playground/coordinator';
import type { CompilationResult, WorkerRequest } from '../src/playground/contracts';

class FakeWorker implements CompilerWorker {
  onmessage: CompilerWorker['onmessage'] = null;
  onerror: CompilerWorker['onerror'] = null;
  request?: WorkerRequest;
  terminated = false;
  postMessage(message: unknown) { this.request = message as WorkerRequest; }
  terminate() { this.terminated = true; }
  reply() { this.onmessage?.({ data: { version: 1, type: 'compile-result', id: this.request!.id, result: { entry: String(this.request!.id) } as CompilationResult } } as MessageEvent); }
}
const project = { entry: '/main.ts', files: { '/main.ts': '' } };
const tick = () => new Promise(resolve => setTimeout(resolve, 10));

test('an edit invalidates in-flight results before the next debounce completes', async () => {
  const workers: FakeWorker[] = [];
  const applied: string[] = [];
  const coordinator = new CompilationCoordinator({
    createWorker: () => { const worker = new FakeWorker(); workers.push(worker); return worker; },
    onStart() {}, onError() {}, onResult: result => applied.push(result.entry!), debounce: 20,
  });
  coordinator.schedule(project, true); await tick();
  const oldReply = workers[0].onmessage!;
  coordinator.schedule(project);
  oldReply({ data: { version: 1, type: 'compile-result', id: 1, result: { entry: 'old' } } } as MessageEvent);
  expect(applied).toEqual([]);
  expect(workers[0].terminated).toBe(true);
  await new Promise(resolve => setTimeout(resolve, 30));
  workers[1].reply();
  expect(applied).toEqual(['2']);
  coordinator.dispose();
  expect(workers[1].terminated).toBe(true);
});

test('idle workers are reused, project snapshots are isolated, and disposal cancels pending work', async () => {
  const worker = new FakeWorker();
  const coordinator = new CompilationCoordinator({ createWorker: () => worker, onStart() {}, onError() {}, onResult() {}, debounce: 20 });
  const mutable = { entry: '/main.ts', files: { '/main.ts': 'before' } };
  coordinator.schedule(mutable, true); mutable.files['/main.ts'] = 'after'; await tick();
  expect(worker.request!.project.files['/main.ts']).toBe('before');
  worker.reply(); coordinator.schedule(project, true); await tick();
  expect(worker.terminated).toBe(false);
  coordinator.dispose();
  coordinator.schedule(project); await tick();
  expect(worker.request!.id).toBe(2);
});
