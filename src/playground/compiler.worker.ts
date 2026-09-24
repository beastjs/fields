import { compileProject } from './compiler';
import { isProject, PROTOCOL_VERSION, type WorkerRequest, type WorkerResponse } from './contracts';
import { normalizeError } from './diagnostics';

self.addEventListener('message', async (event: MessageEvent<WorkerRequest>) => {
  const request = event.data;
  if (request?.version !== PROTOCOL_VERSION || request.type !== 'compile' ||
      !Number.isSafeInteger(request.id) || !isProject(request.project) ||
      (request.target !== undefined && request.target !== 'preview' && request.target !== 'site')) return;
  try {
    const result = await compileProject(request.project, request.target);
    self.postMessage({ version: PROTOCOL_VERSION, type: 'compile-result', id: request.id, result } satisfies WorkerResponse);
  } catch (error) {
    self.postMessage({ version: PROTOCOL_VERSION, type: 'compile-result', id: request.id,
      result: { modules: [], assets: [], intermediate: {}, diagnostics: [normalizeError(error, request.project.entry, 'web')],
        metadata: { duration: 0, modules: 0, transformedFiles: 0, compilerVersion: 'unknown', timings: { beast: 0, octane: 0, web: 0 } } } } satisfies WorkerResponse);
  }
});
