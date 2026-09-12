// import { createContext, use } from 'octane'
// import type { listWorkspaceAccounts } from '@/server/workspace-routes'

// export type WorkspaceAccount = Awaited<ReturnType<typeof listWorkspaceAccounts>>[number]
// export const WorkspaceContext = createContext<WorkspaceAccount | null>(null)
// export function useWorkspace() { return use(WorkspaceContext) }

// export function accountEndpoint(path: string, accountId: string) {
//   return `${path}${path.includes('?') ? '&' : '?'}accountId=${encodeURIComponent(accountId)}`
// }
