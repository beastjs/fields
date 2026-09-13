import type { Doc, Id } from '../../convex/_generated/dataModel'
import type { api } from '../../convex/_generated/api'
import {
  convexClient,
  getConvexAuthState,
  subscribeToConvexAuthState,
  type ConvexAuthState
} from '../lib/convex-client'
import type { PlaygroundSession, SessionSnapshot } from './session'
import { encodeWorkspace, type SavedWorkspace } from './project-storage'

export type CloudProjectId = Id<'projects'>
export type CloudTeamId = Id<'teams'>

export interface CloudWorkspaceRecord {
  projectId: CloudProjectId
  teamId: CloudTeamId
  projectName: string
  revision: number
  updatedAt: number
  workspace: SavedWorkspace
}

export interface CloudSaveResult {
  projectId: CloudProjectId
  revision: number
  updatedAt: number
}

export interface CloudProjectGateway {
  ensureDefault(workspace: SavedWorkspace): Promise<CloudWorkspaceRecord>
  selectWorkspace(projectId: CloudProjectId): Promise<CloudWorkspaceRecord>
  createTeam(name: string): Promise<{ team: Doc<'teams'>; membership: Doc<'teamMembers'> }>
  createProject(input: {
    teamId: CloudTeamId
    name: string
    workspace: SavedWorkspace
  }): Promise<CloudWorkspaceRecord>
  saveWorkspace(input: {
    projectId: CloudProjectId
    expectedRevision: number
    workspace: SavedWorkspace
  }): Promise<CloudSaveResult>
}

export interface CloudAuthSource {
  getSnapshot(): ConvexAuthState
  subscribe(listener: () => void): () => void
}

export interface CloudProjectChoice {
  projectId: CloudProjectId
  teamId: CloudTeamId
  name: string
}

export interface CloudProjectSnapshot {
  activeTeamId: CloudTeamId | null
  activeProjectId: CloudProjectId | null
  activeProjectName: string | null
  isSwitching: boolean
  error: string
}

interface CloudProjectActions {
  selectProject(choice: CloudProjectChoice): Promise<void>
  createTeam(name: string, workspace: SavedWorkspace): Promise<void>
  createProject(teamId: CloudTeamId, name: string, workspace: SavedWorkspace): Promise<void>
}

const emptyCloudSnapshot = (): CloudProjectSnapshot => ({
  activeTeamId: null,
  activeProjectId: null,
  activeProjectName: null,
  isSwitching: false,
  error: ''
})

/** Shared UI-facing state for the cloud connection belonging to one playground. */
export class CloudProjectController {
  private state = emptyCloudSnapshot()
  private listeners = new Set<() => void>()
  private actions: CloudProjectActions | null = null

  getSnapshot = () => this.state
  subscribe = (listener: () => void) => {
    this.listeners.add(listener)
    return () => { this.listeners.delete(listener) }
  }

  private patch(patch: Partial<CloudProjectSnapshot>) {
    const next = { ...this.state, ...patch }
    if (
      next.activeTeamId === this.state.activeTeamId &&
      next.activeProjectId === this.state.activeProjectId &&
      next.activeProjectName === this.state.activeProjectName &&
      next.isSwitching === this.state.isSwitching &&
      next.error === this.state.error
    ) return
    this.state = next
    for (const listener of this.listeners) listener()
  }

  connect(actions: CloudProjectActions) {
    this.actions = actions
    return () => { if (this.actions === actions) this.actions = null }
  }

  activate(record: Pick<CloudWorkspaceRecord, 'projectId' | 'teamId' | 'projectName'>) {
    this.patch({
      activeTeamId: record.teamId,
      activeProjectId: record.projectId,
      activeProjectName: record.projectName,
      error: ''
    })
  }

  reset() {
    this.state = emptyCloudSnapshot()
    for (const listener of this.listeners) listener()
  }

  selectTeam(teamId: CloudTeamId) {
    if (this.state.activeTeamId === teamId) return
    this.patch({ activeTeamId: teamId, activeProjectId: null, activeProjectName: null, error: '' })
  }

  synchronizeProject(choice: CloudProjectChoice) {
    if (this.state.activeProjectId !== choice.projectId) return
    this.patch({ activeTeamId: choice.teamId, activeProjectName: choice.name })
  }

  setSwitching(isSwitching: boolean) {
    this.patch({ isSwitching })
  }

  reportError(error: unknown) {
    this.patch({ error: error instanceof Error ? error.message : 'Unable to update the cloud workspace.' })
  }

  private async run(action: (actions: CloudProjectActions) => Promise<void>) {
    if (!this.actions) {
      this.patch({ error: 'Sign in to manage cloud teams and projects.' })
      return
    }
    this.patch({ isSwitching: true, error: '' })
    try {
      await action(this.actions)
    } catch (error) {
      this.reportError(error)
    } finally {
      this.patch({ isSwitching: false })
    }
  }

  async selectProject(choice: CloudProjectChoice) {
    if (choice.projectId === this.state.activeProjectId) {
      this.synchronizeProject(choice)
      return
    }
    await this.run((actions) => actions.selectProject(choice))
  }

  async createTeam(name: string, workspace: SavedWorkspace) {
    await this.run((actions) => actions.createTeam(name, workspace))
  }

  async createProject(teamId: CloudTeamId, name: string, workspace: SavedWorkspace) {
    await this.run((actions) => actions.createProject(teamId, name, workspace))
  }
}

const ensureDefaultMutation =
  'projects:ensureDefault' as unknown as typeof api.projects.ensureDefault
const selectWorkspaceMutation =
  'projects:selectWorkspace' as unknown as typeof api.projects.selectWorkspace
const createTeamMutation =
  'teams:create' as unknown as typeof api.teams.create
const createProjectMutation =
  'projects:create' as unknown as typeof api.projects.create
const saveWorkspaceMutation =
  'projects:saveWorkspace' as unknown as typeof api.projects.saveWorkspace

const client = convexClient

export const convexCloudProjectGateway: CloudProjectGateway | null = client
  ? {
      ensureDefault: (workspace) => client.mutation(ensureDefaultMutation, { workspace }),
      selectWorkspace: (projectId) => client.mutation(selectWorkspaceMutation, { projectId }),
      createTeam: (name) => client.mutation(createTeamMutation, { name }),
      createProject: ({ teamId, name, workspace }) =>
        client.mutation(createProjectMutation, { teamId, name, workspace }),
      saveWorkspace: (input) => client.mutation(saveWorkspaceMutation, input)
    }
  : null

const defaultAuthSource: CloudAuthSource = {
  getSnapshot: getConvexAuthState,
  subscribe: subscribeToConvexAuthState
}

const authoredStateChanged = (previous: SessionSnapshot, next: SessionSnapshot) =>
  next.projectGeneration !== previous.projectGeneration ||
  next.project !== previous.project ||
  next.activeFile !== previous.activeFile ||
  next.previewWidth !== previous.previewWidth

const errorData = (error: unknown) => {
  if (!error || typeof error !== 'object' || !('data' in error)) return null
  const data = (error as { data?: unknown }).data
  return data && typeof data === 'object' ? data as Record<string, unknown> : null
}

const isConflict = (error: unknown) => errorData(error)?.code === 'CONFLICT'

/**
 * Adds authenticated Convex persistence around a session while localStorage
 * remains the offline and unload-safe cache. The server revision makes writes
 * from stale tabs fail instead of silently replacing newer cloud work.
 */
export function connectCloudProjectPersistence(
  session: PlaygroundSession,
  gateway: CloudProjectGateway,
  auth: CloudAuthSource = defaultAuthSource,
  delay = 650,
  controller = new CloudProjectController()
) {
  let disposed = false
  let operation = 0
  let projectId: CloudProjectId | null = null
  let revision = 0
  let previous = session.getSnapshot()
  let pending = false
  let saveFailed = false
  let timer: ReturnType<typeof setTimeout> | undefined
  let retryTimer: ReturnType<typeof setTimeout> | undefined
  let activeSave: Promise<void> | null = null
  let unsubscribeSession: (() => void) | undefined

  const stopProject = () => {
    operation += 1
    projectId = null
    revision = 0
    pending = false
    saveFailed = false
    clearTimeout(timer)
    clearTimeout(retryTimer)
    unsubscribeSession?.()
    unsubscribeSession = undefined
  }

  const publishFailure = (error: unknown, duringSave: boolean) => {
    const conflict = isConflict(error)
    session.setSaveStatus({
      label: conflict ? 'Cloud conflict' : 'Saved locally',
      issue: conflict
        ? 'A newer cloud version of this project exists. Your edits are still saved in this browser; reload to use the cloud version before editing again.'
        : `Cloud ${duringSave ? 'save' : 'sync'} is unavailable. Your edits are still saved in this browser and cloud sync will retry automatically.`
    })
    return conflict
  }

  const save = (): Promise<void> => {
    clearTimeout(timer)
    clearTimeout(retryTimer)
    retryTimer = undefined
    if (activeSave) return activeSave
    if (disposed || !projectId || !pending) return Promise.resolve()

    pending = false
    const saveOperation = operation
    const targetProjectId = projectId
    const expectedRevision = revision
    const workspace = session.exportWorkspace()
    const serialized = encodeWorkspace(workspace)
    saveFailed = false

    activeSave = (async () => {
      try {
        const result = await gateway.saveWorkspace({ projectId: targetProjectId, expectedRevision, workspace })
        if (disposed || saveOperation !== operation) return
        revision = result.revision

        if (encodeWorkspace(session.exportWorkspace()) === serialized && !pending) {
          session.setSaveStatus({ label: 'Saved to cloud' })
        } else {
          pending = true
        }
      } catch (error) {
        if (disposed || saveOperation !== operation) return
        saveFailed = true
        const conflict = publishFailure(error, true)
        if (conflict) {
          projectId = null
          unsubscribeSession?.()
          unsubscribeSession = undefined
        } else {
          pending = true
          retryTimer = setTimeout(() => {
            retryTimer = undefined
            void save()
          }, 5_000)
        }
      } finally {
        activeSave = null
        if (saveOperation === operation) {
          if (pending && projectId && !retryTimer) timer = setTimeout(() => { void save() }, 0)
        }
      }
    })()

    return activeSave
  }

  const flushCurrentProject = async () => {
    if (activeSave) await activeSave
    if (pending) await save()
    if (activeSave) await activeSave
    if (pending || saveFailed) {
      throw new Error('Save the current project to the cloud before switching.')
    }
  }

  const schedule = () => {
    if (!projectId) return
    pending = true
    clearTimeout(timer)
    clearTimeout(retryTimer)
    retryTimer = undefined
    session.setSaveStatus({ label: 'Saving to cloud…' })
    timer = setTimeout(() => { void save() }, delay)
  }

  const watchSession = () => {
    previous = session.getSnapshot()
    unsubscribeSession = session.subscribe(() => {
      const next = session.getSnapshot()
      const changed = authoredStateChanged(previous, next)
      previous = next
      if (changed) schedule()
    })
  }

  const adoptWorkspace = (result: CloudWorkspaceRecord) => {
    const cloudWorkspace = JSON.parse(encodeWorkspace(result.workspace)) as SavedWorkspace
    projectId = result.projectId
    revision = result.revision
    pending = false
    saveFailed = false
    if (encodeWorkspace(cloudWorkspace) !== encodeWorkspace(session.exportWorkspace())) {
      session.importWorkspace(cloudWorkspace)
    }
    watchSession()
    controller.activate(result)
    session.setSaveStatus({ label: 'Saved to cloud' })
  }

  const switchProject = async (choice: CloudProjectChoice) => {
    await flushCurrentProject()
    const switchOperation = operation
    session.setSaveStatus({ label: 'Loading cloud project…' })
    const result = await gateway.selectWorkspace(choice.projectId)
    if (disposed || switchOperation !== operation) return
    await flushCurrentProject()
    if (disposed || switchOperation !== operation) return
    stopProject()
    adoptWorkspace(result)
  }

  const createTeam = async (name: string, workspace: SavedWorkspace) => {
    await flushCurrentProject()
    const createOperation = operation
    const result = await gateway.createTeam(name)
    const project = await gateway.createProject({ teamId: result.team._id, name: 'My project', workspace })
    if (disposed || createOperation !== operation) return
    await flushCurrentProject()
    if (disposed || createOperation !== operation) return
    stopProject()
    adoptWorkspace(project)
  }

  const createProject = async (teamId: CloudTeamId, name: string, workspace: SavedWorkspace) => {
    await flushCurrentProject()
    const createOperation = operation
    const project = await gateway.createProject({ teamId, name, workspace })
    if (disposed || createOperation !== operation) return
    await flushCurrentProject()
    if (disposed || createOperation !== operation) return
    stopProject()
    adoptWorkspace(project)
  }

  const disconnectController = controller.connect({ selectProject: switchProject, createTeam, createProject })

  const initialize = async (userId: string) => {
    stopProject()
    const initializeOperation = operation
    const localAtStart = encodeWorkspace(session.exportWorkspace())
    controller.setSwitching(true)
    session.setSaveStatus({ label: 'Connecting to cloud…' })

    try {
      const result = await gateway.ensureDefault(session.exportWorkspace())
      if (disposed || initializeOperation !== operation || auth.getSnapshot().userId !== userId) return

      const localNow = encodeWorkspace(session.exportWorkspace())
      if (localNow !== localAtStart) {
        publishFailure({ data: { code: 'CONFLICT' } }, false)
        return
      }

      adoptWorkspace(result)
    } catch (error) {
      if (disposed || initializeOperation !== operation) return
      const conflict = publishFailure(error, false)
      controller.reportError(error)
      if (!conflict) {
        retryTimer = setTimeout(() => {
          retryTimer = undefined
          const current = auth.getSnapshot()
          if (current.isAuthenticated && current.userId === userId) void initialize(userId)
        }, 5_000)
      }
    } finally {
      if (!disposed && initializeOperation === operation) controller.setSwitching(false)
    }
  }

  let authenticatedUserId: string | null = null
  const handleAuth = () => {
    const state = auth.getSnapshot()
    const nextUserId = state.isAuthenticated ? state.userId : null
    if (state.isLoading || nextUserId === authenticatedUserId) return
    authenticatedUserId = nextUserId

    if (nextUserId) {
      void initialize(nextUserId)
    } else {
      stopProject()
      controller.reset()
      session.setSaveStatus({ label: 'Saved locally' })
    }
  }

  const unsubscribeAuth = auth.subscribe(handleAuth)
  handleAuth()

  return {
    flush: save,
    dispose() {
      if (projectId && pending) void save()
      disposed = true
      stopProject()
      controller.reset()
      disconnectController()
      unsubscribeAuth()
    }
  }
}
