import { helloWorld } from './examples';
import { readEditorKeymap, readEditorLineNumbers, readEditorTheme, writeEditorKeymap, writeEditorLineNumbers, writeEditorTheme } from './editor-preferences';
import { PlaygroundSession } from './session';
import { WorkspaceStore } from './project-storage';
import { connectProjectPersistence } from './project-persistence';
import { CloudProjectController, connectCloudProjectPersistence, convexCloudProjectGateway } from './cloud-project-persistence';
import { applyTheme, readTheme, saveTheme } from './theme';

/** Browser dependencies live at the composition boundary, outside project state. */
export function createPlaygroundApp() {
  const store = new WorkspaceStore(() => localStorage);
  const restored = store.restore();
  const theme = readTheme();
  const cloud = new CloudProjectController();
  applyTheme(theme);
  const session = new PlaygroundSession({
    project: restored.workspace?.project ?? helloWorld,
    activeFile: restored.workspace?.activeFile,
    previewWidth: restored.workspace?.preview.width,
    saveStatus: restored.status,
    connectPersistence(session) {
      const connection = connectProjectPersistence(session, store);
      const cloudConnection = convexCloudProjectGateway
        ? connectCloudProjectPersistence(session, convexCloudProjectGateway, undefined, 650, cloud)
        : null;
      const flush = () => { connection.flush(); void cloudConnection?.flush(); };
      const onHidden = () => { if (document.visibilityState === 'hidden') flush(); };
      window.addEventListener('pagehide', flush);
      document.addEventListener('visibilitychange', onHidden);
      return () => {
        window.removeEventListener('pagehide', flush);
        document.removeEventListener('visibilitychange', onHidden);
        cloudConnection?.dispose();
        connection.dispose();
      };
    },
    keymap: readEditorKeymap(),
    theme, persistTheme: saveTheme,
    persistKeymap: writeEditorKeymap,
    editorTheme: readEditorTheme(), persistEditorTheme: writeEditorTheme,
    lineNumbers: readEditorLineNumbers(), persistLineNumbers: writeEditorLineNumbers,
    createWorker: () => new Worker(new URL('./compiler.worker.ts', import.meta.url), { type: 'module' }),
  });
  return { session, cloud };
}

export function createPlaygroundSession() { return createPlaygroundApp().session; }

export function resetPlaygroundProject(session: PlaygroundSession) {
  if (window.confirm('Reset this project to Hello World? This replaces all project files and the saved copy in this browser.')) {
    session.resetProject(helloWorld);
  }
}
