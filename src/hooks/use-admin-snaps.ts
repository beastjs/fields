// import { useAdminList } from '@/hooks/use-admin-list'
// import type { AdminSnapListItem } from '@/lib/snaps/admin-photo-types'
// import { accountEndpoint, useWorkspace } from './use-workspace'

// export interface AdminSnapsResult {
//   error: string | null
//   isLoading: boolean
//   lastUpdatedAt: number | null
//   refresh: () => void
//   snaps: AdminSnapListItem[] | undefined
// }

// export function useAdminSnaps(limit?: number, sourceLinkId?: string): AdminSnapsResult {
//   const account = useWorkspace()
//   // Octane appends a call-site slot when an optional hook argument is omitted.
//   const linkId = typeof sourceLinkId === 'string' ? sourceLinkId : ''
//   const { error, isLoading, items, lastUpdatedAt, refresh } = useAdminList<AdminSnapListItem>({
//     fallbackErrorMessage: 'Unable to load snaps.',
//     limit,
//     path: accountEndpoint(`/api/admin/snaps${linkId ? `?sourceLinkId=${encodeURIComponent(linkId)}` : ''}`, account?.id ?? '')
//   })

//   return { error, isLoading, lastUpdatedAt, refresh, snaps: items }
// }
