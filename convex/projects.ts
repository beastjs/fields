import { paginationOptsValidator, paginationResultValidator } from 'convex/server'
import { ConvexError, v } from 'convex/values'
import { ensureCurrentUser, getTeamMembership, requireCurrentUser, requireProjectMember, requireTeamMember } from './auth'
import { mutation, query } from './_generated/server'
import schema from './schema'
import { optionalTrimmed, requireTrimmed } from './utils'
import { workspaceResultValidator, workspaceValidator } from './validators'
import {
  hydrateWorkspace,
  insertProjectFiles,
  loadProjectFiles,
  replaceProjectFiles,
  validateWorkspace
} from './workspace'

const saveResultValidator = v.object({
  projectId: v.id('projects'),
  revision: v.number(),
  updatedAt: v.number()
})

export const ensureDefault = mutation({
  args: { workspace: workspaceValidator },
  returns: workspaceResultValidator,
  handler: async (ctx, args) => {
    const user = await ensureCurrentUser(ctx)
    const workspace = validateWorkspace(args.workspace)
    const now = Date.now()

    let team = await ctx.db
      .query('teams')
      .withIndex('by_personalOwnerId', (q) => q.eq('personalOwnerId', user._id))
      .unique()

    if (!team) {
      const teamId = await ctx.db.insert('teams', {
        name: user.name ? `${user.name}'s workspace` : 'Personal workspace',
        kind: 'personal',
        personalOwnerId: user._id,
        createdBy: user._id,
        createdAt: now,
        updatedAt: now
      })
      await ctx.db.insert('teamMembers', {
        teamId,
        userId: user._id,
        role: 'owner',
        joinedAt: now
      })
      team = (await ctx.db.get(teamId))!
    } else {
      const membership = await getTeamMembership(ctx, team._id, user._id)
      if (!membership) {
        await ctx.db.insert('teamMembers', {
          teamId: team._id,
          userId: user._id,
          role: 'owner',
          joinedAt: now
        })
      }
    }

    let defaultProject = await ctx.db
      .query('projects')
      .withIndex('by_teamId_and_isDefault', (q) => q.eq('teamId', team._id).eq('isDefault', true))
      .unique()
    if (!defaultProject) {
      const projectId = await ctx.db.insert('projects', {
        teamId: team._id,
        name: 'My project',
        createdBy: user._id,
        isDefault: true,
        entryPath: workspace.project.entry,
        activeFilePath: workspace.activeFile,
        previewWidth: workspace.preview.width,
        revision: 1,
        createdAt: now,
        updatedAt: now
      })
      await insertProjectFiles(ctx, projectId, workspace, user._id, now)
      defaultProject = (await ctx.db.get(projectId))!
    }

    if (user.activeProjectId) {
      const activeProject = await ctx.db.get(user.activeProjectId)
      if (activeProject && activeProject.archivedAt === undefined) {
        const activeMembership = await getTeamMembership(ctx, activeProject.teamId, user._id)
        if (activeMembership) {
          if (user.activeTeamId !== activeProject.teamId) {
            await ctx.db.patch(user._id, { activeTeamId: activeProject.teamId })
          }
          return hydrateWorkspace(activeProject, await loadProjectFiles(ctx, activeProject._id))
        }
      }
    }

    await ctx.db.patch(user._id, { activeTeamId: defaultProject.teamId, activeProjectId: defaultProject._id })
    return hydrateWorkspace(defaultProject, await loadProjectFiles(ctx, defaultProject._id))
  }
})

export const getDefault = query({
  args: {},
  returns: v.union(workspaceResultValidator, v.null()),
  handler: async (ctx) => {
    const user = await requireCurrentUser(ctx)
    const team = await ctx.db
      .query('teams')
      .withIndex('by_personalOwnerId', (q) => q.eq('personalOwnerId', user._id))
      .unique()
    if (!team || team.archivedAt !== undefined) return null
    const project = await ctx.db
      .query('projects')
      .withIndex('by_teamId_and_isDefault', (q) => q.eq('teamId', team._id).eq('isDefault', true))
      .unique()
    if (!project || project.archivedAt !== undefined) return null
    return hydrateWorkspace(project, await loadProjectFiles(ctx, project._id))
  }
})

export const getWorkspace = query({
  args: { projectId: v.id('projects') },
  returns: workspaceResultValidator,
  handler: async (ctx, args) => {
    const { project } = await requireProjectMember(ctx, args.projectId)
    return hydrateWorkspace(project, await loadProjectFiles(ctx, project._id))
  }
})

export const selectWorkspace = mutation({
  args: { projectId: v.id('projects') },
  returns: workspaceResultValidator,
  handler: async (ctx, args) => {
    const { project, user } = await requireProjectMember(ctx, args.projectId)
    await ctx.db.patch(user._id, { activeTeamId: project.teamId, activeProjectId: project._id })
    return hydrateWorkspace(project, await loadProjectFiles(ctx, project._id))
  }
})

export const listByTeam = query({
  args: { teamId: v.id('teams'), paginationOpts: paginationOptsValidator },
  returns: paginationResultValidator(schema.doc('projects')),
  handler: async (ctx, args) => {
    await requireTeamMember(ctx, args.teamId)
    return await ctx.db
      .query('projects')
      .withIndex('by_teamId_and_updatedAt', (q) => q.eq('teamId', args.teamId))
      .order('desc')
      .paginate(args.paginationOpts)
  }
})

export const create = mutation({
  args: {
    teamId: v.id('teams'),
    name: v.string(),
    description: v.optional(v.string()),
    workspace: workspaceValidator
  },
  returns: workspaceResultValidator,
  handler: async (ctx, args) => {
    const { user } = await requireTeamMember(ctx, args.teamId)
    const workspace = validateWorkspace(args.workspace)
    const now = Date.now()
    const projectId = await ctx.db.insert('projects', {
      teamId: args.teamId,
      name: requireTrimmed(args.name, 'Project name', 120),
      description: optionalTrimmed(args.description, 'Project description', 2_000),
      createdBy: user._id,
      isDefault: false,
      entryPath: workspace.project.entry,
      activeFilePath: workspace.activeFile,
      previewWidth: workspace.preview.width,
      revision: 1,
      createdAt: now,
      updatedAt: now
    })
    await insertProjectFiles(ctx, projectId, workspace, user._id, now)
    await ctx.db.patch(user._id, { activeTeamId: args.teamId, activeProjectId: projectId })
    return hydrateWorkspace((await ctx.db.get(projectId))!, await loadProjectFiles(ctx, projectId))
  }
})

export const saveWorkspace = mutation({
  args: {
    projectId: v.id('projects'),
    expectedRevision: v.number(),
    workspace: workspaceValidator
  },
  returns: saveResultValidator,
  handler: async (ctx, args) => {
    const { project, user } = await requireProjectMember(ctx, args.projectId)
    if (!Number.isSafeInteger(args.expectedRevision) || args.expectedRevision < 1) {
      throw new ConvexError({ code: 'INVALID_ARGUMENT', message: 'Expected revision must be a positive integer.' })
    }
    if (project.revision !== args.expectedRevision) {
      throw new ConvexError({
        code: 'CONFLICT',
        message: 'The project changed in another session. Reload before saving again.',
        currentRevision: project.revision
      })
    }

    const workspace = validateWorkspace(args.workspace)
    const now = Date.now()
    await replaceProjectFiles(ctx, project, workspace, user._id, now)
    const revision = project.revision + 1
    await ctx.db.patch(project._id, {
      entryPath: workspace.project.entry,
      activeFilePath: workspace.activeFile,
      previewWidth: workspace.preview.width,
      revision,
      updatedAt: now
    })
    await ctx.db.patch(project.teamId, { updatedAt: now })
    return { projectId: project._id, revision, updatedAt: now }
  }
})

export const updateMetadata = mutation({
  args: {
    projectId: v.id('projects'),
    name: v.optional(v.string()),
    description: v.optional(v.string())
  },
  returns: schema.doc('projects'),
  handler: async (ctx, args) => {
    const { project } = await requireProjectMember(ctx, args.projectId)
    const now = Date.now()
    const patch: { name?: string; description?: string; updatedAt: number } = { updatedAt: now }
    if (args.name !== undefined) patch.name = requireTrimmed(args.name, 'Project name', 120)
    if (args.description !== undefined) {
      patch.description = optionalTrimmed(args.description, 'Project description', 2_000)
    }
    await ctx.db.patch(project._id, patch)
    return (await ctx.db.get(project._id))!
  }
})
