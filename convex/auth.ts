import type { UserIdentity } from 'convex/server'
import { ConvexError } from 'convex/values'
import type { Doc, Id } from './_generated/dataModel'
import type { MutationCtx, QueryCtx } from './_generated/server'
import { trimOrNull } from './utils'

type DatabaseCtx = QueryCtx | MutationCtx

export function appError(code: string, message: string): never {
  throw new ConvexError({ code, message })
}

export async function getUserByTokenIdentifier(ctx: DatabaseCtx, tokenIdentifier: string) {
  return await ctx.db
    .query('users')
    .withIndex('by_tokenIdentifier', (q) => q.eq('tokenIdentifier', tokenIdentifier))
    .unique()
}

export async function requireIdentity(ctx: Pick<QueryCtx, 'auth'>) {
  const identity = await ctx.auth.getUserIdentity()
  if (!identity) return appError('UNAUTHENTICATED', 'Sign in to continue.')
  return identity
}

export async function requireCurrentUser(ctx: DatabaseCtx) {
  const identity = await requireIdentity(ctx)
  const user = await getUserByTokenIdentifier(ctx, identity.tokenIdentifier)
  if (!user) return appError('USER_NOT_PROVISIONED', 'Finish signing in before accessing cloud data.')
  return user
}

function identityToUserData(identity: UserIdentity, now: number) {
  const trimOrUndefined = (value: string | undefined) => trimOrNull(value) ?? undefined
  const email = trimOrUndefined(identity.email)?.toLowerCase()

  return {
    tokenIdentifier: identity.tokenIdentifier,
    firebaseUid: identity.subject,
    subject: identity.subject,
    issuer: identity.issuer,
    name: trimOrUndefined(identity.name),
    nickname: trimOrNull(identity.nickname),
    preferredUsername: trimOrNull(identity.preferredUsername),
    imageUrl: trimOrUndefined(identity.pictureUrl),
    email,
    phone: trimOrNull(identity.phoneNumber),
    emailVerified: identity.emailVerified ?? null,
    createdAt: now,
    updatedAt: now
  }
}

export async function ensureCurrentUser(ctx: MutationCtx) {
  const identity = await requireIdentity(ctx)
  const existing = await getUserByTokenIdentifier(ctx, identity.tokenIdentifier)
  const now = Date.now()
  const userData = identityToUserData(identity, now)

  if (existing) {
    await ctx.db.patch(existing._id, { ...userData, createdAt: existing.createdAt })
    return (await ctx.db.get(existing._id))!
  }

  const userId = await ctx.db.insert('users', userData)
  return (await ctx.db.get(userId))!
}

export async function getTeamMembership(ctx: DatabaseCtx, teamId: Id<'teams'>, userId: Id<'users'>) {
  return await ctx.db
    .query('teamMembers')
    .withIndex('by_teamId_and_userId', (q) => q.eq('teamId', teamId).eq('userId', userId))
    .unique()
}

export async function requireTeamMember(ctx: DatabaseCtx, teamId: Id<'teams'>) {
  const user = await requireCurrentUser(ctx)
  const team = await ctx.db.get(teamId)
  if (!team || team.archivedAt !== undefined) return appError('NOT_FOUND', 'Team not found.')
  const membership = await getTeamMembership(ctx, teamId, user._id)
  if (!membership) return appError('FORBIDDEN', 'You do not have access to this team.')
  return { user, team, membership }
}

export async function requireTeamAdmin(ctx: DatabaseCtx, teamId: Id<'teams'>) {
  const access = await requireTeamMember(ctx, teamId)
  if (access.membership.role === 'member') {
    return appError('FORBIDDEN', 'Team owner or admin access is required.')
  }
  return access
}

export async function requireProjectMember(ctx: DatabaseCtx, projectId: Id<'projects'>) {
  const project = await ctx.db.get(projectId)
  if (!project || project.archivedAt !== undefined) return appError('NOT_FOUND', 'Project not found.')
  const access = await requireTeamMember(ctx, project.teamId)
  return { ...access, project }
}

export function publicUser(user: Doc<'users'>) {
  return {
    _id: user._id,
    _creationTime: user._creationTime,
    name: user.name,
    email: user.email,
    imageUrl: user.imageUrl,
    nickname: user.nickname,
    preferredUsername: user.preferredUsername,
    emailVerified: user.emailVerified,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt
  }
}
