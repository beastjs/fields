import type { api } from '../../convex/_generated/api'
import { useConvexQuery } from '@/hooks/use-convex-query'

/**
 * The invitation query and the mutation that claims one.
 *
 * These live here rather than in `invitations.btsx` because a `.btsx` module
 * cannot export to another module, and the account page needs the same query to
 * decide whether the invitations section is worth showing at all. `useConvexQuery`
 * keys its stores by function name and arguments, so both callers share one
 * subscription.
 */
export const listMyInvitationsQuery =
  'accountMembers/q:listMyInvitations' as unknown as typeof api.accountMembers.q.listMyInvitations

export const acceptInviteMutation =
  'accountMembers/m:acceptInvite' as unknown as typeof api.accountMembers.m.acceptInvite

/**
 * Invitations awaiting the signed-in viewer. `undefined` while the first read is
 * in flight, and for an unverified address — the query only resolves for a
 * verified one, so it is skipped rather than asked.
 */
export function useAccountInvitations(isEmailVerified: boolean) {
  return useConvexQuery(listMyInvitationsQuery, isEmailVerified ? {} : 'skip')
}
