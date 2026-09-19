import { expect, test } from 'bun:test';
import { MAX_REFERENCE_CHARS, MAX_REFERENCES } from '../src/chat/contracts';
import { chatReferences, relatedFiles } from '../src/chat/project-context';
import { helloWorld } from '../src/playground/examples';
import { addSection, planPageInstall } from '../src/playground/studio/page';
import { builtInPresets } from './built-in-presets';

const withPage = { ...helloWorld, files: { ...helloWorld.files, ...planPageInstall(helloWorld, addSection([], 'topbar-marketing', builtInPresets).blocks, builtInPresets).files } };

test('related files are the active file imports and importers, including newly added components', () => {
  expect(relatedFiles(withPage, '/src/App.btsx').sort()).toEqual(['/src/Page.btsx', '/src/main.ts']);
  expect(relatedFiles(withPage, '/src/Page.btsx').sort()).toEqual(['/src/App.btsx', '/src/sections/Topbar.btsx']);
  expect(relatedFiles(withPage, '/src/sections/Topbar.btsx')).toEqual(['/src/Page.btsx']);
  expect(relatedFiles(withPage, '/src/main.ts').sort()).toEqual(['/src/App.btsx', '/src/style.css']);
  const multiline = { entry: '/src/main.ts', files: {
    '/src/main.ts': "import {\n  thing,\n} from './lib';\nimport 'octane';\nimport './missing';\n",
    '/src/lib.ts': 'export const thing = 1;\n',
  } };
  expect(relatedFiles(multiline, '/src/main.ts')).toEqual(['/src/lib.ts']);
  expect(relatedFiles(multiline, '/src/gone.ts')).toEqual([]);
});

test('picked references come first and related files fill the remaining budget', () => {
  const files: Record<string, string> = { '/src/big.ts': 'x'.repeat(MAX_REFERENCE_CHARS - 10), '/src/small.ts': 'y' };
  for (let index = 0; index < MAX_REFERENCES + 2; index++) files[`/src/f${index}.ts`] = 'z';
  const project = { entry: '/src/small.ts', files };
  const { references, skipped } = chatReferences(project, ['/src/big.ts', '/src/missing.ts'], ['/src/big.ts', '/src/small.ts', '/src/f0.ts', ...Object.keys(files).filter(file => file.startsWith('/src/f'))]);
  expect(references[0].file).toBe('/src/big.ts');
  expect(references).toHaveLength(MAX_REFERENCES);
  expect(references.reduce((sum, reference) => sum + reference.source.length, 0)).toBeLessThanOrEqual(MAX_REFERENCE_CHARS);
  expect(skipped).toEqual(['/src/f6.ts', '/src/f7.ts', '/src/f8.ts', '/src/f9.ts']);
});
