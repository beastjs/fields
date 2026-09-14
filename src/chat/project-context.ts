import type { CompilationProject } from '../playground/contracts';
import { VirtualFileSystem } from '../playground/virtual-fs';
import { MAX_REFERENCE_CHARS, MAX_REFERENCES, type FileContext } from './contracts';

// Static imports only, including multi-line and side-effect forms; indented `module` imports count too.
const IMPORT = /^[ \t]*import\s+(?:[^'"]*?\s+from\s+)?['"]([^'"]+)['"]/gm;

/** Project files `file` imports, resolved the way the compiler resolves them. */
function localImports(fs: VirtualFileSystem, file: string, source: string) {
  const found = new Set<string>();
  for (const [, request] of source.matchAll(IMPORT)) {
    if (!request.startsWith('.') && !request.startsWith('/')) continue;
    try { found.add(fs.resolve(request, file)); } catch { /* Unresolved imports already surface as compiler problems. */ }
  }
  found.delete(file);
  return found;
}

/** Files that give the chat context for `file`: the modules it imports, then the modules that import it. */
export function relatedFiles(project: CompilationProject, file: string) {
  if (project.files[file] === undefined) return [];
  const fs = new VirtualFileSystem(project.files);
  const related = new Set(localImports(fs, file, project.files[file]));
  for (const [path, source] of Object.entries(project.files)) {
    if (path !== file && localImports(fs, path, source).has(file)) related.add(path);
  }
  return [...related];
}

/**
 * Read-only files for one chat request. Files the person picked always come first; related files
 * fill the remaining count and size budget, and any that do not fit are reported as skipped.
 */
export function chatReferences(project: CompilationProject, picked: string[], related: string[]) {
  const references: FileContext[] = [];
  const skipped: string[] = [];
  let characters = 0;
  for (const file of picked) {
    const source = project.files[file];
    if (source === undefined || references.some(reference => reference.file === file)) continue;
    references.push({ file, source });
    characters += source.length;
  }
  for (const file of related) {
    const source = project.files[file];
    if (source === undefined || references.some(reference => reference.file === file)) continue;
    if (references.length >= MAX_REFERENCES || characters + source.length > MAX_REFERENCE_CHARS) { skipped.push(file); continue; }
    references.push({ file, source });
    characters += source.length;
  }
  return { references, skipped };
}
