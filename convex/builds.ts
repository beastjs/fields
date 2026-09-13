import { paginationOptsValidator, paginationResultValidator } from 'convex/server'
import { ConvexError, v } from 'convex/values'
import { appError, requireProjectMember } from './auth'
import { mutation, query } from './_generated/server'
import schema from './schema'
import { buildTriggerValidator } from './validators'

export const start = mutation({
  args: {
    projectId: v.id('projects'),
    trigger: buildTriggerValidator,
    compilerVersion: v.optional(v.string())
  },
  returns: schema.doc('buildRuns'),
  handler: async (ctx, args) => {
    const { project, user } = await requireProjectMember(ctx, args.projectId)
    if (args.compilerVersion !== undefined && args.compilerVersion.length > 100) {
      throw new ConvexError({ code: 'INVALID_ARGUMENT', message: 'Compiler version is too long.' })
    }
    const buildId = await ctx.db.insert('buildRuns', {
      projectId: project._id,
      initiatedBy: user._id,
      trigger: args.trigger,
      status: 'running',
      projectRevision: project.revision,
      compilerVersion: args.compilerVersion,
      startedAt: Date.now()
    })
    return (await ctx.db.get(buildId))!
  }
})

export const complete = mutation({
  args: {
    buildId: v.id('buildRuns'),
    status: v.union(v.literal('succeeded'), v.literal('failed'), v.literal('cancelled')),
    durationMs: v.optional(v.number()),
    moduleCount: v.optional(v.number()),
    transformedFileCount: v.optional(v.number())
  },
  returns: schema.doc('buildRuns'),
  handler: async (ctx, args) => {
    const build = await ctx.db.get(args.buildId)
    if (!build) return appError('NOT_FOUND', 'Build not found.')
    await requireProjectMember(ctx, build.projectId)
    if (build.status !== 'running') {
      return appError('BUILD_FINISHED', 'This build has already finished.')
    }
    for (const [label, value] of [
      ['Duration', args.durationMs],
      ['Module count', args.moduleCount],
      ['Transformed file count', args.transformedFileCount]
    ] as const) {
      if (value !== undefined && (!Number.isFinite(value) || value < 0)) {
        throw new ConvexError({ code: 'INVALID_ARGUMENT', message: `${label} must be a non-negative number.` })
      }
    }
    await ctx.db.patch(build._id, {
      status: args.status,
      durationMs: args.durationMs,
      moduleCount: args.moduleCount,
      transformedFileCount: args.transformedFileCount,
      completedAt: Date.now()
    })
    return (await ctx.db.get(build._id))!
  }
})

export const listByProject = query({
  args: { projectId: v.id('projects'), paginationOpts: paginationOptsValidator },
  returns: paginationResultValidator(schema.doc('buildRuns')),
  handler: async (ctx, args) => {
    await requireProjectMember(ctx, args.projectId)
    return await ctx.db
      .query('buildRuns')
      .withIndex('by_projectId_and_startedAt', (q) => q.eq('projectId', args.projectId))
      .order('desc')
      .paginate(args.paginationOpts)
  }
})
