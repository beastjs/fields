const extensions = ['.btsx', '.tsrx', '.ts', '.js', '.json', '.css'];

/** A deterministic, root-confined POSIX filesystem; independent of the host OS. */
export function normalizePath(path: string): string {
  if (!path || /[\0?#:]/.test(path)) throw new Error(`Invalid project path: ${path}`);
  const parts: string[] = [];
  for (const part of path.replaceAll('\\', '/').split('/')) {
    if (!part || part === '.') continue;
    if (part === '..') {
      if (!parts.length) throw new Error(`Path escapes the project: ${path}`);
      parts.pop();
    } else parts.push(part);
  }
  if (!parts.length) throw new Error('A file path is required.');
  return `/${parts.join('/')}`;
}

export class VirtualFileSystem {
  private files = new Map<string, string>();

  constructor(files: Record<string, string> = {}) {
    for (const path of Object.keys(files).sort()) {
      const normalized = normalizePath(path);
      if (this.files.has(normalized)) throw new Error(`Duplicate normalized path: ${normalized}`);
      this.files.set(normalized, files[path]);
    }
  }
  read(path: string) { return this.files.get(normalizePath(path)); }
  write(path: string, content: string) { this.files.set(normalizePath(path), content); }
  delete(path: string) { return this.files.delete(normalizePath(path)); }
  exists(path: string) { return this.files.has(normalizePath(path)); }
  list() { return [...this.files.keys()].sort(); }
  snapshot(): Record<string, string> { return Object.fromEntries(this.list().map(path => [path, this.files.get(path)!])); }

  resolve(request: string, importer = '/entry.js'): string {
    if (!request.startsWith('.') && !request.startsWith('/')) {
      throw new Error(`Package "${request}" is not included in this playground.`);
    }
    const directory = importer.slice(0, importer.lastIndexOf('/') + 1);
    const base = normalizePath(request.startsWith('/') ? request : directory + request);
    const candidates = [base, ...extensions.map(ext => base + ext),
      ...extensions.map(ext => `${base}/index${ext}`)];
    // Production Beast projects may author generated .tsrx imports for BTSX files.
    if (base.endsWith('.tsrx')) candidates.push(base.slice(0, -5) + '.btsx');
    const found = candidates.find(path => this.files.has(path));
    if (!found) throw new Error(`Cannot resolve "${request}" from ${importer}.`);
    return found;
  }
}
