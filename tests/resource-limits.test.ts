import { expect, test } from 'bun:test';
import { compilationLimitError, MAX_COMPILE_CHARACTERS } from '../src/playground/resource-limits';
import { compileProject } from '../src/playground/compiler';

test('compilation limits allow boundaries and reject oversized unreachable source before compilation', async () => {
  const project = { entry: '/main.ts', files: { '/main.ts': 'x'.repeat(MAX_COMPILE_CHARACTERS - 16) } };
  expect(compilationLimitError(project)).toBeUndefined();
  project.files['/main.ts'] += 'x';
  expect(compilationLimitError(project)).toContain('characters');
  const files = Object.fromEntries(Array.from({ length: 200 }, (_, i) => [`/${i}.ts`, '']));
  expect(compilationLimitError({ entry: '/0.ts', files })).toBeUndefined();
  files['/extra.ts'] = '';
  const result = await compileProject({ entry: '/0.ts', files });
  expect(result.diagnostics[0].message).toContain('200 files');
  expect(result.modules).toEqual([]);
  expect(result.metadata.transformedFiles).toBe(0);
});
