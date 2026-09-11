/** All public source positions are one-based UTF-16 coordinates. */
export interface Position { line: number; column: number }
export interface Diagnostic {
  file: string;
  message: string;
  severity: 'error' | 'warning' | 'info';
  start: Position;
  end?: Position;
  code?: string;
  source: 'beast' | 'octane' | 'web' | 'runtime';
}
export interface CompilationProject {
  files: Record<string, string>;
  entry: string;
}
export interface CompiledModule {
  id: string;
  code: string;
  source?: string;
  sourceMap?: string;
  /** Compiler-owned boundary facts; used to decide whether a live update is safe. */
  hot?: { imports: string[]; exports: string[]; kind: 'component' | 'style' };
}
export interface CompiledAsset { id: string; content: string; type: string }
export interface CompilationResult {
  modules: CompiledModule[];
  assets: CompiledAsset[];
  diagnostics: Diagnostic[];
  entry?: string;
  intermediate: Record<string, string>;
  metadata: {
    duration: number;
    modules: number;
    transformedFiles: number;
    compilerVersion: string;
    timings: { beast: number; octane: number; web: number };
  };
}
export interface PlaygroundCompiler {
  compile(project: CompilationProject): Promise<CompilationResult>;
}
export const PROTOCOL_VERSION = 1;
export type WorkerRequest = {
  version: typeof PROTOCOL_VERSION;
  type: 'compile';
  id: number;
  project: CompilationProject;
};
export type WorkerResponse = {
  version: typeof PROTOCOL_VERSION;
  type: 'compile-result';
  id: number;
  result: CompilationResult;
};

export function isProject(value: unknown): value is CompilationProject {
  if (!value || typeof value !== 'object') return false;
  const project = value as CompilationProject;
  return typeof project.entry === 'string' && !!project.files &&
    typeof project.files === 'object' && !Array.isArray(project.files) &&
    Object.values(project.files).every(source => typeof source === 'string');
}
