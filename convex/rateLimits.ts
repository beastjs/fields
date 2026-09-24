import { HOUR, RateLimiter } from '@convex-dev/rate-limiter'
import { components } from './_generated/api'
import type { MutationCtx } from './_generated/server'
import { appError } from './auth'

/**
 * Per-user limits on publishing work. Token buckets allow a burst of iteration, then about one every two minutes;
 * together they bound the storage and Worker traffic one account can cause.
 */
const rateLimiter = new RateLimiter(components.rateLimiter, {
  publish: { kind: 'token bucket', rate: 30, period: HOUR, capacity: 10 },
  claimSlug: { kind: 'token bucket', rate: 30, period: HOUR, capacity: 10 }
})

const labels = { publish: 'publishing', claimSlug: 'changing addresses' } as const

/** Consumes one token, or refuses with a message that says when to retry. */
export async function enforceRateLimit(ctx: MutationCtx, name: keyof typeof labels, key: string) {
  const status = await rateLimiter.limit(ctx, name, { key })
  if (status.ok) return
  const minutes = Math.max(1, Math.ceil(status.retryAfter / 60_000))
  appError('RATE_LIMITED', `You're ${labels[name]} too often. Try again in ${minutes} minute${minutes === 1 ? '' : 's'}.`)
}
