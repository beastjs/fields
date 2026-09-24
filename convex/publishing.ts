import { ConvexError, v } from 'convex/values'
import { internal } from './_generated/api'
import type { Doc, Id } from './_generated/dataModel'
import { action, env, internalAction, internalMutation, internalQuery, mutation, type MutationCtx } from './_generated/server'
import { appError, requireProjectMember } from './auth'

/**
 * Publishing a project to the hosting Worker (hosting/README.md).
 *
 * Convex is the source of truth for what is live. Every change — publish, rollback, unpublish — commits here first
 * and, in the same transaction, schedules `syncRoute` for the slug it touched. `syncRoute` reads the latest state
 * and makes the Worker's route match, so it is idempotent, heals races between concurrent publishes, and retries
 * when the Worker is unreachable.
 */

/** Convex limits one value to 1 MiB and function arguments to 16 MiB; stay clear of both. */
export const PUBLISH_LIMITS = { files: 500, fileBytes: 1000 * 1000, bytes: 8 * 1000 * 1000 }
/** An upload older than this is presumed dead and no longer blocks the next publish. */
const UPLOAD_TIMEOUT_MS = 2 * 60 * 1000
const SYNC_RETRY_DELAYS_MS = [5_000, 30_000, 2 * 60_000, 10 * 60_000]

const siteFileValidator = v.object({ path: v.string(), content: v.string(), contentType: v.string() })

// ---------------------------------------------------------------------------------------------------------------
// Worker admin API

async function hostingAdmin(path: string, method: 'GET' | 'PUT' | 'DELETE', body?: unknown): Promise<unknown> {
  const base = env.HOSTING_ADMIN_URL
  const token = env.HOSTING_ADMIN_TOKEN
  if (!base || !token) return appError('HOSTING_NOT_CONFIGURED', 'Publishing is not configured on this deployment.')
  const response = await fetch(new URL(`/_admin/${path}`, base), {
    method,
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body)
  })
  const text = await response.text()
  let parsed: unknown = null
  try { parsed = text ? JSON.parse(text) : null } catch { /* A non-JSON error page; reported below. */ }
  if (!response.ok) {
    const error = parsed as { error?: unknown; message?: unknown } | null
    throw new HostingError(
      response.status,
      typeof error?.error === 'string' ? error.error : 'HOSTING_ERROR',
      typeof error?.message === 'string' ? error.message : `The hosting service answered ${response.status}.`
    )
  }
  return parsed
}

class HostingError extends Error {
  constructor(readonly status: number, readonly code: string, message: string) { super(message) }
}

// ---------------------------------------------------------------------------------------------------------------
// Publish

/**
 * Uploads a site build (`buildSite` in src/playground/site-build.ts) and makes it live. The caller compiles what is
 * in its editor, unsaved edits included; the deployment records the project revision current at the time. The
 * Worker validates every path and content type again before sealing the upload.
 */
export const publish = action({
  args: { projectId: v.id('projects'), files: v.array(siteFileValidator) },
  returns: v.object({ deploymentId: v.id('deployments'), slug: v.string() }),
  handler: async (ctx, args): Promise<{ deploymentId: Id<'deployments'>; slug: string }> => {
    const encoder = new TextEncoder()
    let bytes = 0
    for (const file of args.files) {
      const size = encoder.encode(file.content).byteLength
      if (size > PUBLISH_LIMITS.fileBytes) return appError('FILE_TOO_LARGE', `${file.path.slice(0, 200)} is larger than 1 MB.`)
      bytes += size
    }
    if (args.files.length === 0 || args.files.length > PUBLISH_LIMITS.files) {
      return appError('INVALID_SITE', `A site has 1–${PUBLISH_LIMITS.files} files.`)
    }
    if (bytes > PUBLISH_LIMITS.bytes) return appError('SITE_TOO_LARGE', 'A site can be at most 8 MB.')
    if (!args.files.some((file) => file.path === '/index.html')) return appError('INVALID_SITE', 'A site needs /index.html.')

    const { deploymentId, slug } = await ctx.runMutation(internal.publishing.beginDeployment, {
      projectId: args.projectId,
      fileCount: args.files.length,
      bytes
    })
    try {
      await hostingAdmin(`deployments/${deploymentId}`, 'PUT', { files: args.files })
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      await ctx.runMutation(internal.publishing.failDeployment, { deploymentId, error: message.slice(0, 1000) })
      if (error instanceof ConvexError) throw error
      return appError('UPLOAD_FAILED', `The site could not be uploaded: ${message}`)
    }
    await ctx.runMutation(internal.publishing.promote, { deploymentId })
    return { deploymentId, slug }
  }
})

export const beginDeployment = internalMutation({
  args: { projectId: v.id('projects'), fileCount: v.number(), bytes: v.number() },
  returns: v.object({ deploymentId: v.id('deployments'), slug: v.string() }),
  handler: async (ctx, args) => {
    // Runs with the publishing user's identity, which the action passes through.
    const { project, user } = await requireProjectMember(ctx, args.projectId)
    const site = await siteForProject(ctx, project._id)
    if (!site) return appError('SITE_NOT_CLAIMED', 'Choose an address before publishing.')
    const now = Date.now()
    const latest = await ctx.db
      .query('deployments')
      .withIndex('by_projectId_and_createdAt', (q) => q.eq('projectId', project._id))
      .order('desc')
      .first()
    if (latest?.status === 'uploading' && now - latest.createdAt < UPLOAD_TIMEOUT_MS) {
      return appError('PUBLISH_IN_PROGRESS', 'This project is already being published.')
    }
    const deploymentId = await ctx.db.insert('deployments', {
      projectId: project._id,
      slug: site.slug,
      status: 'uploading',
      projectRevision: project.revision,
      createdBy: user._id,
      fileCount: args.fileCount,
      bytes: args.bytes,
      createdAt: now
    })
    return { deploymentId, slug: site.slug }
  }
})

export const failDeployment = internalMutation({
  args: { deploymentId: v.id('deployments'), error: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const deployment = await ctx.db.get(args.deploymentId)
    if (deployment?.status === 'uploading') {
      await ctx.db.patch(deployment._id, { status: 'failed', error: args.error, completedAt: Date.now() })
    }
    return null
  }
})

/** Marks an uploaded deployment ready and makes it live. */
export const promote = internalMutation({
  args: { deploymentId: v.id('deployments') },
  returns: v.null(),
  handler: async (ctx, args) => {
    const deployment = await ctx.db.get(args.deploymentId)
    if (!deployment) return appError('NOT_FOUND', 'Deployment not found.')
    const { user } = await requireProjectMember(ctx, deployment.projectId)
    if (deployment.status !== 'uploading' && deployment.status !== 'ready') {
      return appError('DEPLOYMENT_UNAVAILABLE', 'This deployment cannot be published.')
    }
    await ctx.db.patch(deployment._id, { status: 'ready', completedAt: deployment.completedAt ?? Date.now() })
    await makeLive(ctx, deployment.projectId, deployment, user._id)
    return null
  }
})

// ---------------------------------------------------------------------------------------------------------------
// Rollback and unpublish

/** Makes an earlier ready deployment live again. */
export const rollback = mutation({
  args: { deploymentId: v.id('deployments') },
  returns: v.null(),
  handler: async (ctx, args) => {
    const deployment = await ctx.db.get(args.deploymentId)
    if (!deployment) return appError('NOT_FOUND', 'Deployment not found.')
    const { user } = await requireProjectMember(ctx, deployment.projectId)
    if (deployment.status !== 'ready') return appError('DEPLOYMENT_UNAVAILABLE', 'Only a completed deployment can be restored.')
    await makeLive(ctx, deployment.projectId, deployment, user._id)
    return null
  }
})

/** Takes the site offline. Its address stays claimed and its deployments stay restorable. */
export const unpublish = mutation({
  args: { projectId: v.id('projects') },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireProjectMember(ctx, args.projectId)
    const site = await siteForProject(ctx, args.projectId)
    if (!site?.liveDeploymentId) return null
    await ctx.db.patch(site._id, { liveDeploymentId: undefined, updatedAt: Date.now() })
    await ctx.scheduler.runAfter(0, internal.publishing.syncRoute, { slug: site.slug, attempt: 0 })
    return null
  }
})

async function siteForProject(ctx: Pick<MutationCtx, 'db'>, projectId: Id<'projects'>) {
  return await ctx.db
    .query('sites')
    .withIndex('by_projectId', (q) => q.eq('projectId', projectId))
    .unique()
}

async function makeLive(ctx: MutationCtx, projectId: Id<'projects'>, deployment: Doc<'deployments'>, userId: Id<'users'>) {
  const site = await siteForProject(ctx, projectId)
  if (!site) return appError('SITE_NOT_CLAIMED', 'Choose an address before publishing.')
  const now = Date.now()
  await ctx.db.patch(site._id, { liveDeploymentId: deployment._id, publishedAt: now, publishedBy: userId, updatedAt: now })
  await ctx.scheduler.runAfter(0, internal.publishing.syncRoute, { slug: site.slug, attempt: 0 })
}

// ---------------------------------------------------------------------------------------------------------------
// Route sync

/** What the Worker should serve at `slug` right now: a sealed deployment id, or null for nothing. */
export const routeTarget = internalQuery({
  args: { slug: v.string() },
  returns: v.union(v.id('deployments'), v.null()),
  handler: async (ctx, args) => {
    const site = await ctx.db
      .query('sites')
      .withIndex('by_slug', (q) => q.eq('slug', args.slug))
      .unique()
    if (!site?.liveDeploymentId) return null
    const deployment = await ctx.db.get(site.liveDeploymentId)
    return deployment?.status === 'ready' ? deployment._id : null
  }
})

/** Makes the Worker's route for `slug` match Convex. Safe to run any number of times, in any order. */
export const syncRoute = internalAction({
  args: { slug: v.string(), attempt: v.number() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const target = await ctx.runQuery(internal.publishing.routeTarget, { slug: args.slug })
    try {
      if (target) await hostingAdmin(`routes/${args.slug}`, 'PUT', { deploymentId: target })
      else await hostingAdmin(`routes/${args.slug}`, 'DELETE')
    } catch (error) {
      const delay = SYNC_RETRY_DELAYS_MS[args.attempt]
      // A misconfigured deployment or a rejected request will not fix itself by waiting.
      const permanent = error instanceof ConvexError || (error instanceof HostingError && error.status >= 400 && error.status < 500)
      if (delay === undefined || permanent) {
        console.error(`Route sync for ${args.slug} failed permanently`, error)
        return null
      }
      console.warn(`Route sync for ${args.slug} failed; retrying in ${delay / 1000}s`, error)
      await ctx.scheduler.runAfter(delay, internal.publishing.syncRoute, { slug: args.slug, attempt: args.attempt + 1 })
    }
    return null
  }
})
