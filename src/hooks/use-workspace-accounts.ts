// import { useCallback, useEffect, useMemo, useState } from 'octane'
// import type { WorkspaceAccount } from '@/hooks/use-workspace'

// export interface WorkspaceAccountsResult {
//   /** Null until the first read settles, so callers can tell loading from empty. */
//   accounts: WorkspaceAccount[] | null
//   /** The selected row, or null while nothing is chosen. */
//   account: WorkspaceAccount | null
//   error: string
//   /** Ready for `SelectOctane`: `{ label, value }` over account ids. */
//   options: { label: string; value: string }[]
//   retry: () => void
//   selectAccount: (id: string) => void
//   selectedId: string
// }

// const EMPTY_OPTIONS: { label: string; value: string }[] = []

// /**
//  * Reads the Accounts this admin session can act on, and remembers the chosen
//  * one per uid. Lives outside the provider so the sidebar can render the picker
//  * while the content panel renders the selected Account's routes.
//  */
// export function useWorkspaceAccounts(uid: string): WorkspaceAccountsResult {
//   const [accounts, setAccounts] = useState<WorkspaceAccount[] | null>(null)
//   const [selectedId, setSelectedId] = useState('')
//   const [error, setError] = useState('')
//   const [reload, setReload] = useState(0)
//   const storageKey = `livesnaps:workspace:${uid}`

//   useEffect(() => {
//     // The shell renders before the session read settles; an empty uid means
//     // there is no cookie'd session to list Accounts for yet.
//     if (!uid) return

//     const controller = new AbortController()

//     void (async () => {
//       try {
//         const response = await fetch('/api/admin/accounts', { credentials: 'same-origin', signal: controller.signal })
//         if (!response.ok) throw new Error('Unable to load your Accounts. Sign in again or retry.')
//         const rows = await response.json() as WorkspaceAccount[]
//         if (controller.signal.aborted) return

//         let saved = ''
//         try { saved = sessionStorage.getItem(storageKey) ?? '' } catch {}

//         setAccounts(rows)
//         setSelectedId(rows.some(row => row.id === saved) ? saved : rows.length === 1 ? rows[0].id : '')
//         setError('')
//       } catch (error) {
//         if (!controller.signal.aborted) setError(error instanceof Error ? error.message : 'Unable to load Accounts.')
//       }
//     })()

//     return () => controller.abort()
//   }, [uid, storageKey, reload])

//   const selectAccount = useCallback((id: string) => {
//     setSelectedId(id)
//     try { sessionStorage.setItem(storageKey, id) } catch {}
//   }, [storageKey])

//   const retry = useCallback(() => setReload(value => value + 1), [])

//   const options = useMemo(
//     () => accounts?.map(row => ({ label: row.name || row.slug || row.id, value: row.id })) ?? EMPTY_OPTIONS,
//     [accounts]
//   )

//   const account = accounts?.find(row => row.id === selectedId) ?? null

//   return { account, accounts, error, options, retry, selectAccount, selectedId }
// }
