import { ConvexError, v } from 'convex/values'
import type { Id } from './_generated/dataModel'
import { internalMutation, mutation, query, type QueryCtx } from './_generated/server'
import { appError, requireCurrentUser, requireTeamMember } from './auth'
import { requireTrimmed } from './utils'
import { presetStatusValidator, themeTokensValidator } from './validators'
import { MAX_STORED_DEPTH, depthOf } from '../src/playground/studio/ir/storage'
import { parseStoredPreset } from '../src/playground/studio/ir/schema'

/**
 * The section preset catalog: the JSON documents the Design Studio composes pages from.
 *
 * Built-in presets have no `teamId` and are readable by anyone; a team's own presets are readable by its members.
 * Listing returns summaries only — a preset's tree is fetched when it is previewed or added, so opening the library
 * costs one small, cached, reactive query instead of the whole catalog.
 */

const summaryValidator = v.object({
  presetId: v.string(),
  kind: v.string(),
  title: v.string(),
  description: v.string(),
  wireframe: v.array(v.string()),
  keywords: v.array(v.string()),
  teamId: v.optional(v.id('teams')),
  version: v.number(),
  updatedAt: v.number()
})
const documentValidator = v.object({
  presetId: v.string(),
  kind: v.string(),
  version: v.number(),
  updatedAt: v.number(),
  /** A `StoredPreset`: the flat node list, which the client rebuilds into a tree with `inflatePreset`. */
  document: v.any()
})
const recipeValidator = v.object({
  recipeId: v.string(),
  title: v.string(),
  description: v.string(),
  presetIds: v.array(v.string())
})
const themeValidator = v.object({
  themeId: v.string(),
  name: v.string(),
  description: v.string(),
  tokens: themeTokensValidator,
  dark: v.optional(themeTokensValidator)
})

const MAX_CATALOG = 500
const MAX_DOCUMENTS = 60

/**
 * Convex refuses a document nested past 16 levels. A flat preset sits around seven, but a style with deep
 * arbitrary values could still creep up, so every write is checked rather than left to fail inside the insert.
 */
function guardDepth(preset: unknown, presetId: string) {
  const depth = depthOf(preset)
  if (depth > MAX_STORED_DEPTH - 2) {
    throw appError('preset-too-nested', `Preset "${presetId}" nests ${depth} levels; the limit is ${MAX_STORED_DEPTH - 2}.`)
  }
}

/** Confirms the caller may read a team's presets; built-in presets need no identity. */
async function scope(ctx: QueryCtx, teamId: Id<'teams'> | undefined) {
  if (teamId) await requireTeamMember(ctx, teamId)
  return teamId
}

const summarize = (preset: { presetId: string; kind: string; title: string; description: string; wireframe: string[]; keywords: string[]; teamId?: Id<'teams'>; version: number; updatedAt: number }) => ({
  presetId: preset.presetId,
  kind: preset.kind,
  title: preset.title,
  description: preset.description,
  wireframe: preset.wireframe,
  keywords: preset.keywords,
  teamId: preset.teamId,
  version: preset.version,
  updatedAt: preset.updatedAt
})

const published = (ctx: QueryCtx, teamId: Id<'teams'> | undefined) =>
  ctx.db
    .query('sectionPresets')
    .withIndex('by_teamId_and_status_and_kind', q => q.eq('teamId', teamId).eq('status', 'published'))
    .take(MAX_CATALOG)

/** Every preset the caller may use: the built-in catalog, plus the team's own when one is given. */
export const catalog = query({
  args: { teamId: v.optional(v.id('teams')) },
  returns: v.array(summaryValidator),
  handler: async (ctx, args) => {
    const team = await scope(ctx, args.teamId)
    const builtIns = await published(ctx, undefined)
    const owned = team ? await published(ctx, team) : []
    return [...builtIns, ...owned].map(summarize)
  }
})

/** Presets whose title, description, or keywords match every word of the query. */
export const search = query({
  args: { query: v.string(), kind: v.optional(v.string()), teamId: v.optional(v.id('teams')), limit: v.optional(v.number()) },
  returns: v.array(summaryValidator),
  handler: async (ctx, args) => {
    const team = await scope(ctx, args.teamId)
    const text = args.query.trim()
    if (!text) return []
    const limit = Math.min(Math.max(args.limit ?? 40, 1), MAX_CATALOG)
    const find = (scoped: Id<'teams'> | undefined) =>
      ctx.db
        .query('sectionPresets')
        .withSearchIndex('search_catalog', q => {
          const base = q.search('searchText', text).eq('status', 'published').eq('teamId', scoped)
          return args.kind ? base.eq('kind', args.kind) : base
        })
        .take(limit)
    const builtIns = await find(undefined)
    const owned = team ? await find(team) : []
    return [...builtIns, ...owned].slice(0, limit).map(summarize)
  }
})

async function readDocument(ctx: QueryCtx, presetId: string, teamId: Id<'teams'> | undefined) {
  const preset = await ctx.db.query('sectionPresets').withIndex('by_presetId', q => q.eq('presetId', presetId)).unique()
  if (!preset || preset.status === 'archived') return null
  // A team's preset is only readable by that team; a built-in is readable by anyone.
  if (preset.teamId && preset.teamId !== teamId) return null
  return { presetId: preset.presetId, kind: preset.kind, version: preset.version, updatedAt: preset.updatedAt, document: parseStoredPreset(preset.document) }
}

export const document = query({
  args: { presetId: v.string(), teamId: v.optional(v.id('teams')) },
  returns: v.union(documentValidator, v.null()),
  handler: async (ctx, args) => readDocument(ctx, args.presetId, await scope(ctx, args.teamId))
})

/** The documents for a set of presets, for opening a page or starting from a recipe in one round trip. */
export const documents = query({
  args: { presetIds: v.array(v.string()), teamId: v.optional(v.id('teams')) },
  returns: v.array(documentValidator),
  handler: async (ctx, args) => {
    if (args.presetIds.length > MAX_DOCUMENTS) throw appError('too-many-presets', `Ask for at most ${MAX_DOCUMENTS} presets at a time.`)
    const team = await scope(ctx, args.teamId)
    const found = await Promise.all([...new Set(args.presetIds)].map(presetId => readDocument(ctx, presetId, team)))
    return found.filter(preset => preset !== null)
  }
})

export const recipes = query({
  args: { teamId: v.optional(v.id('teams')) },
  returns: v.array(recipeValidator),
  handler: async (ctx, args) => {
    const team = await scope(ctx, args.teamId)
    const read = async (scoped: Id<'teams'> | undefined) =>
      ctx.db.query('pageRecipes').withIndex('by_teamId_and_updatedAt', q => q.eq('teamId', scoped)).take(MAX_CATALOG)
    const all = [...(await read(undefined)), ...(team ? await read(team) : [])]
    return all
      .filter(recipe => recipe.status === 'published')
      .map(recipe => ({ recipeId: recipe.recipeId, title: recipe.title, description: recipe.description, presetIds: recipe.presetIds }))
  }
})

export const themes = query({
  args: { teamId: v.optional(v.id('teams')) },
  returns: v.array(themeValidator),
  handler: async (ctx, args) => {
    const team = await scope(ctx, args.teamId)
    const read = async (scoped: Id<'teams'> | undefined) =>
      ctx.db.query('themes').withIndex('by_teamId_and_updatedAt', q => q.eq('teamId', scoped)).take(MAX_CATALOG)
    const all = [...(await read(undefined)), ...(team ? await read(team) : [])]
    return all
      .filter(theme => theme.status === 'published')
      .map(theme => ({ themeId: theme.themeId, name: theme.name, description: theme.description, tokens: theme.tokens, dark: theme.dark }))
  }
})

/** Creates or updates a team's own preset. Built-in presets are seeded, not written through this. */
export const save = mutation({
  args: {
    teamId: v.id('teams'),
    presetId: v.optional(v.string()),
    kind: v.string(),
    title: v.string(),
    description: v.string(),
    wireframe: v.array(v.string()),
    keywords: v.array(v.string()),
    document: v.any(),
    status: v.optional(presetStatusValidator)
  },
  returns: v.object({ presetId: v.string(), version: v.number() }),
  handler: async (ctx, args) => {
    const user = await requireCurrentUser(ctx)
    await requireTeamMember(ctx, args.teamId)
    const title = requireTrimmed(args.title, 'Title', 200)
    // The stored preset is the trust boundary: reject anything the renderer could not safely turn back into source.
    const parsed = parseStoredPreset(args.document)
    guardDepth(parsed, args.presetId ?? parsed.id)
    const now = Date.now()
    const keywords = args.keywords.map(keyword => keyword.trim()).filter(Boolean).slice(0, 32)
    const fields = {
      kind: requireTrimmed(args.kind, 'Kind', 64),
      title,
      description: args.description.trim().slice(0, 2000),
      wireframe: args.wireframe.slice(0, 24),
      keywords,
      searchText: [title, args.description, ...keywords].join(' ').slice(0, 4000),
      document: parsed,
      schemaVersion: parsed.schemaVersion,
      status: args.status ?? 'published',
      teamId: args.teamId,
      createdBy: user._id,
      updatedAt: now
    }

    if (args.presetId) {
      const existing = await ctx.db.query('sectionPresets').withIndex('by_presetId', q => q.eq('presetId', args.presetId!)).unique()
      if (!existing) throw appError('preset-not-found', 'That preset no longer exists.')
      if (existing.teamId !== args.teamId) throw appError('preset-not-editable', 'Built-in presets cannot be edited; duplicate one instead.')
      await ctx.db.patch(existing._id, { ...fields, version: existing.version + 1 })
      return { presetId: existing.presetId, version: existing.version + 1 }
    }

    // Team presets carry a random suffix so their ids never collide with a built-in or another team's.
    const presetId = `${parsed.kind}-${crypto.randomUUID().slice(0, 8)}`
    await ctx.db.insert('sectionPresets', { ...fields, presetId, version: 1, createdAt: now })
    return { presetId, version: 1 }
  }
})

export const archive = mutation({
  args: { teamId: v.id('teams'), presetId: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireTeamMember(ctx, args.teamId)
    const preset = await ctx.db.query('sectionPresets').withIndex('by_presetId', q => q.eq('presetId', args.presetId)).unique()
    if (!preset || preset.teamId !== args.teamId) throw appError('preset-not-found', 'That preset no longer exists.')
    await ctx.db.patch(preset._id, { status: 'archived', updatedAt: Date.now() })
    return null
  }
})

/**
 * Replaces the built-in catalog, in batches, from `scripts/seed-presets.ts`. Internal: the built-ins are part of
 * the product, not user data, so they are never writable over the public API.
 */
export const seedBuiltIns = internalMutation({
  args: {
    presets: v.array(v.object({
      presetId: v.string(),
      kind: v.string(),
      title: v.string(),
      description: v.string(),
      wireframe: v.array(v.string()),
      keywords: v.array(v.string()),
      document: v.any()
    }))
  },
  returns: v.object({ inserted: v.number(), updated: v.number() }),
  handler: async (ctx, args) => {
    const now = Date.now()
    let inserted = 0
    let updated = 0
    for (const preset of args.presets) {
      const parsed = parseStoredPreset(preset.document)
      if (parsed.id !== preset.presetId) throw new ConvexError(`Preset "${preset.presetId}" carries the id "${parsed.id}".`)
      guardDepth(parsed, preset.presetId)
      const fields = {
        presetId: preset.presetId,
        kind: preset.kind,
        title: preset.title,
        description: preset.description,
        wireframe: preset.wireframe,
        keywords: preset.keywords,
        searchText: [preset.title, preset.description, ...preset.keywords].join(' ').slice(0, 4000),
        document: parsed,
        schemaVersion: parsed.schemaVersion,
        status: 'published' as const,
        updatedAt: now
      }
      const existing = await ctx.db.query('sectionPresets').withIndex('by_presetId', q => q.eq('presetId', preset.presetId)).unique()
      if (existing && existing.teamId) throw new ConvexError(`"${preset.presetId}" is owned by a team.`)
      if (existing) { await ctx.db.patch(existing._id, { ...fields, version: existing.version + 1 }); updated++ }
      else { await ctx.db.insert('sectionPresets', { ...fields, version: 1, createdAt: now }); inserted++ }
    }
    return { inserted, updated }
  }
})

export const seedRecipes = internalMutation({
  args: { recipes: v.array(v.object({ recipeId: v.string(), title: v.string(), description: v.string(), presetIds: v.array(v.string()) })) },
  returns: v.object({ inserted: v.number(), updated: v.number() }),
  handler: async (ctx, args) => {
    const now = Date.now()
    let inserted = 0
    let updated = 0
    for (const recipe of args.recipes) {
      const fields = { ...recipe, status: 'published' as const, updatedAt: now }
      const existing = await ctx.db.query('pageRecipes').withIndex('by_recipeId', q => q.eq('recipeId', recipe.recipeId)).unique()
      if (existing) { await ctx.db.patch(existing._id, fields); updated++ }
      else { await ctx.db.insert('pageRecipes', { ...fields, createdAt: now }); inserted++ }
    }
    return { inserted, updated }
  }
})
