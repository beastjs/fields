import type { Position } from '../playground/contracts';
import type { PlaygroundSession } from '../playground/session';
import type { WorkspaceLayout } from '../playground/workspace-layout';
import type { CloudProjectController } from '../playground/cloud-project-persistence';

export interface SessionProps { session: PlaygroundSession }
export interface WorkspaceProps extends SessionProps { layout: WorkspaceLayout; cloud?: CloudProjectController }
export type NavigateToSource = (file: string, position?: Position) => void;
