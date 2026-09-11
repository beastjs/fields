import type { CompilationProject } from './contracts';

export const MAX_COMPILE_FILES = 200;
export const MAX_COMPILE_CHARACTERS = 2_000_000;

/** Count source/path UTF-16 units before cloning or parsing the project. */
export function compilationLimitError(project: CompilationProject): string | undefined {
  let count = 0;
  let characters = project.entry.length;
  for (const path in project.files) {
    if (!Object.hasOwn(project.files, path)) continue;
    if (++count > MAX_COMPILE_FILES) return 'Compilation limit exceeded (200 files). Remove files and run again.';
    characters += path.length + project.files[path].length;
    if (characters > MAX_COMPILE_CHARACTERS) return 'Compilation limit exceeded (2 million source/path characters). Reduce source size and run again.';
  }
}
