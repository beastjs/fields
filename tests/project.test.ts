import { expect, test } from 'bun:test';
import { PlaygroundProject } from '../src/playground/project';

const create = () => new PlaygroundProject({ entry: '/src/main.ts', files: {
  '/src/App.btsx': 'h1 Hello\n', '/src/main.ts': 'import "./App.btsx";',
} });

test('new files normalize nested paths and reject aliases of existing files', () => {
  const project = create();
  expect(project.add('  components\\Greeting.btsx  ')).toBe('/src/components/Greeting.btsx');
  expect(project.activeFile).toBe('/src/components/Greeting.btsx');
  expect(project.fs.read(project.activeFile)).toBe('p A new component\n');
  expect(() => project.add('src/components/../App.btsx')).toThrow('already exists');
  expect(() => project.add('../src/App.btsx')).toThrow('already exists');
  expect(project.add('/data.json')).toBe('/data.json');
  expect(project.fs.read('/data.json')).toBe('{}\n');
});

test('invalid file names leave the project and active selection unchanged', () => {
  const project = create();
  const before = project.snapshot();
  for (const path of ['', '  ', '../../outside.ts', 'no-extension', 'notes.exe', 'file.ts?query', '/']) {
    expect(() => project.add(path)).toThrow();
  }
  expect(project.snapshot()).toEqual(before);
  expect(project.activeFile).toBe('/src/App.btsx');
});

test('deleting the active file selects a survivor and the entry cannot be deleted', () => {
  const project = create();
  expect(project.remove('/src/./main.ts')).toBe(false);
  expect(project.remove('/src/App.btsx')).toBe(true);
  expect(project.activeFile).toBe('/src/main.ts');
  expect(project.open('/src/missing.btsx')).toBe(false);
  expect(project.activeFile).toBe('/src/main.ts');
  expect(project.remove('/src/missing.btsx')).toBe(false);
  expect(project.add('App.btsx')).toBe('/src/App.btsx');
  expect(project.fs.read('/src/App.btsx')).toBe('p A new component\n');
});
