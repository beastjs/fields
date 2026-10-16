import { paginationOptsValidator, paginationResultValidator } from 'convex/server'
import { v } from 'convex/values'
import { requireProjectMember, appError } from './auth'
import { mutation, query } from './_generated/server'
import schema from './schema'
import { memoryNode, memoryRoot, memoryState } from './memoryValidators'

export const get = query({
  args: { projectId: v.id('projects') },
  returns: v.union(schema.doc('projectMemories'), v.null()),
  handler: async (ctx, { projectId }) => {
    await requireProjectMember(ctx, projectId)
    return ctx.db.query('projectMemories').withIndex('by_projectId', q => q.eq('projectId', projectId)).unique()
  }
})

export const listRecords = query({
  args: { projectId: v.id('projects'), revision: v.number(), paginationOpts: paginationOptsValidator },
  returns: paginationResultValidator(schema.doc('projectMemoryRecords')),
  handler: async (ctx, args) => {
    await requireProjectMember(ctx, args.projectId)
    const memory = await ctx.db.query('projectMemories').withIndex('by_projectId', q => q.eq('projectId', args.projectId)).unique()
    if ((memory?.revision ?? 0) !== args.revision) return appError('CONFLICT', 'Project memory changed while loading. Reopen the project to reload it.')
    return ctx.db.query('projectMemoryRecords').withIndex('by_projectId', q => q.eq('projectId', args.projectId)).paginate(args.paginationOpts)
  }
})

export const save = mutation({
  args: {
    projectId: v.id('projects'), expectedRevision: v.number(), state: memoryState,
    roots: v.array(memoryRoot), nodes: v.array(memoryNode)
  },
  returns: v.number(),
  handler: async (ctx, args) => {
    await requireProjectMember(ctx, args.projectId)
    const memory = await ctx.db.query('projectMemories').withIndex('by_projectId', q => q.eq('projectId', args.projectId)).unique()
    if ((memory?.revision ?? 0) !== args.expectedRevision) return appError('CONFLICT', 'Another tab updated this project’s memory. Reopen the project to reload it.')
    const previousCount = memory?.state.count ?? 0
    if (!Number.isSafeInteger(args.state.count) || args.state.count < 0 || !Number.isSafeInteger(args.expectedRevision) || args.expectedRevision < 0 || args.roots.length > 40 || args.nodes.length > 128 || args.state.count !== previousCount + args.roots.length ||
      args.state.view.length > 1024 || args.state.compactView.length > 1024) return appError('INVALID_ARGUMENT', 'Invalid memory update size.')
    // Validate new immutable records and view ranges without reading the entire history.
    const bytes = (text: string) => new TextEncoder().encode(text).length
    if (args.roots.some(root => bytes(root.text) > 30_000 || !Number.isFinite(root.date)) ||
      args.nodes.some(node => !node.text.trim() || bytes(node.text) > 30_000 || !Number.isSafeInteger(node.l) || node.l < 0 || node.l > 40 || !Number.isSafeInteger(node.i) || node.i < 0 || (node.i + 1) * 2 ** node.l > args.state.count)) {
      return appError('INVALID_ARGUMENT', 'Invalid memory records.')
    }
    for (const [parts, complete] of [[args.state.view, true], [args.state.compactView, false]] as const) {
      let cursor = 0
      for (const p of parts) {
        if (!Number.isSafeInteger(p.l) || p.l < 0 || p.l > 40 || !Number.isSafeInteger(p.i) || p.i < 0 || p.i * 2 ** p.l !== cursor) return appError('INVALID_ARGUMENT', 'Invalid memory view.')
        cursor = (p.i + 1) * 2 ** p.l
      }
      if (cursor > args.state.count || (complete && cursor !== args.state.count)) return appError('INVALID_ARGUMENT', 'Incomplete memory view.')
    }
    for (let i = 0; i < args.roots.length; i++) await ctx.db.insert('projectMemoryRecords', {
      projectId: args.projectId, key: `raw:${previousCount + i}`, record: { kind: 'root', index: previousCount + i, value: args.roots[i] }
    })
    for (const value of args.nodes) {
      const key = `${value.l}:${value.i}`
      const existing = await ctx.db.query('projectMemoryRecords').withIndex('by_projectId_and_key', q => q.eq('projectId', args.projectId).eq('key', key)).unique()
      if (existing) return appError('INVALID_ARGUMENT', 'Memory summaries are immutable.')
      await ctx.db.insert('projectMemoryRecords', { projectId: args.projectId, key, record: { kind: 'node', value } })
    }
    const checked = new Set<string>()
    const requireNode = async (l: number, i: number) => {
      const key = `${l}:${i}`
      if (checked.has(key)) return
      const node = await ctx.db.query('projectMemoryRecords').withIndex('by_projectId_and_key', q => q.eq('projectId', args.projectId).eq('key', key)).unique()
      if (!node) return appError('INVALID_ARGUMENT', 'Missing memory summary.')
      checked.add(key)
    }
    for (const node of args.nodes) {
      if (node.l > 0) { await requireNode(node.l - 1, node.i * 2); await requireNode(node.l - 1, node.i * 2 + 1) }
    }
    for (const part of args.state.view) if (part.l > 0) await requireNode(part.l, part.i)
    for (const part of args.state.compactView) await requireNode(part.l, part.i)
    const revision = args.expectedRevision + 1
    if (memory) await ctx.db.patch(memory._id, { state: args.state, revision })
    else await ctx.db.insert('projectMemories', { projectId: args.projectId, state: args.state, revision })
    return revision
  }
})
