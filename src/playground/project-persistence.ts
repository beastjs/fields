import type { PlaygroundSession } from './session';
import { WorkspaceStore } from './project-storage';

/** Subscribe only to authored state; compilation and console activity never schedule writes. */
export function connectProjectPersistence(session: PlaygroundSession, store: WorkspaceStore, delay = 300) {
  let previous = session.getSnapshot();
  let timer: ReturnType<typeof setTimeout> | undefined;
  let pending = false;
  let replace = false;
  const flush = () => {
    clearTimeout(timer);
    if (!pending) return;
    pending = false;
    const state = session.getSnapshot();
    session.setSaveStatus(store.save({ version: 1, project: state.project, activeFile: state.activeFile,
      preview: { width: state.previewWidth } }, replace));
    // An explicit reset/import authorizes replacing a blocked record, including a retried write.
    if (!session.getSnapshot().saveStatus.issue) replace = false;
  };
  const schedule = () => {
    if (store.blockedStatus && !replace) { session.setSaveStatus(store.blockedStatus); return; }
    pending = true;
    clearTimeout(timer);
    session.setSaveStatus({ label: 'Saving…' });
    timer = setTimeout(flush, delay);
  };
  const unsubscribe = session.subscribe(() => {
    const next = session.getSnapshot();
    const reset = next.projectGeneration !== previous.projectGeneration;
    const changed = reset || next.project !== previous.project || next.activeFile !== previous.activeFile || next.previewWidth !== previous.previewWidth;
    previous = next; // Set before publishing save status, which also notifies subscribers.
    if (!changed) return;
    replace ||= reset;
    schedule();
    if (reset) flush();
  });
  schedule();
  return { flush, dispose() { unsubscribe(); flush(); } };
}
