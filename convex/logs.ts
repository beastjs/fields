import { paginationOptsValidator, paginationResultValidator } from 'convex/server'
import { ConvexError, v } from 'convex/values'
import { appError, requireProjectMember } from './auth'
import { mutation, query } from './_generated/server'
import schema from './schema'
import { logLevelValidator, logSourceValidator } from './validators'
import { normalizeProjectPath } from './workspace'

const logInputValidator = v.object({
  source: logSourceValidator,
  level: logLevelValidator,
  message: v.string(),
  filePath: v.optional(v.string()),
  line: v.optional(v.number()),
  column: v.optional(v.number()),
  occurredAt: v.number()
})

export const append = mutation({
  args: {
    projectId: v.id('projects'),
    buildId: v.optional(v.id('buildRuns')),
    entries: v.array(logInputValidator)
  },
  returns: v.array(v.id('projectLogs')),
  handler: async (ctx, args) => {
    const { user } = await requireProjectMember(ctx, args.projectId)
    if (args.entries.length === 0 || args.entries.length > 100) {
      throw new ConvexError({ code: 'INVALID_ARGUMENT', message: 'Append between 1 and 100 log entries at a time.' })
    }
    if (args.buildId) {
      const build = await ctx.db.get(args.buildId)
      if (!build || build.projectId !== args.projectId) {
        return appError('NOT_FOUND', 'Build not found for this project.')
      }
    }
    const createdAt = Date.now()
    const ids = []
    for (const entry of args.entries) {
      if (!entry.message || entry.message.length > 16_000) {
        throw new ConvexError({ code: 'INVALID_ARGUMENT', message: 'Log messages must be 1 to 16,000 characters.' })
      }
      if (!Number.isFinite(entry.occurredAt) || entry.occurredAt < 0) {
        throw new ConvexError({ code: 'INVALID_ARGUMENT', message: 'Log timestamps must be non-negative numbers.' })
      }
      for (const value of [entry.line, entry.column]) {
        if (value !== undefined && (!Number.isSafeInteger(value) || value < 1)) {
          throw new ConvexError({ code: 'INVALID_ARGUMENT', message: 'Log line and column must be positive integers.' })
        }
      }
      ids.push(
        await ctx.db.insert('projectLogs', {
          projectId: args.projectId,
          buildId: args.buildId,
          recordedBy: user._id,
          source: entry.source,
          level: entry.level,
          message: entry.message,
          filePath: entry.filePath === undefined ? undefined : normalizeProjectPath(entry.filePath),
          line: entry.line,
          column: entry.column,
          occurredAt: entry.occurredAt,
          createdAt
        })
      )
    }
    return ids
  }
})

export const listByProject = query({
  args: {
    projectId: v.id('projects'),
    source: v.optional(logSourceValidator),
    paginationOpts: paginationOptsValidator
  },
  returns: paginationResultValidator(schema.doc('projectLogs')),
  handler: async (ctx, args) => {
    await requireProjectMember(ctx, args.projectId)
    if (args.source !== undefined) {
      return await ctx.db
        .query('projectLogs')
        .withIndex('by_projectId_and_source_and_occurredAt', (q) =>
          q.eq('projectId', args.projectId).eq('source', args.source!)
        )
        .order('desc')
        .paginate(args.paginationOpts)
    }
    return await ctx.db
      .query('projectLogs')
      .withIndex('by_projectId_and_occurredAt', (q) => q.eq('projectId', args.projectId))
      .order('desc')
      .paginate(args.paginationOpts)
  }
})

export const listByBuild = query({
  args: { buildId: v.id('buildRuns'), paginationOpts: paginationOptsValidator },
  returns: paginationResultValidator(schema.doc('projectLogs')),
  handler: async (ctx, args) => {
    const build = await ctx.db.get(args.buildId)
    if (!build) return appError('NOT_FOUND', 'Build not found.')
    await requireProjectMember(ctx, build.projectId)
    return await ctx.db
      .query('projectLogs')
      .withIndex('by_buildId_and_occurredAt', (q) => q.eq('buildId', args.buildId))
      .order('desc')
      .paginate(args.paginationOpts)
  }
})
