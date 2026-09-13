import { paginationOptsValidator, paginationResultValidator } from 'convex/server'
import { ConvexError, v } from 'convex/values'
import {
  appError,
  ensureCurrentUser,
  getTeamMembership,
  publicUser,
  requireCurrentUser,
  requireTeamAdmin,
  requireTeamMember
} from './auth'
import { mutation, query } from './_generated/server'
import schema from './schema'
import { publicUserValidator } from './users/v'
import { optionalTrimmed, requireTrimmed } from './utils'
import { invitationRoleValidator, teamRoleValidator } from './validators'

const teamListItemValidator = v.object({
  team: schema.doc('teams'),
  role: teamRoleValidator,
  joinedAt: v.number()
})

const teamDetailsValidator = v.object({
  team: schema.doc('teams'),
  membership: schema.doc('teamMembers')
})

const memberListItemValidator = v.object({
  membership: schema.doc('teamMembers'),
  user: publicUserValidator
})

export const create = mutation({
  args: { name: v.string(), description: v.optional(v.string()) },
  returns: teamDetailsValidator,
  handler: async (ctx, args) => {
    const user = await ensureCurrentUser(ctx)
    const now = Date.now()
    const teamId = await ctx.db.insert('teams', {
      name: requireTrimmed(args.name, 'Team name', 100),
      description: optionalTrimmed(args.description, 'Team description', 2_000),
      kind: 'shared',
      createdBy: user._id,
      createdAt: now,
      updatedAt: now
    })
    const membershipId = await ctx.db.insert('teamMembers', {
      teamId,
      userId: user._id,
      role: 'owner',
      joinedAt: now
    })
    return { team: (await ctx.db.get(teamId))!, membership: (await ctx.db.get(membershipId))! }
  }
})

export const listMine = query({
  args: { paginationOpts: paginationOptsValidator },
  returns: paginationResultValidator(teamListItemValidator),
  handler: async (ctx, args) => {
    const user = await requireCurrentUser(ctx)
    const memberships = await ctx.db
      .query('teamMembers')
      .withIndex('by_userId', (q) => q.eq('userId', user._id))
      .order('desc')
      .paginate(args.paginationOpts)
    const page = await Promise.all(
      memberships.page.map(async (membership) => {
        const team = await ctx.db.get(membership.teamId)
        if (!team) return appError('DATA_INTEGRITY', 'A team membership references a missing team.')
        return { team, role: membership.role, joinedAt: membership.joinedAt }
      })
    )
    return { ...memberships, page }
  }
})

export const get = query({
  args: { teamId: v.id('teams') },
  returns: teamDetailsValidator,
  handler: async (ctx, args) => {
    const { team, membership } = await requireTeamMember(ctx, args.teamId)
    return { team, membership }
  }
})

export const update = mutation({
  args: {
    teamId: v.id('teams'),
    name: v.optional(v.string()),
    description: v.optional(v.string())
  },
  returns: schema.doc('teams'),
  handler: async (ctx, args) => {
    const { team } = await requireTeamAdmin(ctx, args.teamId)
    const patch: { name?: string; description?: string; updatedAt: number } = { updatedAt: Date.now() }
    if (args.name !== undefined) patch.name = requireTrimmed(args.name, 'Team name', 100)
    if (args.description !== undefined) {
      patch.description = optionalTrimmed(args.description, 'Team description', 2_000)
    }
    await ctx.db.patch(team._id, patch)
    return (await ctx.db.get(team._id))!
  }
})

export const listMembers = query({
  args: { teamId: v.id('teams'), paginationOpts: paginationOptsValidator },
  returns: paginationResultValidator(memberListItemValidator),
  handler: async (ctx, args) => {
    await requireTeamMember(ctx, args.teamId)
    const memberships = await ctx.db
      .query('teamMembers')
      .withIndex('by_teamId', (q) => q.eq('teamId', args.teamId))
      .paginate(args.paginationOpts)
    const page = await Promise.all(
      memberships.page.map(async (membership) => {
        const user = await ctx.db.get(membership.userId)
        if (!user) return appError('DATA_INTEGRITY', 'A team membership references a missing user.')
        return { membership, user: publicUser(user) }
      })
    )
    return { ...memberships, page }
  }
})

export const invite = mutation({
  args: {
    teamId: v.id('teams'),
    email: v.string(),
    role: invitationRoleValidator,
    expiresInDays: v.optional(v.number())
  },
  returns: schema.doc('teamInvitations'),
  handler: async (ctx, args) => {
    const { user } = await requireTeamAdmin(ctx, args.teamId)
    const email = requireTrimmed(args.email, 'Email', 320).toLowerCase()
    if (!/^\S+@\S+\.\S+$/.test(email)) {
      throw new ConvexError({ code: 'INVALID_ARGUMENT', message: 'Enter a valid email address.' })
    }
    const expiresInDays = args.expiresInDays ?? 7
    if (!Number.isSafeInteger(expiresInDays) || expiresInDays < 1 || expiresInDays > 30) {
      throw new ConvexError({ code: 'INVALID_ARGUMENT', message: 'Invitations may expire in 1 to 30 days.' })
    }

    const invitedUser = await ctx.db.query('users').withIndex('by_email', (q) => q.eq('email', email)).unique()
    if (invitedUser && (await getTeamMembership(ctx, args.teamId, invitedUser._id))) {
      throw new ConvexError({ code: 'ALREADY_MEMBER', message: 'This user is already a team member.' })
    }

    const now = Date.now()
    const existing = await ctx.db
      .query('teamInvitations')
      .withIndex('by_teamId_and_email', (q) => q.eq('teamId', args.teamId).eq('email', email))
      .order('desc')
      .first()
    if (existing?.status === 'pending' && existing.expiresAt > now) {
      await ctx.db.patch(existing._id, {
        role: args.role,
        invitedBy: user._id,
        updatedAt: now,
        expiresAt: now + expiresInDays * 86_400_000
      })
      return (await ctx.db.get(existing._id))!
    }

    const invitationId = await ctx.db.insert('teamInvitations', {
      teamId: args.teamId,
      email,
      role: args.role,
      status: 'pending',
      invitedBy: user._id,
      createdAt: now,
      updatedAt: now,
      expiresAt: now + expiresInDays * 86_400_000
    })
    return (await ctx.db.get(invitationId))!
  }
})

export const listInvitations = query({
  args: { teamId: v.id('teams'), paginationOpts: paginationOptsValidator },
  returns: paginationResultValidator(schema.doc('teamInvitations')),
  handler: async (ctx, args) => {
    await requireTeamAdmin(ctx, args.teamId)
    return await ctx.db
      .query('teamInvitations')
      .withIndex('by_teamId_and_createdAt', (q) => q.eq('teamId', args.teamId))
      .order('desc')
      .paginate(args.paginationOpts)
  }
})

export const listMyInvitations = query({
  args: { paginationOpts: paginationOptsValidator },
  returns: paginationResultValidator(schema.doc('teamInvitations')),
  handler: async (ctx, args) => {
    const user = await requireCurrentUser(ctx)
    if (!user.email || user.emailVerified !== true) {
      return appError('VERIFIED_EMAIL_REQUIRED', 'Verify your email address to view team invitations.')
    }
    return await ctx.db
      .query('teamInvitations')
      .withIndex('by_email_and_status', (q) => q.eq('email', user.email!).eq('status', 'pending'))
      .order('desc')
      .paginate(args.paginationOpts)
  }
})

export const acceptInvitation = mutation({
  args: { invitationId: v.id('teamInvitations') },
  returns: schema.doc('teamMembers'),
  handler: async (ctx, args) => {
    const user = await ensureCurrentUser(ctx)
    const invitation = await ctx.db.get(args.invitationId)
    if (!invitation || invitation.status !== 'pending') {
      return appError('NOT_FOUND', 'Invitation not found or no longer available.')
    }
    const team = await ctx.db.get(invitation.teamId)
    if (!team || team.archivedAt !== undefined) {
      return appError('NOT_FOUND', 'The invited team is no longer available.')
    }
    const now = Date.now()
    if (invitation.expiresAt <= now) {
      await ctx.db.patch(invitation._id, { status: 'expired', updatedAt: now })
      return appError('INVITATION_EXPIRED', 'This invitation has expired.')
    }
    if (!user.email || user.email.toLowerCase() !== invitation.email) {
      return appError('FORBIDDEN', 'This invitation belongs to another email address.')
    }
    const existing = await getTeamMembership(ctx, invitation.teamId, user._id)
    if (existing) {
      await ctx.db.patch(invitation._id, { status: 'accepted', acceptedBy: user._id, updatedAt: now })
      return existing
    }
    const membershipId = await ctx.db.insert('teamMembers', {
      teamId: invitation.teamId,
      userId: user._id,
      role: invitation.role,
      invitedBy: invitation.invitedBy,
      joinedAt: now
    })
    await ctx.db.patch(invitation._id, { status: 'accepted', acceptedBy: user._id, updatedAt: now })
    return (await ctx.db.get(membershipId))!
  }
})

export const revokeInvitation = mutation({
  args: { invitationId: v.id('teamInvitations') },
  returns: v.null(),
  handler: async (ctx, args) => {
    const invitation = await ctx.db.get(args.invitationId)
    if (!invitation) return appError('NOT_FOUND', 'Invitation not found.')
    await requireTeamAdmin(ctx, invitation.teamId)
    if (invitation.status === 'pending') {
      await ctx.db.patch(invitation._id, { status: 'revoked', updatedAt: Date.now() })
    }
    return null
  }
})

export const changeMemberRole = mutation({
  args: { membershipId: v.id('teamMembers'), role: teamRoleValidator },
  returns: schema.doc('teamMembers'),
  handler: async (ctx, args) => {
    const target = await ctx.db.get(args.membershipId)
    if (!target) return appError('NOT_FOUND', 'Team member not found.')
    const { team, membership: caller } = await requireTeamAdmin(ctx, target.teamId)
    if (team.kind === 'personal') return appError('FORBIDDEN', 'Personal workspace roles cannot be changed.')
    if (args.role === 'owner' && caller.role !== 'owner') {
      return appError('FORBIDDEN', 'Only a team owner can promote another owner.')
    }
    if (target.role === 'owner' && args.role !== 'owner') {
      if (caller.role !== 'owner') return appError('FORBIDDEN', 'Only an owner can change another owner.')
      const owners = await ctx.db
        .query('teamMembers')
        .withIndex('by_teamId_and_role', (q) => q.eq('teamId', target.teamId).eq('role', 'owner'))
        .take(2)
      if (owners.length < 2) return appError('LAST_OWNER', 'Promote another owner before changing this role.')
    }
    await ctx.db.patch(target._id, { role: args.role })
    return (await ctx.db.get(target._id))!
  }
})

export const removeMember = mutation({
  args: { membershipId: v.id('teamMembers') },
  returns: v.null(),
  handler: async (ctx, args) => {
    const target = await ctx.db.get(args.membershipId)
    if (!target) return appError('NOT_FOUND', 'Team member not found.')
    const currentUser = await requireCurrentUser(ctx)
    const caller = await getTeamMembership(ctx, target.teamId, currentUser._id)
    if (!caller) return appError('FORBIDDEN', 'You do not have access to this team.')
    if (target.userId !== currentUser._id && caller.role === 'member') {
      return appError('FORBIDDEN', 'Team owner or admin access is required.')
    }
    const team = await ctx.db.get(target.teamId)
    if (!team) return appError('NOT_FOUND', 'Team not found.')
    if (team.kind === 'personal') return appError('FORBIDDEN', 'The personal workspace owner cannot be removed.')
    if (target.role === 'owner') {
      if (caller.role !== 'owner') return appError('FORBIDDEN', 'Only an owner can remove another owner.')
      const owners = await ctx.db
        .query('teamMembers')
        .withIndex('by_teamId_and_role', (q) => q.eq('teamId', target.teamId).eq('role', 'owner'))
        .take(2)
      if (owners.length < 2) return appError('LAST_OWNER', 'Promote another owner before leaving the team.')
    }
    await ctx.db.delete(target._id)
    return null
  }
})
