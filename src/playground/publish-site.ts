import { PROTOCOL_VERSION, type CompilationProject, type CompilationResult, type WorkerResponse } from './contracts';
import type { CompilerWorker } from './coordinator';
import { buildSite, type SiteBuild } from './site-build';
import { installedThemeCss } from './studio/themes';

const defaultWorker = (): CompilerWorker => new Worker(new URL('./compiler.worker.ts', import.meta.url), { type: 'module' });

/**
 * Compiles a project for publishing in a worker of its own, so the editor's preview build is neither cancelled nor
 * replaced, then packages it with `buildSite`. Rejects with the first compile error.
 */
export async function buildSiteForPublishing(project: CompilationProject, title: string,
  createWorker: () => CompilerWorker = defaultWorker, timeoutMs = 30_000): Promise<SiteBuild> {
  const snapshot = { entry: project.entry, files: { ...project.files } };
  const result = await new Promise<CompilationResult>((resolve, reject) => {
    const worker = createWorker();
    const finish = () => { clearTimeout(timer); worker.terminate(); };
    const timer = setTimeout(() => { finish(); reject(new Error('Compiling for publishing timed out.')); }, timeoutMs);
    worker.onmessage = event => {
      const message = event.data as WorkerResponse;
      if (message?.version !== PROTOCOL_VERSION || message.type !== 'compile-result' || message.id !== 1) return;
      finish();
      resolve(message.result);
    };
    worker.onerror = event => {
      event.preventDefault?.();
      finish();
      reject(new Error(event.message || 'The compiler stopped.'));
    };
    worker.postMessage({ version: PROTOCOL_VERSION, type: 'compile', id: 1, project: snapshot, target: 'site' });
  });
  const error = result.diagnostics.find(diagnostic => diagnostic.severity === 'error');
  if (error) throw new Error(`Fix the compile error before publishing — ${error.file}:${error.start.line}: ${error.message}`);
  return buildSite(result, { title, tokensCss: installedThemeCss(snapshot.files) });
}
