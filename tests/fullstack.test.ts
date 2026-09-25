import { expect, test } from 'bun:test';
import { createStoreProject } from '../src/playground/fullstack/project';
import { encodeWorkspace, decodeWorkspace } from '../src/playground/project-storage';
import { compileProject } from '../src/playground/compiler';

test('Fullstack app source survives workspace persistence and compiles with its adapters', async () => {
  const project = createStoreProject('https://example-123.convex.cloud', 'a'.repeat(64));
  const saved = encodeWorkspace({ version: 1, project, activeFile: '/src/App.btsx', preview: { width: '100%' } });
  expect(decodeWorkspace(saved).project).toEqual(project);
  expect(project.files['/README.md']).toContain('Run your own copy');
  expect(project.files['/index.html']).toContain('Form Supply');
  expect(project.files['/convex/storeDemo.ts']).toContain("from './seedData'");
  const result = await compileProject(project);
  expect(result.diagnostics.filter(item => item.severity === 'error')).toEqual([]);
  expect(result.entry).toBeTruthy();
});
