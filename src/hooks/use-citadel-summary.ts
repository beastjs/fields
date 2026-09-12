import { useCallback, useEffect, useState } from 'octane'
import { type AccountRow, fetchAccounts } from '@/lib/citadel/accounts'
import { isAbortError, readErrorMessage } from '@/lib/citadel/errors'
import { fetchGodUsers, type GodUserList } from '@/lib/citadel/gods-users'

export interface CitadelSummary {
  accounts: AccountRow[] | undefined
  roster: GodUserList | undefined
  /** The first failure of the two, or null when both loads succeeded. */
  error: string | null
  isLoading: boolean
  lastUpdatedAt: number | null
  refresh: () => void
}

/**
 * Loads the two lists the Citadel overview reads.
 *
 * They are fetched together but settled independently: the roster scan is the
 * slower and more failure-prone of the two, and losing it should not take the
 * account portfolio down with it.
 */
export function useCitadelSummary(): CitadelSummary {
  const [accounts, setAccounts] = useState<AccountRow[] | undefined>(undefined)
  const [roster, setRoster] = useState<GodUserList | undefined>(undefined)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [lastUpdatedAt, setLastUpdatedAt] = useState<number | null>(null)
  const [reloadToken, setReloadToken] = useState(0)

  const refresh = useCallback(() => setReloadToken((token) => token + 1), [])

  useEffect(() => {
    const controller = new AbortController()
    let cancelled = false

    setIsLoading(true)

    void (async () => {
      const [accountResult, rosterResult] = await Promise.allSettled([
        fetchAccounts(controller.signal),
        fetchGodUsers(controller.signal)
      ])

      if (cancelled) return

      const failures: string[] = []

      if (accountResult.status === 'fulfilled') {
        setAccounts(accountResult.value.accounts)
      } else if (!isAbortError(accountResult.reason)) {
        failures.push(readErrorMessage(accountResult.reason, 'Could not load the account roster.'))
      }

      if (rosterResult.status === 'fulfilled') {
        setRoster(rosterResult.value)
      } else if (!isAbortError(rosterResult.reason)) {
        failures.push(readErrorMessage(rosterResult.reason, 'Could not load the god roster.'))
      }

      setError(failures[0] ?? null)
      setLastUpdatedAt(failures.length === 2 ? null : Date.now())
      setIsLoading(false)
    })()

    return () => {
      cancelled = true
      controller.abort()
    }
  }, [reloadToken])

  return { accounts, roster, error, isLoading, lastUpdatedAt, refresh }
}
