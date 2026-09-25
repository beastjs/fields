import type { CompilationResult } from './contracts';
import { Preview } from './preview';

/** Run the candidate in an isolated preview before committing any source to the editor. */
export function verifyRuntime(result: CompilationResult, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) { reject(new Error('Verification cancelled. No files changed.')); return; }
    const frame = document.createElement('iframe');
    frame.title = 'Verifying proposed change';
    frame.setAttribute('aria-hidden', 'true');
    frame.tabIndex = -1;
    frame.inert = true;
    // Keep it rendered: display:none can suspend animation frames used by app startup.
    frame.style.cssText = 'position:fixed;left:-10000px;top:0;width:1024px;height:768px;opacity:0;pointer-events:none';
    let settled = false;
    let quiet: ReturnType<typeof setTimeout> | undefined;
    let deadline: ReturnType<typeof setTimeout> | undefined;
    let preview: Preview | undefined;
    const finish = (error?: Error) => {
      if (settled) return;
      settled = true;
      clearTimeout(quiet);
      clearTimeout(deadline);
      signal.removeEventListener('abort', cancel);
      preview?.dispose();
      frame.remove();
      if (error) reject(error); else resolve();
    };
    const cancel = () => finish(new Error('Verification cancelled. No files changed.'));
    try {
      preview = new Preview(frame, event => {
        if (event.type === 'runtime-error') finish(new Error(`Runtime verification failed: ${event.message}`));
        // Capture mount effects and immediate asynchronous failures after the first render.
        else if (event.type === 'rendered' && !quiet) quiet = setTimeout(() => finish(), 750);
      });
      signal.addEventListener('abort', cancel, { once: true });
      deadline = setTimeout(() => finish(new Error('Runtime verification timed out. No files changed.')), 12000);
      document.body.append(frame);
      preview.load(result, true);
    } catch (error) { finish(error instanceof Error ? error : new Error(String(error))); }
  });
}
