import { type FunctionArgs, type FunctionReference, type FunctionReturnType, getFunctionName } from 'convex/server'
import { convexToJson, type Value } from 'convex/values'
import { useSyncExternalStore } from 'octane'
import { convexClient } from '@/lib/convex-client'

type QueryStore<Result> = {
  getSnapshot: () => Result | undefined
  subscribe: (onStoreChange: () => void) => () => void
}

const queryStores = new Map<string, QueryStore<unknown>>()
const skippedQueryStore: QueryStore<never> = {
  getSnapshot: () => undefined,
  subscribe: () => () => {}
}

const getQueryKey = <Query extends FunctionReference<'query'>>(query: Query, args: FunctionArgs<Query>) =>
  `${getFunctionName(query)}:${JSON.stringify(convexToJson(args as Value))}`

const createQueryStore = <Query extends FunctionReference<'query'>>(
  key: string,
  query: Query,
  args: FunctionArgs<Query>
): QueryStore<FunctionReturnType<Query>> => {
  let currentValue: FunctionReturnType<Query> | undefined
  let currentError: Error | null = null
  let unsubscribe: (() => void) | undefined
  const listeners = new Set<() => void>()

  const notify = () => {
    for (const listener of [...listeners]) listener()
  }

  const store: QueryStore<FunctionReturnType<Query>> = {
    getSnapshot: () => {
      if (currentError) throw currentError
      return currentValue
    },
    subscribe: (onStoreChange) => {
      listeners.add(onStoreChange)

      if (!unsubscribe && convexClient) {
        const subscription = convexClient.onUpdate(
          query,
          args,
          (nextValue) => {
            currentValue = nextValue
            currentError = null
            notify()
          },
          (error) => {
            currentError = error
            notify()
          }
        )

        unsubscribe = subscription
        currentValue = subscription.getCurrentValue()
      }

      return () => {
        listeners.delete(onStoreChange)

        if (listeners.size === 0) {
          unsubscribe?.()
          unsubscribe = undefined
          if (queryStores.get(key) === store) queryStores.delete(key)
        }
      }
    }
  }

  return store
}

const getQueryStore = <Query extends FunctionReference<'query'>>(query: Query, args: FunctionArgs<Query>, identityKey: string) => {
  // Octane appends a call-site slot when an optional hook argument is omitted.
  const scope = typeof identityKey === 'string' ? identityKey : ''
  const key = `${scope}:${getQueryKey(query, args)}`
  const existingStore = queryStores.get(key) as QueryStore<FunctionReturnType<Query>> | undefined

  if (existingStore) return existingStore

  const store = createQueryStore(key, query, args)
  queryStores.set(key, store as QueryStore<unknown>)
  return store
}

export function useConvexQuery<Query extends FunctionReference<'query'>>(
  query: Query,
  args: FunctionArgs<Query> | 'skip',
  identityKey = ''
): FunctionReturnType<Query> | undefined {
  const store = args === 'skip' ? skippedQueryStore : getQueryStore(query, args, identityKey)
  return useSyncExternalStore(store.subscribe, store.getSnapshot)
}
