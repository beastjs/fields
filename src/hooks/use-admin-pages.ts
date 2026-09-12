// import { useCallback, useEffect, useRef, useState } from 'octane'
// import { workspaceJson } from '@/lib/accounts/link-client'

// interface Page<T> { page: T[]; isDone: boolean; continueCursor: string }
// interface PageState<T> { path: string; rows: T[] | undefined; cursor: string | null; isDone: boolean; updatedAt: number | null }

// /** Load bounded pages; keep Account and source changes out of cached results. */
// export function useAdminPages<T extends { _id: string }>(path: string) {
//   const [state, setState] = useState<PageState<T>>({ path: '', rows: undefined, cursor: null, isDone: false, updatedAt: null })
//   const [error, setError] = useState<string | null>(null)
//   const [loading, setLoading] = useState(false)
//   const [reload, setReload] = useState(0)
//   const moreController = useRef<AbortController | null>(null)
//   const refresh = useCallback(() => setReload(value => value + 1), [])
//   const pageUrl = `${path}${path.includes('?') ? '&' : '?'}page=1`
//   useEffect(() => {
//     const controller = new AbortController()
//     moreController.current?.abort()
//     setLoading(true)
//     void workspaceJson<Page<T>>(pageUrl, { signal: controller.signal }).then(result => {
//       if (controller.signal.aborted) return
//       setState({ path, rows: result.page, cursor: result.continueCursor, isDone: result.isDone, updatedAt: Date.now() })
//       setError(null)
//     }).catch(error => {
//       if (controller.signal.aborted) return
//       setState({ path, rows: undefined, cursor: null, isDone: true, updatedAt: null })
//       setError(error instanceof Error ? error.message : 'Unable to load submissions.')
//     }).finally(() => { if (!controller.signal.aborted) setLoading(false) })
//     return () => { controller.abort(); moreController.current?.abort() }
//   }, [pageUrl, reload])
//   const loadMore = async () => {
//     if (loading || state.isDone || state.path !== path || !state.cursor) return
//     const controller = new AbortController()
//     moreController.current = controller
//     setLoading(true)
//     try {
//       const result = await workspaceJson<Page<T>>(`${pageUrl}&cursor=${encodeURIComponent(state.cursor)}`, { signal: controller.signal })
//       if (controller.signal.aborted) return
//       setState(previous => ({ path, rows: [...new Map([...(previous.rows ?? []), ...result.page].map(row => [row._id, row])).values()], cursor: result.continueCursor, isDone: result.isDone, updatedAt: Date.now() }))
//       setError(null)
//     } catch (error) {
//       if (!controller.signal.aborted) {
//         setState({ path, rows: undefined, cursor: null, isDone: true, updatedAt: null })
//         setError(error instanceof Error ? error.message : 'Unable to load more submissions.')
//       }
//     } finally { if (!controller.signal.aborted) setLoading(false) }
//   }
//   return { items: state.path === path ? state.rows : undefined, error, isLoading: loading || state.path !== path, lastUpdatedAt: state.updatedAt, refresh, loadMore, hasMore: state.path === path && !state.isDone }
// }
