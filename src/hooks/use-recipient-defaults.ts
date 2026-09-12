// import { useEffect, useState } from 'octane'
// import { accountEndpoint } from './use-workspace'
// import { workspaceJson } from '@/lib/accounts/link-client'
// import type { RecipientDefaults } from '@/lib/verifications/recipient-defaults'

// export function useRecipientDefaults(accountId: string | undefined, enabled = true) {
//   const [state, setState] = useState<{ accountId: string; settings: RecipientDefaults } | null>(null)
//   const [error, setError] = useState<string | null>(null)
//   const [revision, setRevision] = useState(0)
//   useEffect(() => {
//     if (!accountId || !enabled) { setState(null); return }
//     const controller = new AbortController()
//     setState(null)
//     setError(null)
//     void workspaceJson<RecipientDefaults>(accountEndpoint('/api/admin/recipient-defaults', accountId), { signal: controller.signal }).then(settings => {
//       if (!controller.signal.aborted) setState({ accountId, settings })
//     }).catch(failure => {
//       if (!controller.signal.aborted) setError(failure instanceof Error ? failure.message : 'Could not load recipient defaults.')
//     })
//     return () => controller.abort()
//   }, [accountId, enabled, revision])
//   return { settings: enabled && state && state.accountId === accountId ? state.settings : null, error, refresh: () => setRevision(value => value + 1) }
// }
