import { getConvexAuthState, subscribeToConvexAuthState } from '@/lib/convex-client'
import { useSyncExternalStore } from 'octane'

export function useConvexAuth() {
  return useSyncExternalStore(subscribeToConvexAuthState, getConvexAuthState)
}
