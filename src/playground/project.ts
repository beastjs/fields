import type { CompilationProject } from './contracts';
import { normalizePath, VirtualFileSystem } from './virtual-fs';

/** File operations and selection policy, independent of rendering and compilation. */
export class PlaygroundProject {
  readonly fs: VirtualFileSystem;
  readonly entry: string;
  activeFile: string;

  constructor(project: CompilationProject) {
    this.fs = new VirtualFileSystem(project.files);
    this.entry = normalizePath(project.entry);
    if (!this.fs.exists(this.entry)) throw new Error('The project entry must exist.');
    this.activeFile = this.fs.exists('/src/App.btsx') ? '/src/App.btsx' : this.entry;
  }

  snapshot(): CompilationProject { return { files: this.fs.snapshot(), entry: this.entry }; }
  open(path: string) {
    const normalized = normalizePath(path);
    if (!this.fs.exists(normalized)) return false;
    this.activeFile = normalized;
    return true;
  }
  newFilePath(input: string) {
    const name = input.trim().replaceAll('\\', '/');
    if (!name) throw new Error('A file path is required.');
    const path = normalizePath(name.startsWith('/') ? name : `/${name.startsWith('src/') ? '' : 'src/'}${name}`);
    if (!/\.(btsx|tsrx|ts|js|json|css)$/.test(path)) throw new Error('Use .btsx, .tsrx, .ts, .js, .json, or .css.');
    if (this.fs.exists(path)) throw new Error('That file already exists.');
    return path;
  }
  add(input: string) {
    const path = this.newFilePath(input);
    this.fs.write(path, path.endsWith('.btsx') ? 'p A new component\n' : path.endsWith('.json') ? '{}\n' : '');
    this.activeFile = path;
    return path;
  }
  remove(path: string) {
    const normalized = normalizePath(path);
    if (normalized === this.entry || !this.fs.delete(normalized)) return false;
    if (this.activeFile === normalized) this.activeFile = this.fs.list()[0];
    return true;
  }
}
