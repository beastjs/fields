import { ConvexError, v } from 'convex/values'
import { appError, requireProjectMember } from './auth'
import { mutation, query } from './_generated/server'
import schema from './schema'
import {
  hydrateWorkspace,
  loadProjectFiles,
  normalizeProjectPath,
  replaceProjectFiles,
  validateWorkspace
} from './workspace'

const revisionResultValidator = v.object({
  projectId: v.id('projects'),
  revision: v.number(),
  updatedAt: v.number()
})

function requireExpectedRevision(current: number, expected: number) {
  if (!Number.isSafeInteger(expected) || expected < 1) {
    throw new ConvexError({ code: 'INVALID_ARGUMENT', message: 'Expected revision must be a positive integer.' })
  }
  if (current !== expected) {
    throw new ConvexError({
      code: 'CONFLICT',
      message: 'The project changed before this file operation completed.',
      currentRevision: current
    })
  }
}

export const list = query({
  args: { projectId: v.id('projects') },
  returns: v.array(schema.doc('projectFiles')),
  handler: async (ctx, args) => {
    await requireProjectMember(ctx, args.projectId)
    return await loadProjectFiles(ctx, args.projectId)
  }
})

export const get = query({
  args: { projectId: v.id('projects'), path: v.string() },
  returns: v.union(schema.doc('projectFiles'), v.null()),
  handler: async (ctx, args) => {
    await requireProjectMember(ctx, args.projectId)
    const path = normalizeProjectPath(args.path)
    return await ctx.db
      .query('projectFiles')
      .withIndex('by_projectId_and_path', (q) => q.eq('projectId', args.projectId).eq('path', path))
      .unique()
  }
})

export const upsert = mutation({
  args: {
    projectId: v.id('projects'),
    expectedRevision: v.number(),
    path: v.string(),
    content: v.string()
  },
  returns: v.object({
    ...revisionResultValidator.fields,
    file: schema.doc('projectFiles')
  }),
  handler: async (ctx, args) => {
    const { project, user } = await requireProjectMember(ctx, args.projectId)
    requireExpectedRevision(project.revision, args.expectedRevision)
    const path = normalizeProjectPath(args.path)
    const hydrated = hydrateWorkspace(project, await loadProjectFiles(ctx, project._id)).workspace
    const workspace = validateWorkspace({
      ...hydrated,
      project: { ...hydrated.project, files: { ...hydrated.project.files, [path]: args.content } }
    })
    const now = Date.now()
    await replaceProjectFiles(ctx, project, workspace, user._id, now)
    const revision = project.revision + 1
    await ctx.db.patch(project._id, { revision, updatedAt: now })
    const file = await ctx.db
      .query('projectFiles')
      .withIndex('by_projectId_and_path', (q) => q.eq('projectId', project._id).eq('path', path))
      .unique()
    if (!file) return appError('DATA_INTEGRITY', 'The saved file could not be loaded.')
    return { projectId: project._id, revision, updatedAt: now, file }
  }
})

export const remove = mutation({
  args: {
    projectId: v.id('projects'),
    expectedRevision: v.number(),
    path: v.string()
  },
  returns: revisionResultValidator,
  handler: async (ctx, args) => {
    const { project } = await requireProjectMember(ctx, args.projectId)
    requireExpectedRevision(project.revision, args.expectedRevision)
    const path = normalizeProjectPath(args.path)
    if (path === project.entryPath) {
      return appError('INVALID_PROJECT', 'The project entry file cannot be deleted.')
    }
    const file = await ctx.db
      .query('projectFiles')
      .withIndex('by_projectId_and_path', (q) => q.eq('projectId', project._id).eq('path', path))
      .unique()
    if (!file) return appError('NOT_FOUND', 'File not found.')
    await ctx.db.delete(file._id)
    const now = Date.now()
    const revision = project.revision + 1
    const activeFilePath = project.activeFilePath === path ? project.entryPath : project.activeFilePath
    await ctx.db.patch(project._id, { activeFilePath, revision, updatedAt: now })
    return { projectId: project._id, revision, updatedAt: now }
  }
})
