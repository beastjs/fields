import { useCallback, useEffect, useState } from 'octane'

export interface AdminListResult<T> {
  error: string | null
  isLoading: boolean
  items: T[] | undefined
  lastUpdatedAt: number | null
  refresh: () => void
}

export interface AdminListOptions {
  /** Worker path to poll, without the query string. */
  path: string
  /** Message shown when the response carries no `error` of its own. */
  fallbackErrorMessage: string
  limit?: number
}

/**
 * Admin rows arrive at field-capture pace, so 30s keeps a table usefully fresh
 * without hammering Convex — each poll reads up to `limit` documents, which is
 * the real cost here. Hidden tabs poll not at all, so an admin who leaves this
 * open all day costs nothing while they are elsewhere.
 */
const POLL_INTERVAL_MS = 30_000

// A failing endpoint should not be retried at full rate.
const MAX_ERROR_INTERVAL_MS = 5 * 60_000

const readErrorMessage = async (response: Response, fallback: string) => {
  const payload: unknown = await response.json().catch(() => null)

  if (typeof payload === 'object' && payload !== null && typeof (payload as { error?: unknown }).error === 'string') {
    return (payload as { error: string }).error
  }

  return fallback
}

/**
 * Polls one of the Worker's admin list endpoints.
 *
 * The admin app authenticates with an HttpOnly session cookie, which the
 * browser cannot turn into a Convex identity — the Worker re-mints an ID token
 * server-side. That rules out a Convex subscription, so freshness comes from
 * polling instead.
 */
export function useAdminList<T>({ fallbackErrorMessage, limit, path }: AdminListOptions): AdminListResult<T> {
  const [items, setItems] = useState<T[] | undefined>(undefined)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [lastUpdatedAt, setLastUpdatedAt] = useState<number | null>(null)
  const [reloadToken, setReloadToken] = useState(0)

  const refresh = useCallback(() => setReloadToken((token) => token + 1), [])

  useEffect(() => {
    let cancelled = false
    let timer: ReturnType<typeof setTimeout> | undefined
    let inFlight = false
    let consecutiveErrors = 0
    let hasLoadedOnce = false

    const url = limit ? `${path}${path.includes('?') ? '&' : '?'}limit=${limit}` : path
    const isHidden = () => typeof document !== 'undefined' && document.visibilityState === 'hidden'

    const nextDelay = () =>
      consecutiveErrors === 0
        ? POLL_INTERVAL_MS
        : Math.min(POLL_INTERVAL_MS * 2 ** consecutiveErrors, MAX_ERROR_INTERVAL_MS)

    const schedule = () => {
      if (cancelled) return
      timer = setTimeout(() => void load(), nextDelay())
    }

    const load = async () => {
      // Never overlap requests: a slow poll must not stack on the next tick.
      if (cancelled || inFlight) return

      // Polling a hidden tab spends Convex reads on nobody. Skip the tick and
      // stay scheduled; the visibility listener fetches the moment it returns.
      // The first load always runs, so a page opened in a background tab has
      // its data ready instead of sitting on a spinner.
      if (hasLoadedOnce && isHidden()) {
        schedule()
        return
      }

      inFlight = true
      hasLoadedOnce = true

      try {
        const response = await fetch(url, { credentials: 'same-origin' })

        if (cancelled) return

        if (!response.ok) {
          consecutiveErrors += 1
          if (response.status === 401 || response.status === 403) setItems(undefined)
          // Keep the last good rows on a failed refresh — only the very first
          // load has nothing to fall back to.
          setError(await readErrorMessage(response, fallbackErrorMessage))
          return
        }

        const payload = (await response.json()) as T[]

        if (cancelled) return

        consecutiveErrors = 0
        setItems(payload)
        setError(null)
        setLastUpdatedAt(Date.now())
      } catch {
        if (!cancelled) {
          consecutiveErrors += 1
          setError('Unable to reach the server.')
        }
      } finally {
        inFlight = false

        if (!cancelled) {
          setIsLoading(false)
          schedule()
        }
      }
    }

    const handleVisibilityChange = () => {
      if (cancelled || document.visibilityState !== 'visible') return

      if (timer) clearTimeout(timer)
      void load()
    }

    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', handleVisibilityChange)
    }

    void load()

    return () => {
      cancelled = true

      if (timer) clearTimeout(timer)
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', handleVisibilityChange)
      }
    }
  }, [fallbackErrorMessage, limit, path, reloadToken])

  return { error, isLoading, items, lastUpdatedAt, refresh }
}
