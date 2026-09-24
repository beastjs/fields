import { paginationOptsValidator, paginationResultValidator } from 'convex/server'
import { v } from 'convex/values'
import type { Doc, Id } from './_generated/dataModel'
import { env, mutation, query, type QueryCtx } from './_generated/server'
import { appError, requireProjectMember } from './auth'
import schema from './schema'
import { checkSlug, siteUrl, suggestSlug } from './siteSlugs'

const siteSummaryValidator = v.object({
  site: schema.doc('sites'),
  url: v.union(v.string(), v.null()),
  live: v.union(schema.doc('deployments'), v.null())
})

async function siteForProject(ctx: QueryCtx, projectId: Id<'projects'>) {
  return await ctx.db
    .query('sites')
    .withIndex('by_projectId', (q) => q.eq('projectId', projectId))
    .unique()
}

async function summarize(ctx: QueryCtx, site: Doc<'sites'>) {
  return {
    site,
    url: siteUrl(env.HOSTING_SITE_URL, site.slug),
    live: site.liveDeploymentId ? await ctx.db.get(site.liveDeploymentId) : null
  }
}

/** The project's address and what is live there, or null before it has claimed one. */
export const getForProject = query({
  args: { projectId: v.id('projects') },
  returns: v.union(siteSummaryValidator, v.null()),
  handler: async (ctx, args) => {
    await requireProjectMember(ctx, args.projectId)
    const site = await siteForProject(ctx, args.projectId)
    return site ? await summarize(ctx, site) : null
  }
})

/** Validates a slug for this project as it is typed. A project's own slug counts as available. */
export const checkAvailability = query({
  args: { projectId: v.id('projects'), slug: v.string() },
  returns: v.object({
    slug: v.string(),
    available: v.boolean(),
    reason: v.optional(v.string()),
    url: v.union(v.string(), v.null())
  }),
  handler: async (ctx, args) => {
    await requireProjectMember(ctx, args.projectId)
    const check = checkSlug(args.slug.slice(0, 100))
    const url = siteUrl(env.HOSTING_SITE_URL, check.slug)
    if (!check.ok) return { slug: check.slug, available: false, reason: check.reason, url }
    const holder = await ctx.db
      .query('sites')
      .withIndex('by_slug', (q) => q.eq('slug', check.slug))
      .unique()
    if (holder && holder.projectId !== args.projectId) {
      return { slug: check.slug, available: false, reason: 'That address is taken.', url }
    }
    return { slug: check.slug, available: true, url }
  }
})

/** A slug to start from: the current one, or the project name's, made unique. */
export const suggest = query({
  args: { projectId: v.id('projects') },
  returns: v.string(),
  handler: async (ctx, args) => {
    const { project } = await requireProjectMember(ctx, args.projectId)
    const site = await siteForProject(ctx, args.projectId)
    if (site) return site.slug
    const base = suggestSlug(project.name)
    for (let attempt = 0; attempt < 20; attempt++) {
      const candidate = attempt === 0 ? base : `${base.slice(0, 44)}-${attempt + 1}`
      const holder = await ctx.db
        .query('sites')
        .withIndex('by_slug', (q) => q.eq('slug', candidate))
        .unique()
      if (!holder) return candidate
    }
    return `${base.slice(0, 40)}-${args.projectId.slice(-6).toLowerCase()}`
  }
})

/**
 * Claims or changes the project's slug. The mutation's read of `by_slug` makes two concurrent claims of one slug
 * conflict, so exactly one succeeds. A live site keeps its address: unpublish before renaming, so the old address
 * never keeps serving a site that no longer owns it.
 */
export const claimSlug = mutation({
  args: { projectId: v.id('projects'), slug: v.string() },
  returns: siteSummaryValidator,
  handler: async (ctx, args) => {
    const { project, user } = await requireProjectMember(ctx, args.projectId)
    const check = checkSlug(args.slug.slice(0, 100))
    if (!check.ok) return appError('INVALID_SLUG', check.reason)
    const holder = await ctx.db
      .query('sites')
      .withIndex('by_slug', (q) => q.eq('slug', check.slug))
      .unique()
    if (holder && holder.projectId !== project._id) return appError('SLUG_TAKEN', 'That address is taken.')

    const now = Date.now()
    const site = await siteForProject(ctx, project._id)
    if (!site) {
      const siteId = await ctx.db.insert('sites', {
        projectId: project._id,
        teamId: project.teamId,
        slug: check.slug,
        createdBy: user._id,
        createdAt: now,
        updatedAt: now
      })
      return await summarize(ctx, (await ctx.db.get(siteId))!)
    }
    if (site.slug !== check.slug) {
      if (site.liveDeploymentId) return appError('SITE_LIVE', 'Unpublish the site before changing its address.')
      await ctx.db.patch(site._id, { slug: check.slug, updatedAt: now })
    }
    return await summarize(ctx, (await ctx.db.get(site._id))!)
  }
})

/** The project's deployments, newest first. */
export const listDeployments = query({
  args: { projectId: v.id('projects'), paginationOpts: paginationOptsValidator },
  returns: paginationResultValidator(schema.doc('deployments')),
  handler: async (ctx, args) => {
    await requireProjectMember(ctx, args.projectId)
    return await ctx.db
      .query('deployments')
      .withIndex('by_projectId_and_createdAt', (q) => q.eq('projectId', args.projectId))
      .order('desc')
      .paginate(args.paginationOpts)
  }
})
