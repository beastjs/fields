import { helloWorld } from './examples';
import { readEditorKeymap, writeEditorKeymap } from './editor-preferences';
import { PlaygroundSession } from './session';

/** Browser dependencies live at the composition boundary, outside project state. */
export function createPlaygroundSession() {
  return new PlaygroundSession({
    project: helloWorld,
    keymap: readEditorKeymap(),
    persistKeymap: writeEditorKeymap,
    createWorker: () => new Worker(new URL('./compiler.worker.ts', import.meta.url), { type: 'module' }),
  });
}
