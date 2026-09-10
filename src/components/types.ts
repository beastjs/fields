import type { Position } from '../playground/contracts';
import type { PlaygroundSession } from '../playground/session';
import type { WorkspaceLayout } from '../playground/workspace-layout';

export interface SessionProps { session: PlaygroundSession }
export interface WorkspaceProps extends SessionProps { layout: WorkspaceLayout }
export type NavigateToSource = (file: string, position?: Position) => void;
