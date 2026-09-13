'use node'

import { Agent } from '@convex-dev/agent'
import { convexGateway } from '@convex-dev/ai-sdk-provider'
import { ConvexError, v } from 'convex/values'
import { internal } from './_generated/api'
import { components } from './_generated/api'
import { action } from './_generated/server'

const assistant = new Agent(components.agent, {
  name: 'Beast Playground',
  languageModel: convexGateway('anthropic/claude-sonnet-4.5'),
  instructions:
    'You are the coding assistant inside the Beast to Octane web playground. Give concise, practical help. ' +
    'When recommending a complete file replacement, use a fenced code block whose info string contains the exact project path.'
})

const fileContextValidator = v.object({ file: v.string(), source: v.string() })

export const send = action({
  args: {
    chatId: v.id('chats'),
    prompt: v.string(),
    context: v.optional(fileContextValidator),
    references: v.optional(v.array(fileContextValidator))
  },
  returns: v.object({ text: v.string() }),
  handler: async (ctx, args): Promise<{ text: string }> => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw new ConvexError({ code: 'UNAUTHENTICATED', message: 'Sign in to use chat.' })
    const prompt = args.prompt.trim()
    if (!prompt || prompt.length > 32_000) {
      throw new ConvexError({ code: 'INVALID_ARGUMENT', message: 'Prompts must be 1 to 32,000 characters.' })
    }
    if (args.context && args.context.source.length > 60_000) {
      throw new ConvexError({ code: 'INVALID_ARGUMENT', message: 'The active-file context is too large.' })
    }
    if ((args.references?.length ?? 0) > 8) {
      throw new ConvexError({ code: 'INVALID_ARGUMENT', message: 'Include at most 8 reference files.' })
    }
    const referenceCharacters = args.references?.reduce((total, file) => total + file.source.length, 0) ?? 0
    if (referenceCharacters > 60_000) {
      throw new ConvexError({ code: 'INVALID_ARGUMENT', message: 'Reference files are too large together.' })
    }

    const access: {
      chatId: typeof args.chatId
      threadId: string
      userId: string
      projectName: string
    } = await ctx.runQuery(internal.chats.authorizeForAction, {
      chatId: args.chatId,
      tokenIdentifier: identity.tokenIdentifier
    })
    const contextSections = [args.context, ...(args.references ?? [])]
      .filter((file): file is { file: string; source: string } => file !== undefined)
      .map((file) => `\nFile ${file.file}:\n\`\`\`\n${file.source}\n\`\`\``)
      .join('\n')
    const instructions: string = contextSections
      ? `The user is working in project "${access.projectName}". Use this read-only source context when answering:${contextSections}`
      : `The user is working in project "${access.projectName}".`
    const { thread } = await assistant.continueThread(ctx, {
      threadId: access.threadId,
      userId: access.userId
    })
    const result: { text: string } = await thread.generateText({ prompt, instructions })
    await ctx.runMutation(internal.chats.touchAfterMessage, {
      chatId: access.chatId,
      suggestedTitle: prompt
    })
    return { text: result.text }
  }
})
