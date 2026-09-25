import { isProject, type CompilationProject } from './contracts';
import { normalizePath, VirtualFileSystem } from './virtual-fs';

export type PreviewWidth = '100%' | '768px' | '375px';
export interface SavedWorkspace {
  version: 1;
  project: CompilationProject;
  activeFile: string;
  preview: { width: PreviewWidth };
}
export interface SaveStatus { label: string; issue?: string }
export interface WorkspaceRestore { workspace?: SavedWorkspace; status: SaveStatus }
export type ProjectStorage = Pick<Storage, 'getItem' | 'setItem'>;
export const PROJECT_STORAGE_KEY = 'beast-playground.project';
// Bounds apply to the serialized UTF-16 string, before JSON parsing or storage.
export const MAX_PROJECT_LENGTH = 2_000_000;
export const MAX_PROJECT_FILES = 200;

const record = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);
export const isPreviewWidth = (value: unknown): value is PreviewWidth =>
  value === '100%' || value === '768px' || value === '375px';

class UnsupportedVersion extends Error {}

/** The wire format is independent of compiler output, editor internals, and UI. */
export function decodeWorkspace(raw: string): SavedWorkspace {
  if (raw.length > MAX_PROJECT_LENGTH) throw new Error('Project is too large.');
  const value: unknown = JSON.parse(raw);
  if (!record(value)) throw new Error('Invalid project record.');
  // Migrate an unversioned CompilationProject snapshot; current saves are v1.
  const legacy = !Object.hasOwn(value, 'version');
  if (!legacy && value.version !== 1) throw new UnsupportedVersion('Unsupported project version.');
  const project = legacy ? value : value.project;
  if (!isProject(project)) throw new Error('Invalid project files.');
  const paths = Object.keys(project.files);
  if (!paths.length || paths.length > MAX_PROJECT_FILES || paths.some(path =>
    path.length > 1024 || !/\.(btsx|tsrx|ts|js|json|css|html|md)$/.test(path))) throw new Error('Invalid project paths.');
  const fs = new VirtualFileSystem(project.files);
  if (fs.list().some(path => path.length > 1024)) throw new Error('Project path is too long.');
  const entry = normalizePath(project.entry);
  if (!fs.exists(entry)) throw new Error('Missing project entry.');
  // Recover stale selection/preferences without dropping otherwise valid source.
  let activeFile = fs.exists('/src/App.btsx') ? '/src/App.btsx' : entry;
  if (typeof value.activeFile === 'string') {
    try { if (fs.exists(value.activeFile)) activeFile = normalizePath(value.activeFile); } catch { /* Use fallback. */ }
  }
  const width = record(value.preview) && isPreviewWidth(value.preview.width) ? value.preview.width : '100%';
  return { version: 1, project: { files: fs.snapshot(), entry }, activeFile, preview: { width } };
}

export function encodeWorkspace(workspace: SavedWorkspace): string {
  // Whitelist persisted fields; never include console output, chat, or generated code.
  const raw = JSON.stringify({ version: 1, project: { entry: workspace.project.entry, files: workspace.project.files },
    activeFile: workspace.activeFile, preview: { width: workspace.preview.width } });
  const normalized = JSON.stringify(decodeWorkspace(raw));
  if (normalized.length > MAX_PROJECT_LENGTH) throw new Error('Project is too large.');
  return normalized;
}

/** Keep the last readable record on failed writes; never overwrite unreadable data automatically. */
export class WorkspaceStore {
  private previous: string | null = null;
  private blocked?: SaveStatus;
  constructor(private storage: () => ProjectStorage) {}

  restore(): WorkspaceRestore {
    this.blocked = undefined;
    try { this.previous = this.storage().getItem(PROJECT_STORAGE_KEY); }
    catch {
      return { status: this.blocked = { label: 'Storage unavailable', issue:
        'Browser storage is unavailable. Changes are only in this tab. Enable storage and reload to restore saved work, or reset the project to start saving.' } };
    }
    if (this.previous === null) return { status: { label: 'Not saved yet' } };
    try { return { workspace: decodeWorkspace(this.previous), status: { label: 'Saved locally' } }; }
    catch (error) {
      return { status: this.blocked = { label: 'Restore failed', issue: error instanceof UnsupportedVersion
        ? 'This saved project uses an unsupported version. It has been kept unchanged. Open it in a compatible version, or reset the project to replace it.'
        : 'The saved project could not be restored and has been kept unchanged. Changes in this tab will not be saved until you reset the project.' } };
    }
  }

  get blockedStatus() { return this.blocked; }

  save(workspace: SavedWorkspace, replace = false): SaveStatus {
    if (this.blocked && !replace) return this.blocked;
    let raw: string;
    try { raw = encodeWorkspace(workspace); }
    catch {
      return { label: 'Not saved', issue: 'This project exceeds local save limits (200 files or 2 million characters), or contains invalid paths. Your last saved project is unchanged. Reduce the project to retry.' };
    }
    try {
      const storage = this.storage();
      if (!replace && storage.getItem(PROJECT_STORAGE_KEY) !== this.previous) {
        return this.blocked = { label: 'Save conflict', issue:
          'Another tab changed the saved project. Changes here are only in this tab. Copy any work you need before reloading, or reset the project to replace the saved copy.' };
      }
      storage.setItem(PROJECT_STORAGE_KEY, raw);
      this.previous = raw;
      this.blocked = undefined;
      return { label: 'Saved locally' };
    } catch {
      return { label: 'Not saved', issue:
        'Browser storage is full or unavailable. Changes are only in this tab; the last saved project is unchanged. Free storage and edit again to retry.' };
    }
  }
}
