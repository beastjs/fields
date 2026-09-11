import { ProjectEditor } from './editor';
import type { PlaygroundSession } from './session';

/** CodeMirror owns its DOM and undo state; synchronize only changed session fields. */
export function connectEditor(parent: HTMLElement, session: PlaygroundSession) {
  let previous = session.getSnapshot();
  const editor = new ProjectEditor(parent, session.updateSource, session.run, previous.keymap, previous.theme);
  editor.open(previous.activeFile, previous.project.files[previous.activeFile]);
  editor.setDiagnostics(previous.diagnostics);
  let disposed = false;
  let queued = false;
  const unsubscribe = session.subscribe(() => {
    if (queued) return;
    queued = true;
    // A notification may originate inside a CodeMirror update. Never dispatch reentrantly.
    queueMicrotask(() => {
      queued = false;
      if (disposed) return;
      const next = session.getSnapshot();
      if (next.projectGeneration !== previous.projectGeneration) editor.reset(next.activeFile, next.project.files[next.activeFile]);
      else if (next.activeFile !== previous.activeFile) editor.open(next.activeFile, next.project.files[next.activeFile]);
      for (const path of Object.keys(previous.project.files)) {
        if (!(path in next.project.files)) editor.forget(path);
      }
      if (next.keymap !== previous.keymap) editor.setKeymap(next.keymap);
      if (next.theme !== previous.theme) editor.setTheme(next.theme);
      if (next.diagnostics !== previous.diagnostics) editor.setDiagnostics(next.diagnostics);
      if (next.editorFocus !== previous.editorFocus) editor.focus(next.editorFocus?.position);
      previous = next;
    });
  });
  return () => { disposed = true; unsubscribe(); editor.dispose(); };
}
