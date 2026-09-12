import type { UserIdentity } from 'convex/server'
import { ConvexError, v } from 'convex/values'
import { type MutationCtx, mutation } from '../_generated/server'
import { trimOrNull } from '../utils'
import { getCurrentIdentity, getUserByTokenIdentifier } from './q'
import { userUpsertSchema, userValidator } from './v'

export const create = mutation({
  args: userValidator,
  handler: async ({ db }, args) => {
    const user = await db.insert('users', { ...args })
    return user
  }
})

export const update = mutation({
  args: { id: v.id('users'), payload: userValidator },
  handler: async ({ db }, { id, payload }) => {
    const user = await db.get(id)
    if (!user) return null
    return await db.patch(id, { ...payload })
  }
})

export const upsertByTokenIdentifier = mutation({
  args: userUpsertSchema,
  handler: async ({ db }, args) => {
    const existingUser = await db
      .query('users')
      .withIndex('by_tokenIdentifier', (q) => q.eq('tokenIdentifier', args.tokenIdentifier))
      .unique()

    const now = Date.now()

    if (existingUser) {
      await db.patch(existingUser._id, {
        ...args,
        updatedAt: now
      })

      return existingUser._id
    }

    return await db.insert('users', {
      ...args,
      createdAt: now,
      updatedAt: now
    })
  }
})
function identityToUserData(identity: UserIdentity, now: number) {
  const trimOrUndefined = (value: string | undefined) => trimOrNull(value) ?? undefined

  return {
    tokenIdentifier: identity.tokenIdentifier,
    firebaseUid: identity.subject,
    subject: identity.subject,
    issuer: identity.issuer,
    name: trimOrUndefined(identity.name),
    nickname: trimOrNull(identity.nickname),
    preferredUsername: trimOrNull(identity.preferredUsername),
    imageUrl: trimOrUndefined(identity.pictureUrl),
    email: trimOrUndefined(identity.email),
    phone: trimOrNull(identity.phoneNumber),
    emailVerified: identity.emailVerified ?? null,
    createdAt: now,
    updatedAt: now
  }
}
async function upsertCurrentUser(ctx: MutationCtx) {
  const identity = await getCurrentIdentity(ctx)
  if (!identity) {
    throw new ConvexError('Unauthenticated.')
  }

  const existingUser = await getUserByTokenIdentifier(ctx, identity.tokenIdentifier)
  const now = Date.now()
  const userData = identityToUserData(identity, now)

  if (existingUser) {
    await ctx.db.patch(existingUser._id, {
      ...userData,
      createdAt: existingUser.createdAt ?? 0
    })
    return existingUser._id
  }

  return await ctx.db.insert('users', userData)
}

/** Creates or refreshes the signed-in user's row from their verified identity. */
export const ensureCurrent = mutation({
  args: {},
  returns: v.id('users'),
  handler: async (ctx) => {
    return await upsertCurrentUser(ctx)
  }
})
