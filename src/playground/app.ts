import { helloWorld } from './examples';
import { readEditorKeymap, writeEditorKeymap } from './editor-preferences';
import { PlaygroundSession } from './session';
import { WorkspaceStore } from './project-storage';
import { connectProjectPersistence } from './project-persistence';
import { applyTheme, readTheme, saveTheme } from './theme';

/** Browser dependencies live at the composition boundary, outside project state. */
export function createPlaygroundSession() {
  const store = new WorkspaceStore(() => localStorage);
  const restored = store.restore();
  const theme = readTheme();
  applyTheme(theme);
  return new PlaygroundSession({
    project: restored.workspace?.project ?? helloWorld,
    activeFile: restored.workspace?.activeFile,
    previewWidth: restored.workspace?.preview.width,
    saveStatus: restored.status,
    connectPersistence(session) {
      const connection = connectProjectPersistence(session, store);
      const onHidden = () => { if (document.visibilityState === 'hidden') connection.flush(); };
      window.addEventListener('pagehide', connection.flush);
      document.addEventListener('visibilitychange', onHidden);
      return () => {
        window.removeEventListener('pagehide', connection.flush);
        document.removeEventListener('visibilitychange', onHidden);
        connection.dispose();
      };
    },
    keymap: readEditorKeymap(),
    theme, persistTheme: saveTheme,
    persistKeymap: writeEditorKeymap,
    createWorker: () => new Worker(new URL('./compiler.worker.ts', import.meta.url), { type: 'module' }),
  });
}

export function resetPlaygroundProject(session: PlaygroundSession) {
  if (window.confirm('Reset this project to Hello World? This replaces all project files and the saved copy in this browser.')) {
    session.resetProject(helloWorld);
  }
}
