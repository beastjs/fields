import { describe, expect, test } from 'bun:test'
import { deploymentsToDelete, FAILED_GRACE_MS, KEEP_READY, type RetentionCandidate } from '../convex/deploymentRetention'

const NOW = 1_000_000_000
const make = (count: number, status: RetentionCandidate['status'], ageStep = 1000): RetentionCandidate[] =>
  Array.from({ length: count }, (_, index) => ({ _id: `${status}-${index}`, status, createdAt: NOW - index * ageStep }))
const ids = (list: RetentionCandidate[]) => list.map((deployment) => deployment._id)

describe('deployment retention', () => {
  test('keeps the newest ready deployments and drops the rest', () => {
    const ready = make(KEEP_READY + 3, 'ready')
    expect(ids(deploymentsToDelete(ready, undefined, NOW))).toEqual([`ready-${KEEP_READY}`, `ready-${KEEP_READY + 1}`, `ready-${KEEP_READY + 2}`])
  })

  test('never deletes the live deployment, and it does not use up a kept slot', () => {
    const ready = make(KEEP_READY + 2, 'ready')
    const live = ready.at(-1)!._id
    const doomed = ids(deploymentsToDelete(ready, live, NOW))
    expect(doomed).not.toContain(live)
    expect(doomed).toEqual([`ready-${KEEP_READY}`])
    // A live deployment first in line leaves room for KEEP_READY others after it.
    expect(deploymentsToDelete(make(KEEP_READY + 1, 'ready'), 'ready-0', NOW)).toEqual([])
  })

  test('drops failed uploads only after their grace period', () => {
    const failed = [
      { _id: 'fresh', status: 'failed' as const, createdAt: NOW - FAILED_GRACE_MS + 1 },
      { _id: 'old', status: 'failed' as const, createdAt: NOW - FAILED_GRACE_MS - 1 }
    ]
    expect(ids(deploymentsToDelete(failed, undefined, NOW))).toEqual(['old'])
  })

  test('leaves uploads in flight and anything already on its way out alone', () => {
    const others = [...make(3, 'uploading'), ...make(3, 'deleting'), ...make(3, 'deleted')]
    expect(deploymentsToDelete(others, undefined, NOW + 10 * FAILED_GRACE_MS)).toEqual([])
  })
})
