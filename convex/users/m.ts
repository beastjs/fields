import { v } from 'convex/values'
import { ensureCurrentUser } from '../auth'
import { mutation } from '../_generated/server'

/** Creates or refreshes the signed-in user's row from their verified Firebase identity. */
export const ensureCurrent = mutation({
  args: {},
  returns: v.id('users'),
  handler: async (ctx) => {
    return (await ensureCurrentUser(ctx))._id
  }
})
