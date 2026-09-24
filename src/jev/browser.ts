import { Effect } from 'effect'
import type { FetchLike } from '../chat/contracts'
import { Jev, layer, type JevFailure } from './client'
import { EVALUATE_ENDPOINT, JevNotConfigured, jevConfigured } from './status'

/**
 * Running a Jev workflow from the browser.
 *
 * The browser never holds the key: every evaluation goes to the playground's own `/api/jev/evaluate`, which adds it
 * server-side. That is the whole difference between this layer and the server's, and the reason the workflows in
 * `chat.ts`, `studio.ts` and `theme.ts` do not know which one they are running under.
 *
 * This module reaches Effect, so it is always loaded on demand — behind `jevConfigured` from `status.ts`, which
 * does not. Keeping the two apart is what keeps Effect out of the initial bundle.
 */

/**
 * Run a workflow and get a promise. Rejects with `JevNotConfigured` when there is no key to run it with.
 *
 * The `Jev` requirement is discharged here and only here, which is what keeps `Effect.runPromise` out of the
 * workflows themselves and leaves them composable.
 */
export async function runJev<A>(workflow: Effect.Effect<A, JevFailure, Jev>, send?: FetchLike, signal?: AbortSignal): Promise<A> {
  if (!(await jevConfigured(send))) throw new JevNotConfigured()
  signal?.throwIfAborted()
  return Effect.runPromise(
    Effect.provide(workflow, layer({ endpoint: EVALUATE_ENDPOINT, ...(send ? { fetch: send } : {}) })),
    { signal }
  )
}
