/**
 * Which of a project's deployments still earn their storage. Pure, so the rule is testable without a database.
 *
 * Kept: the live deployment, the most recent `KEEP_READY` other ready ones (each can be restored in one click), and
 * anything still uploading. Dropped: older ready deployments, and failed uploads once they are old enough that
 * nobody is reading their error in the dialog any more.
 */
export const KEEP_READY = 10
export const FAILED_GRACE_MS = 60 * 60 * 1000

export interface RetentionCandidate {
  _id: string
  status: 'uploading' | 'ready' | 'failed' | 'deleting' | 'deleted'
  createdAt: number
}

/** `deployments` must be newest first. Returns the ids to delete. */
export function deploymentsToDelete<T extends RetentionCandidate>(deployments: readonly T[], liveId: string | undefined, now: number): T[] {
  let keptReady = 0
  return deployments.filter((deployment) => {
    if (deployment._id === liveId) return false
    if (deployment.status === 'ready') return ++keptReady > KEEP_READY
    if (deployment.status === 'failed') return now - deployment.createdAt > FAILED_GRACE_MS
    return false
  })
}
