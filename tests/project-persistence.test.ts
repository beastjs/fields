import { expect, test } from 'bun:test';
import { connectProjectPersistence } from '../src/playground/project-persistence';
import { decodeWorkspace, WorkspaceStore } from '../src/playground/project-storage';
import { PlaygroundSession } from '../src/playground/session';

const project = { entry: '/src/main.ts', files: { '/src/main.ts': '', '/src/App.btsx': 'h1 Hello\n' } };
const tick = () => new Promise(resolve => setTimeout(resolve, 35));
function setup() {
  let raw: string | null = null;
  let writes = 0;
  const store = new WorkspaceStore(() => ({ getItem: () => raw, setItem: (_, value) => { raw = value; writes++; } }));
  store.restore();
  const session = new PlaygroundSession({ project, createWorker: () => ({ onmessage: null, onerror: null,
    postMessage() {}, terminate() {} }) });
  const connection = connectProjectPersistence(session, store, 15);
  return { session, connection, get raw() { return raw; }, get writes() { return writes; },
    dispose() { connection.dispose(); session.dispose(); } };
}

test('autosave debounces authored changes and ignores build, console, and pane activity', async () => {
  const harness = setup(); const { session } = harness;
  try {
    session.updateSource('/src/App.btsx', 'h1 First\n');
    session.updateSource('/src/App.btsx', 'h1 Final\n');
    session.openFile('/src/main.ts'); session.setPreviewWidth('768px');
    expect(session.getSnapshot().saveStatus.label).toBe('Saving…');
    expect(harness.writes).toBe(0);
    await tick();
    expect(harness.writes).toBe(1);
    expect(decodeWorkspace(harness.raw!)).toMatchObject({ activeFile: '/src/main.ts', preview: { width: '768px' },
      project: { files: { '/src/App.btsx': 'h1 Final\n' } } });
    session.selectTool('console'); session.toggleKeymap();
    session.handlePreviewEvent({ version: 1, type: 'console', channel: 'test', build: 1, level: 'log', args: ['hello'] });
    session.run();
    await tick();
    expect(harness.writes).toBe(1);
  } finally { harness.dispose(); }
});

test('lifecycle flushing saves the latest edit even before debounce and leaves no pending write', async () => {
  const harness = setup();
  harness.session.updateSource('/src/App.btsx', 'h1 Before leaving\n');
  harness.connection.flush();
  expect(decodeWorkspace(harness.raw!).project.files['/src/App.btsx']).toBe('h1 Before leaving\n');
  harness.session.addFile('data.json');
  harness.dispose();
  expect(decodeWorkspace(harness.raw!).activeFile).toBe('/src/data.json');
  await tick();
  expect(harness.writes).toBe(2);
});

test('reset replaces a pending save immediately and invalidates old project state', async () => {
  const harness = setup(); const { session } = harness;
  try {
    session.toggleKeymap(); session.addFile('extra.ts'); session.setPreviewWidth('375px');
    session.handlePreviewEvent({ version: 1, type: 'runtime-error', channel: 'test', build: 1, message: 'Old error' });
    session.resetProject(project);
    expect(harness.writes).toBe(1);
    expect(decodeWorkspace(harness.raw!)).toMatchObject({ project, activeFile: '/src/App.btsx', preview: { width: '100%' } });
    expect(session.getSnapshot()).toMatchObject({ projectGeneration: 1, diagnostics: [], console: [],
      keymap: 'vim', previewBuild: undefined, previewFailed: false, hasPreview: false });
    await tick(); expect(harness.writes).toBe(1);
  } finally { harness.dispose(); }
});
