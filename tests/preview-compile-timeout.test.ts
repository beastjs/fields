import { expect, jest, test } from 'bun:test';
import { TemplatePreview, type TemplatePreviewStatus } from '../src/playground/template-preview';
import type { CompilationProject } from '../src/playground/contracts';

/**
 * A compile that never answers.
 *
 * Every path through a frame has `Preview`'s own guard, so this is the one step that could fail silently and leave
 * the studio reading "Building preview…" with nothing left to move it on.
 */
// `Preview` listens for frame messages on the window; nothing here ever posts one.
(globalThis as { window?: unknown }).window ??= { addEventListener() {}, removeEventListener() {} };

const frame = () => ({
  setAttribute() {}, removeAttribute() {}, addEventListener() {}, removeEventListener() {},
  referrerPolicy: '', title: '', inert: false, srcdoc: '', dataset: {} as Record<string, string>,
  contentWindow: null
}) as unknown as HTMLIFrameElement;

const project: CompilationProject = { entry: '/src/main.ts', files: { '/src/main.ts': '' } };

const harness = () => {
  const statuses: TemplatePreviewStatus[] = [];
  const workers: { terminated: boolean; sent: number }[] = [];
  const createWorker = () => {
    const record = { terminated: false, sent: 0 };
    workers.push(record);
    return { postMessage() { record.sent++; }, terminate() { record.terminated = true; }, onmessage: null, onerror: null } as never;
  };
  const preview = new TemplatePreview([frame(), frame()], 'dark', createWorker, status => statuses.push(status));
  return { preview, statuses, workers };
};

test('a compile that never answers becomes an error instead of an endless "compiling"', () => {
  jest.useFakeTimers();
  try {
    const { preview, statuses } = harness();
    preview.show(project);
    expect(statuses.at(-1)).toEqual({ state: 'compiling' });
    // Short of the guard it is still a build in flight, not a failure: a slow compile must not be called dead.
    jest.advanceTimersByTime(19000);
    expect(statuses.at(-1)).toEqual({ state: 'compiling' });
    jest.advanceTimersByTime(1500);
    expect(statuses.at(-1)?.state).toBe('error');
    expect((statuses.at(-1) as { message: string }).message).toContain('stopped responding');
    preview.dispose();
  } finally {
    jest.useRealTimers();
  }
});

test('the wedged worker is replaced, so the next edit builds rather than queueing behind it', () => {
  jest.useFakeTimers();
  try {
    const { preview, workers } = harness();
    preview.show(project);
    expect(workers).toHaveLength(1);
    jest.advanceTimersByTime(20500);
    // The dead one is terminated and a fresh one takes over — the difference between a studio that reports a bad
    // build and one that has to be closed and reopened.
    expect(workers[0].terminated).toBe(true);
    expect(workers).toHaveLength(2);
    preview.show(project);
    expect(workers[1].sent).toBe(1);
    preview.dispose();
    expect(workers[1].terminated).toBe(true);
  } finally {
    jest.useRealTimers();
  }
});

test('an answered compile clears the guard, so a later timer cannot fail a live preview', () => {
  jest.useFakeTimers();
  try {
    const { preview, statuses, workers } = harness();
    preview.show(project);
    // The worker answers with a diagnostic, which is a finished compile as much as a successful one is.
    (preview as unknown as { worker: { onmessage: (event: unknown) => void } }).worker.onmessage({
      data: { type: 'compile-result', id: 1, result: { entry: undefined, modules: [], diagnostics: [{ severity: 'error', message: 'boom' }] } }
    });
    expect(statuses.at(-1)).toEqual({ state: 'error', message: 'boom' });
    jest.advanceTimersByTime(60000);
    // Still the compiler's own message, not the guard's.
    expect(statuses.at(-1)).toEqual({ state: 'error', message: 'boom' });
    expect(workers).toHaveLength(1);
    preview.dispose();
  } finally {
    jest.useRealTimers();
  }
});
