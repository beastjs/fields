import type { SavedWorkspace } from '../../playground/project-storage';

export interface ProjectTransfer {
  kind: 'share' | 'import';
  workspace?: SavedWorkspace;
  url?: string;
  error?: string;
  notice?: string;
}
