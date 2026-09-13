import { v } from 'convex/values'
import { getUserByTokenIdentifier, publicUser } from '../auth'
import { query } from '../_generated/server'
import { publicUserValidator } from './v'

export const current = query({
  args: {},
  returns: v.union(publicUserValidator, v.null()),
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) return null
    const user = await getUserByTokenIdentifier(ctx, identity.tokenIdentifier)
    return user ? publicUser(user) : null
  }
})
