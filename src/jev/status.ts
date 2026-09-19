import type { FetchLike } from '../chat/contracts'

/**
 * Whether the server can evaluate at all.
 *
 * Deliberately its own module, with no dependency on Effect or on the workflows. Both callers — the chat's repair
 * loop and the studio's theme designer — check this *before* deciding to load any of that, so a session that never
 * designs a theme or never has an edit fail pays nothing for either.
 */

export const STATUS_ENDPOINT = '/api/jev/status'
export const EVALUATE_ENDPOINT = '/api/jev/evaluate'

/** Raised instead of calling out when the server has no key, so a caller can fall back rather than show an error. */
export class JevNotConfigured extends Error {
  constructor() {
    super('Structured evaluation is not configured.')
    this.name = 'JevNotConfigured'
  }
}

let status: Promise<boolean> | undefined

/**
 * Asked once per page load and remembered. A failed check resolves false rather than rejecting: an unreachable
 * status endpoint and an unset key mean the same thing to every caller, which is "do it the old way".
 */
export const jevConfigured = (send: FetchLike = fetch): Promise<boolean> =>
  (status ??= Promise.resolve()
    .then(() => send(STATUS_ENDPOINT))
    .then(response => (response.ok ? (response.json() as Promise<{ configured?: boolean }>) : { configured: false }))
    .then(body => !!body.configured)
    .catch(() => false))

/** Forgets the remembered check. For tests, and for a caller that knows the key just changed. */
export const forgetJevStatus = () => { status = undefined }
