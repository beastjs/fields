import { v } from 'convex/values'

export const teamRoleValidator = v.union(v.literal('owner'), v.literal('admin'), v.literal('member'))
export const invitationRoleValidator = v.union(v.literal('admin'), v.literal('member'))
export const invitationStatusValidator = v.union(
  v.literal('pending'),
  v.literal('accepted'),
  v.literal('revoked'),
  v.literal('expired')
)
export const previewWidthValidator = v.union(v.literal('100%'), v.literal('768px'), v.literal('375px'))
export const buildStatusValidator = v.union(
  v.literal('running'),
  v.literal('succeeded'),
  v.literal('failed'),
  v.literal('cancelled')
)
export const buildTriggerValidator = v.union(v.literal('automatic'), v.literal('manual'), v.literal('ai'))
export const logSourceValidator = v.union(
  v.literal('beast'),
  v.literal('octane'),
  v.literal('web'),
  v.literal('runtime'),
  v.literal('preview'),
  v.literal('chat'),
  v.literal('system')
)
export const logLevelValidator = v.union(
  v.literal('debug'),
  v.literal('info'),
  v.literal('warning'),
  v.literal('error')
)
export const fileLanguageValidator = v.union(
  v.literal('btsx'),
  v.literal('tsrx'),
  v.literal('typescript'),
  v.literal('javascript'),
  v.literal('json'),
  v.literal('css')
)

export const workspaceValidator = v.object({
  version: v.literal(1),
  project: v.object({
    entry: v.string(),
    files: v.record(v.string(), v.string())
  }),
  activeFile: v.string(),
  preview: v.object({ width: previewWidthValidator })
})

export const workspaceResultValidator = v.object({
  projectId: v.id('projects'),
  teamId: v.id('teams'),
  projectName: v.string(),
  revision: v.number(),
  updatedAt: v.number(),
  workspace: workspaceValidator
})

export const teamValidator = v.object({
  name: v.string(),
  description: v.optional(v.string()),
  kind: v.union(v.literal('personal'), v.literal('shared')),
  personalOwnerId: v.optional(v.id('users')),
  createdBy: v.id('users'),
  createdAt: v.number(),
  updatedAt: v.number(),
  archivedAt: v.optional(v.number())
})

export const teamMemberValidator = v.object({
  teamId: v.id('teams'),
  userId: v.id('users'),
  role: teamRoleValidator,
  invitedBy: v.optional(v.id('users')),
  joinedAt: v.number()
})

export const teamInvitationValidator = v.object({
  teamId: v.id('teams'),
  email: v.string(),
  role: invitationRoleValidator,
  status: invitationStatusValidator,
  invitedBy: v.id('users'),
  createdAt: v.number(),
  updatedAt: v.number(),
  expiresAt: v.number(),
  acceptedBy: v.optional(v.id('users'))
})

export const projectValidator = v.object({
  teamId: v.id('teams'),
  name: v.string(),
  description: v.optional(v.string()),
  createdBy: v.id('users'),
  isDefault: v.boolean(),
  entryPath: v.string(),
  activeFilePath: v.string(),
  previewWidth: previewWidthValidator,
  revision: v.number(),
  createdAt: v.number(),
  updatedAt: v.number(),
  archivedAt: v.optional(v.number())
})

export const projectFileValidator = v.object({
  projectId: v.id('projects'),
  path: v.string(),
  content: v.string(),
  language: fileLanguageValidator,
  revision: v.number(),
  createdBy: v.id('users'),
  updatedBy: v.id('users'),
  createdAt: v.number(),
  updatedAt: v.number()
})

export const chatValidator = v.object({
  projectId: v.id('projects'),
  agentThreadId: v.string(),
  title: v.string(),
  createdBy: v.id('users'),
  createdAt: v.number(),
  updatedAt: v.number(),
  archivedAt: v.optional(v.number())
})

export const buildRunValidator = v.object({
  projectId: v.id('projects'),
  initiatedBy: v.id('users'),
  trigger: buildTriggerValidator,
  status: buildStatusValidator,
  projectRevision: v.number(),
  compilerVersion: v.optional(v.string()),
  moduleCount: v.optional(v.number()),
  transformedFileCount: v.optional(v.number()),
  durationMs: v.optional(v.number()),
  startedAt: v.number(),
  completedAt: v.optional(v.number())
})

export const projectLogValidator = v.object({
  projectId: v.id('projects'),
  buildId: v.optional(v.id('buildRuns')),
  recordedBy: v.id('users'),
  source: logSourceValidator,
  level: logLevelValidator,
  message: v.string(),
  filePath: v.optional(v.string()),
  line: v.optional(v.number()),
  column: v.optional(v.number()),
  occurredAt: v.number(),
  createdAt: v.number()
})

export const presetStatusValidator = v.union(v.literal('published'), v.literal('draft'), v.literal('archived'))

/**
 * A stored section preset. `document` holds the preset's JSON tree: Convex validators cannot recurse, so the tree
 * is validated with the zod schema in `src/playground/studio/ir/schema.ts` on every write and on every read that
 * renders it. The fields beside it are denormalised copies used for indexing, search, and the library list, so the
 * catalog can be listed without loading a single tree.
 */
export const sectionPresetValidator = v.object({
  /** Globally unique and human-readable for built-ins (`cta-default`); suffixed for team-authored presets. */
  presetId: v.string(),
  kind: v.string(),
  title: v.string(),
  description: v.string(),
  wireframe: v.array(v.string()),
  keywords: v.array(v.string()),
  /** Title, description, and keywords joined, so one search index covers the catalog. */
  searchText: v.string(),
  document: v.any(),
  schemaVersion: v.number(),
  status: presetStatusValidator,
  /** Absent for the built-in catalog; set for presets a team authored. */
  teamId: v.optional(v.id('teams')),
  createdBy: v.optional(v.id('users')),
  version: v.number(),
  createdAt: v.number(),
  updatedAt: v.number()
})

/** A named set of design tokens, emitted into the preview as Tailwind `@theme` custom properties. */
export const themeTokensValidator = v.object({
  color: v.record(v.string(), v.string()),
  radius: v.optional(v.record(v.string(), v.string())),
  font: v.optional(v.record(v.string(), v.string())),
  spacing: v.optional(v.record(v.string(), v.string())),
  shadow: v.optional(v.record(v.string(), v.string()))
})

export const themeValidator = v.object({
  themeId: v.string(),
  name: v.string(),
  description: v.string(),
  tokens: themeTokensValidator,
  /** Overrides applied under `[data-theme=dark]`; absent for a theme that reads the same in both. */
  dark: v.optional(themeTokensValidator),
  status: presetStatusValidator,
  teamId: v.optional(v.id('teams')),
  createdBy: v.optional(v.id('users')),
  createdAt: v.number(),
  updatedAt: v.number()
})

/** An ordered starting point: the presets a recipe composes into a page. */
export const pageRecipeValidator = v.object({
  recipeId: v.string(),
  title: v.string(),
  description: v.string(),
  presetIds: v.array(v.string()),
  status: presetStatusValidator,
  teamId: v.optional(v.id('teams')),
  createdAt: v.number(),
  updatedAt: v.number()
})
