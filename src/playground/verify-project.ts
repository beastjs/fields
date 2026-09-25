import { CompilationCoordinator, type CompilerWorker } from './coordinator';
import type { CompilationProject, CompilationResult } from './contracts';

/** Independent worker: checking a proposal cannot replace the live preview. */
export function verifyProject(project: CompilationProject, file: string, createWorker: () => CompilerWorker, signal: AbortSignal): Promise<CompilationResult> {
  return new Promise((resolve, reject) => {
    let checkingFile = false;
    let projectResult: CompilationResult;
    const finish = (error?: Error) => {
      coordinator.dispose();
      signal.removeEventListener('abort', cancel);
      if (error) reject(error); else resolve(projectResult);
    };
    const cancel = () => finish(new Error('Verification cancelled. No files changed.'));
    const onResult = (result: CompilationResult) => {
      if (!checkingFile) projectResult = result;
      const errors = result.diagnostics.filter(diagnostic => diagnostic.severity === 'error');
      if (errors.length || !result.entry) {
        finish(new Error(errors.slice(0, 5).map(diagnostic => `${diagnostic.file}:${diagnostic.start.line}:${diagnostic.start.column} ${diagnostic.message}`).join('\n') || 'Compilation produced no entry.'));
      } else if (!checkingFile && !result.modules.some(module => module.source === file)) {
        // Unimported files are otherwise skipped by the project compiler.
        checkingFile = true;
        coordinator.schedule({ ...project, entry: file }, true);
      } else finish();
    };
    const coordinator = new CompilationCoordinator({ createWorker, onStart: () => {}, onResult, onError: message => finish(new Error(message)) });
    if (signal.aborted) { cancel(); return; }
    signal.addEventListener('abort', cancel, { once: true });
    coordinator.schedule(project, true);
  });
}
