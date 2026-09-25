import { ConvexError } from 'convex/values'
import type { Doc, Id } from './_generated/dataModel'
import type { MutationCtx, QueryCtx } from './_generated/server'
import type { previewWidthValidator, workspaceValidator } from './validators'

export const MAX_PROJECT_FILES = 200
export const MAX_PROJECT_CHARACTERS = 2_000_000
const MAX_FILE_BYTES = 900_000
const SUPPORTED_EXTENSION = /\.(btsx|tsrx|ts|js|json|css|html|md)$/

export type Workspace = typeof workspaceValidator.type
export type PreviewWidth = typeof previewWidthValidator.type

export function normalizeProjectPath(input: string) {
  if (!input || /[\0?#:]/.test(input)) {
    throw new ConvexError({ code: 'INVALID_PATH', message: `Invalid project path: ${input}` })
  }

  const parts: string[] = []
  for (const part of input.replaceAll('\\', '/').split('/')) {
    if (!part || part === '.') continue
    if (part === '..') {
      if (parts.length === 0) {
        throw new ConvexError({ code: 'INVALID_PATH', message: `Path escapes the project: ${input}` })
      }
      parts.pop()
    } else {
      parts.push(part)
    }
  }

  if (parts.length === 0) {
    throw new ConvexError({ code: 'INVALID_PATH', message: 'A file path is required.' })
  }

  const path = `/${parts.join('/')}`
  if (path.length > 1024 || !SUPPORTED_EXTENSION.test(path)) {
    throw new ConvexError({
      code: 'INVALID_PATH',
      message: 'Files must use .btsx, .tsrx, .ts, .js, .json, .css, .html, or .md and paths must be at most 1,024 characters.'
    })
  }
  return path
}

export function languageForPath(path: string): Doc<'projectFiles'>['language'] {
  if (path.endsWith('.btsx')) return 'btsx'
  if (path.endsWith('.tsrx')) return 'tsrx'
  if (path.endsWith('.ts')) return 'typescript'
  if (path.endsWith('.js')) return 'javascript'
  if (path.endsWith('.json')) return 'json'
  if (path.endsWith('.html')) return 'html'
  if (path.endsWith('.md')) return 'markdown'
  return 'css'
}

export function validateWorkspace(workspace: Workspace): Workspace {
  const entries = Object.entries(workspace.project.files)
  if (entries.length === 0 || entries.length > MAX_PROJECT_FILES) {
    throw new ConvexError({
      code: 'PROJECT_LIMIT',
      message: `Projects must contain between 1 and ${MAX_PROJECT_FILES} files.`
    })
  }

  let characters = 0
  const normalizedFiles: Record<string, string> = {}
  const encoder = new TextEncoder()
  for (const [inputPath, content] of entries) {
    const path = normalizeProjectPath(inputPath)
    if (Object.hasOwn(normalizedFiles, path)) {
      throw new ConvexError({ code: 'INVALID_PATH', message: `Duplicate normalized path: ${path}` })
    }
    if (encoder.encode(content).byteLength > MAX_FILE_BYTES) {
      throw new ConvexError({ code: 'PROJECT_LIMIT', message: `${path} is too large for cloud storage.` })
    }
    characters += path.length + content.length
    normalizedFiles[path] = content
  }

  if (characters > MAX_PROJECT_CHARACTERS) {
    throw new ConvexError({
      code: 'PROJECT_LIMIT',
      message: `Project source and paths must total at most ${MAX_PROJECT_CHARACTERS.toLocaleString()} characters.`
    })
  }

  const entry = normalizeProjectPath(workspace.project.entry)
  const activeFile = normalizeProjectPath(workspace.activeFile)
  if (!Object.hasOwn(normalizedFiles, entry)) {
    throw new ConvexError({ code: 'INVALID_PROJECT', message: 'The project entry file does not exist.' })
  }
  if (!Object.hasOwn(normalizedFiles, activeFile)) {
    throw new ConvexError({ code: 'INVALID_PROJECT', message: 'The active file does not exist.' })
  }

  return {
    version: 1,
    project: { entry, files: normalizedFiles },
    activeFile,
    preview: { width: workspace.preview.width }
  }
}

export async function loadProjectFiles(ctx: QueryCtx | MutationCtx, projectId: Id<'projects'>) {
  const files = await ctx.db
    .query('projectFiles')
    .withIndex('by_projectId', (q) => q.eq('projectId', projectId))
    .take(MAX_PROJECT_FILES + 1)
  if (files.length > MAX_PROJECT_FILES) {
    throw new ConvexError({ code: 'DATA_INTEGRITY', message: 'This project exceeds the supported file limit.' })
  }
  return files
}

export function hydrateWorkspace(project: Doc<'projects'>, files: Doc<'projectFiles'>[]) {
  return {
    projectId: project._id,
    teamId: project.teamId,
    projectName: project.name,
    revision: project.revision,
    updatedAt: project.updatedAt,
    workspace: {
      version: 1 as const,
      project: {
        entry: project.entryPath,
        files: Object.fromEntries(files.map((file) => [file.path, file.content]))
      },
      activeFile: project.activeFilePath,
      preview: { width: project.previewWidth }
    }
  }
}

export async function insertProjectFiles(
  ctx: MutationCtx,
  projectId: Id<'projects'>,
  workspace: Workspace,
  userId: Id<'users'>,
  now: number
) {
  for (const [path, content] of Object.entries(workspace.project.files)) {
    await ctx.db.insert('projectFiles', {
      projectId,
      path,
      content,
      language: languageForPath(path),
      revision: 1,
      createdBy: userId,
      updatedBy: userId,
      createdAt: now,
      updatedAt: now
    })
  }
}

export async function replaceProjectFiles(
  ctx: MutationCtx,
  project: Doc<'projects'>,
  workspace: Workspace,
  userId: Id<'users'>,
  now: number
) {
  const existing = await loadProjectFiles(ctx, project._id)
  const incoming = new Map(Object.entries(workspace.project.files))

  for (const file of existing) {
    const content = incoming.get(file.path)
    if (content === undefined) {
      await ctx.db.delete(file._id)
      continue
    }
    incoming.delete(file.path)
    if (file.content !== content) {
      await ctx.db.patch(file._id, {
        content,
        language: languageForPath(file.path),
        revision: file.revision + 1,
        updatedBy: userId,
        updatedAt: now
      })
    }
  }

  for (const [path, content] of incoming) {
    await ctx.db.insert('projectFiles', {
      projectId: project._id,
      path,
      content,
      language: languageForPath(path),
      revision: 1,
      createdBy: userId,
      updatedBy: userId,
      createdAt: now,
      updatedAt: now
    })
  }
}
