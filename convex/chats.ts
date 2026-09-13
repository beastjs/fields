import {
  createThread,
  listMessages as listAgentMessages,
  saveMessages,
  vMessageDoc
} from '@convex-dev/agent'
import { paginationOptsValidator, paginationResultValidator } from 'convex/server'
import { ConvexError, v } from 'convex/values'
import { appError, getTeamMembership, getUserByTokenIdentifier, requireProjectMember } from './auth'
import { components } from './_generated/api'
import type { Id } from './_generated/dataModel'
import type { MutationCtx, QueryCtx } from './_generated/server'
import { internalMutation, internalQuery, mutation, query } from './_generated/server'
import schema from './schema'
import { requireTrimmed } from './utils'

type DatabaseCtx = QueryCtx | MutationCtx

async function requireChatAccess(ctx: DatabaseCtx, chatId: Id<'chats'>) {
  const chat = await ctx.db.get(chatId)
  if (!chat || chat.archivedAt !== undefined) return appError('NOT_FOUND', 'Chat not found.')
  const access = await requireProjectMember(ctx, chat.projectId)
  return { chat, ...access }
}

export const create = mutation({
  args: { projectId: v.id('projects'), title: v.optional(v.string()) },
  returns: schema.doc('chats'),
  handler: async (ctx, args) => {
    const { user } = await requireProjectMember(ctx, args.projectId)
    const title = args.title === undefined ? 'New chat' : requireTrimmed(args.title, 'Chat title', 160)
    const threadId = await createThread(ctx, components.agent, { userId: user._id, title })
    const now = Date.now()
    const chatId = await ctx.db.insert('chats', {
      projectId: args.projectId,
      agentThreadId: threadId,
      title,
      createdBy: user._id,
      createdAt: now,
      updatedAt: now
    })
    return (await ctx.db.get(chatId))!
  }
})

export const listByProject = query({
  args: { projectId: v.id('projects'), paginationOpts: paginationOptsValidator },
  returns: paginationResultValidator(schema.doc('chats')),
  handler: async (ctx, args) => {
    await requireProjectMember(ctx, args.projectId)
    return await ctx.db
      .query('chats')
      .withIndex('by_projectId_and_updatedAt', (q) => q.eq('projectId', args.projectId))
      .order('desc')
      .paginate(args.paginationOpts)
  }
})

export const listMessages = query({
  args: { chatId: v.id('chats'), paginationOpts: paginationOptsValidator },
  returns: paginationResultValidator(vMessageDoc),
  handler: async (ctx, args) => {
    const { chat } = await requireChatAccess(ctx, args.chatId)
    return await listAgentMessages(ctx, components.agent, {
      threadId: chat.agentThreadId,
      paginationOpts: args.paginationOpts,
      excludeToolMessages: true
    })
  }
})

export const appendMessages = mutation({
  args: {
    chatId: v.id('chats'),
    messages: v.array(
      v.object({
        role: v.union(v.literal('user'), v.literal('assistant')),
        content: v.string()
      })
    )
  },
  returns: v.array(v.string()),
  handler: async (ctx, args) => {
    const { chat, user } = await requireChatAccess(ctx, args.chatId)
    if (args.messages.length === 0 || args.messages.length > 30) {
      throw new ConvexError({ code: 'INVALID_ARGUMENT', message: 'Append between 1 and 30 messages at a time.' })
    }
    for (const message of args.messages) {
      if (!message.content.trim() || message.content.length > 128_000) {
        throw new ConvexError({ code: 'INVALID_ARGUMENT', message: 'Messages must be 1 to 128,000 characters.' })
      }
    }
    const result = await saveMessages(ctx, components.agent, {
      threadId: chat.agentThreadId,
      userId: user._id,
      agentName: 'Beast Playground',
      order: 'next',
      messages: args.messages
    })
    await ctx.db.patch(chat._id, { updatedAt: Date.now() })
    return result.messages.map((message) => message._id)
  }
})

export const rename = mutation({
  args: { chatId: v.id('chats'), title: v.string() },
  returns: schema.doc('chats'),
  handler: async (ctx, args) => {
    const { chat } = await requireChatAccess(ctx, args.chatId)
    await ctx.db.patch(chat._id, { title: requireTrimmed(args.title, 'Chat title', 160), updatedAt: Date.now() })
    return (await ctx.db.get(chat._id))!
  }
})

export const archive = mutation({
  args: { chatId: v.id('chats') },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { chat } = await requireChatAccess(ctx, args.chatId)
    const now = Date.now()
    await ctx.db.patch(chat._id, { archivedAt: now, updatedAt: now })
    return null
  }
})

export const authorizeForAction = internalQuery({
  args: { chatId: v.id('chats'), tokenIdentifier: v.string() },
  returns: v.object({
    chatId: v.id('chats'),
    threadId: v.string(),
    userId: v.id('users'),
    projectName: v.string()
  }),
  handler: async (ctx, args) => {
    const user = await getUserByTokenIdentifier(ctx, args.tokenIdentifier)
    if (!user) return appError('USER_NOT_PROVISIONED', 'Finish signing in before using chat.')
    const chat = await ctx.db.get(args.chatId)
    if (!chat || chat.archivedAt !== undefined) return appError('NOT_FOUND', 'Chat not found.')
    const project = await ctx.db.get(chat.projectId)
    if (!project || project.archivedAt !== undefined) return appError('NOT_FOUND', 'Project not found.')
    const membership = await getTeamMembership(ctx, project.teamId, user._id)
    if (!membership) return appError('FORBIDDEN', 'You do not have access to this chat.')
    return {
      chatId: chat._id,
      threadId: chat.agentThreadId,
      userId: user._id,
      projectName: project.name
    }
  }
})

export const touchAfterMessage = internalMutation({
  args: { chatId: v.id('chats'), suggestedTitle: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const chat = await ctx.db.get(args.chatId)
    if (!chat) return null
    const title = chat.title === 'New chat' ? args.suggestedTitle.slice(0, 160) : chat.title
    await ctx.db.patch(chat._id, { title, updatedAt: Date.now() })
    return null
  }
})
