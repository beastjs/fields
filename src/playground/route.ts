/**
 * The app's two top-level routes.
 *
 * `/` is the signed-out landing page and the workspace for anybody signed in; `/playground` always
 * opens the workspace, signed in or not. Navigation only ever changes the pathname and leaves the
 * query string alone, because the workspace stores its layout there (see `panel-query.ts`).
 *
 * Serving `/playground` needs the host to fall back to index.html for unknown paths. The Rsbuild dev
 * and preview servers already do; a static host needs a SPA rewrite rule.
 */
export type AppRoute = 'landing' | 'playground'

const PLAYGROUND_PATH = '/playground'

/** Anything that is not the playground path belongs to the landing page. */
export const routeOf = (pathname: string): AppRoute =>
  pathname.replace(/\/+$/, '').toLowerCase() === PLAYGROUND_PATH ? 'playground' : 'landing'

export const pathOf = (route: AppRoute): string => (route === 'playground' ? PLAYGROUND_PATH : '/')

const listeners = new Set<() => void>()
let current: AppRoute = typeof location === 'undefined' ? 'landing' : routeOf(location.pathname)

/** Identity-stable, so `useSyncExternalStore` never sees a changed snapshot for an unchanged route. */
export const getRoute = (): AppRoute => current

export function subscribeToRoute(onStoreChange: () => void): () => void {
  listeners.add(onStoreChange)
  return () => {
    listeners.delete(onStoreChange)
  }
}

const publish = (next: AppRoute) => {
  if (next === current) return
  current = next
  for (const listener of listeners) listener()
}

/** Moves between routes in place, keeping the query string and hash the current URL already carries. */
export function navigateTo(route: AppRoute): void {
  if (route === current) return
  history.pushState(null, '', pathOf(route) + location.search + location.hash)
  publish(route)
}

if (typeof window !== 'undefined') {
  // Back and forward move between the landing page and the workspace without a reload.
  window.addEventListener('popstate', () => publish(routeOf(location.pathname)))
}
