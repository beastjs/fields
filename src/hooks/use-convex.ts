import { type ConvexAuthState, convexClient, getConvexAuthState, subscribeToConvexAuthState } from '@/lib/convex-client'
import type { ConvexClient } from 'convex/browser'
import { useSyncExternalStore } from 'octane'

/**
 * Octane replacement for `useConvex` from `convex/react`.
 *
 * The client is a module singleton created in `@/lib/convex-client`, so there is
 * no provider to read from. It is `null` when `PUBLIC_CONVEX_URL` is unset, and
 * callers must handle that.
 */
export function useConvex(): ConvexClient | null {
  return convexClient
}

/**
 * Octane replacement for `useConvexAuth` from `convex/react`.
 *
 * `isLoading` stays true while Firebase has a user whose token Convex has not
 * validated yet. It settles to false with `isAuthenticated: false` when nobody
 * is signed in or Convex rejects the token.
 */
export function useConvexAuth(): ConvexAuthState {
  return useSyncExternalStore(subscribeToConvexAuthState, getConvexAuthState, getConvexAuthState)
}
