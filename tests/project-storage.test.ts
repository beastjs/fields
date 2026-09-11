import { expect, test } from 'bun:test';
import { decodeWorkspace, encodeWorkspace, MAX_PROJECT_FILES, MAX_PROJECT_LENGTH, PROJECT_STORAGE_KEY,
  WorkspaceStore, type SavedWorkspace } from '../src/playground/project-storage';

const workspace = (): SavedWorkspace => ({ version: 1, project: { entry: '/src/main.ts', files: {
  '/src/main.ts': 'import "./App.btsx";', '/src/App.btsx': 'h1 Saved 🌱\n',
} }, activeFile: '/src/App.btsx', preview: { width: '375px' } });

class MemoryStorage {
  value: string | null = null;
  fail = false;
  writes = 0;
  getItem(key: string) { expect(key).toBe(PROJECT_STORAGE_KEY); return this.value; }
  setItem(key: string, value: string) {
    expect(key).toBe(PROJECT_STORAGE_KEY);
    if (this.fail) throw new Error('Quota exceeded');
    this.value = value; this.writes++;
  }
}

test('versioned projects round-trip deterministically and only persist authored state', () => {
  const source = { ...workspace(), console: ['secret'], apiKey: 'secret', lastResult: { code: 'compiled' } };
  const raw = encodeWorkspace(source);
  expect(decodeWorkspace(raw)).toEqual(workspace());
  expect(encodeWorkspace(decodeWorkspace(raw))).toBe(raw);
  expect(raw).not.toContain('secret'); expect(raw).not.toContain('compiled');
});

test('legacy raw project snapshots migrate; stale settings recover without losing files', () => {
  const migrated = decodeWorkspace(JSON.stringify({ ...workspace().project, activeFile: '/src/./main.ts' }));
  expect(migrated).toEqual({ ...workspace(), activeFile: '/src/main.ts', preview: { width: '100%' } });
  for (const activeFile of ['/deleted.ts', '../../escape', null]) {
    const restored = decodeWorkspace(JSON.stringify({ ...workspace(), activeFile, preview: { width: 'javascript:bad' } }));
    expect(restored.activeFile).toBe('/src/App.btsx');
    expect(restored.preview.width).toBe('100%');
    expect(restored.project).toEqual(workspace().project);
  }
});

test('validation rejects corrupt projects, invalid paths, duplicate aliases, and oversized records', () => {
  const invalid = ['{', 'null', '[]', JSON.stringify({ ...workspace(), version: 99 }),
    ...[
      { entry: '/missing.ts', files: { '/src/main.ts': '' } },
      { entry: '/a.ts', files: { '/a.ts': 42 } },
      { entry: '/a.ts', files: { '/a.ts': '', '/src/../a.ts': '' } },
      { entry: '/a.ts', files: { '/a.ts': '', '../../escape.ts': '' } },
      { entry: '/a.ts', files: { '/a.ts': '', '/notes.md': '' } },
      { entry: '/a.ts', files: { '/a.ts': '', ['x'.repeat(1021) + '.ts']: '' } },
      { entry: '/a.ts', files: {} },
      { entry: '/0.ts', files: Object.fromEntries(Array.from({ length: MAX_PROJECT_FILES + 1 }, (_, i) => [`/${i}.ts`, ''])) },
    ].map(project => JSON.stringify({ ...workspace(), project })),
    ' '.repeat(MAX_PROJECT_LENGTH + 1),
  ];
  for (const raw of invalid) expect(() => decodeWorkspace(raw)).toThrow();
});

test('unreadable and unsupported records are retained until an explicit reset', () => {
  for (const raw of ['broken', JSON.stringify({ version: 20 })]) {
    const storage = new MemoryStorage(); storage.value = raw;
    const store = new WorkspaceStore(() => storage);
    expect(store.restore().workspace).toBeUndefined();
    expect(store.save(workspace()).issue).toBeTruthy();
    expect(storage.value).toBe(raw); expect(storage.writes).toBe(0);
    expect(store.save(workspace(), true).label).toBe('Saved locally');
    expect(decodeWorkspace(storage.value!)).toEqual(workspace());
  }
});

test('quota failures keep the previous save and allow retry; blocked storage does not throw', () => {
  const storage = new MemoryStorage(); const store = new WorkspaceStore(() => storage);
  store.restore(); store.save(workspace());
  const last = storage.value;
  storage.fail = true;
  const edited = workspace(); edited.project.files['/src/App.btsx'] = 'h1 New\n';
  expect(store.save(edited).label).toBe('Not saved'); expect(storage.value).toBe(last);
  storage.fail = false;
  expect(store.save(edited).label).toBe('Saved locally');
  expect(decodeWorkspace(storage.value!).project).toEqual(edited.project);
  const unavailable = new WorkspaceStore(() => { throw new Error('Storage denied'); });
  expect(unavailable.restore().status.label).toBe('Storage unavailable');
  expect(unavailable.save(workspace()).issue).toBeTruthy();
});

test('oversized edits never replace the last saved project', () => {
  const storage = new MemoryStorage(); const store = new WorkspaceStore(() => storage);
  store.restore(); store.save(workspace());
  const previous = storage.value;
  const edited = workspace(); edited.project.files['/src/App.btsx'] = 'x'.repeat(MAX_PROJECT_LENGTH);
  expect(store.save(edited).label).toBe('Not saved');
  expect(storage.value).toBe(previous);
});

test('concurrent tabs cannot silently overwrite a project saved after their restore', () => {
  const storage = new MemoryStorage();
  const a = new WorkspaceStore(() => storage), b = new WorkspaceStore(() => storage);
  a.restore(); a.save(workspace()); b.restore();
  const edited = workspace(); edited.project.files['/src/App.btsx'] = 'h1 From A\n';
  a.save(edited);
  expect(b.save(workspace()).label).toBe('Save conflict');
  expect(decodeWorkspace(storage.value!).project).toEqual(edited.project);
  expect(b.save(workspace(), true).label).toBe('Saved locally');
});
