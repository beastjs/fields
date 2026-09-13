import { expect, test } from 'bun:test'
import type { Id } from '../convex/_generated/dataModel'
import {
  CloudProjectController,
  connectCloudProjectPersistence,
  type CloudAuthSource,
  type CloudProjectGateway,
  type CloudWorkspaceRecord
} from '../src/playground/cloud-project-persistence'
import type { ConvexAuthState } from '../src/lib/convex-client'
import { PlaygroundSession } from '../src/playground/session'
import type { SavedWorkspace } from '../src/playground/project-storage'

const projectId = 'project_1' as Id<'projects'>
const otherProjectId = 'project_2' as Id<'projects'>
const teamId = 'team_1' as Id<'teams'>
const otherTeamId = 'team_2' as Id<'teams'>
const localWorkspace = (): SavedWorkspace => ({
  version: 1,
  project: {
    entry: '/src/main.ts',
    files: { '/src/main.ts': '', '/src/App.btsx': 'h1 Local\n' }
  },
  activeFile: '/src/App.btsx',
  preview: { width: '100%' }
})
const remoteWorkspace = (): SavedWorkspace => ({
  ...localWorkspace(),
  project: {
    entry: '/src/main.ts',
    files: { '/src/main.ts': '', '/src/App.btsx': 'h1 Cloud\n' }
  },
  preview: { width: '375px' }
})

class AuthSource implements CloudAuthSource {
  private listeners = new Set<() => void>()
  private state: ConvexAuthState = { isAuthenticated: true, isLoading: false, userId: 'firebase-user' }
  getSnapshot = () => this.state
  subscribe = (listener: () => void) => {
    this.listeners.add(listener)
    return () => { this.listeners.delete(listener) }
  }
  signOut() {
    this.state = { isAuthenticated: false, isLoading: false, userId: null }
    for (const listener of this.listeners) listener()
  }
}

const createSession = () => new PlaygroundSession({
  project: localWorkspace().project,
  activeFile: localWorkspace().activeFile,
  createWorker: () => ({ onmessage: null, onerror: null, postMessage() {}, terminate() {} })
})
const tick = (ms = 20) => new Promise((resolve) => setTimeout(resolve, ms))
const unavailableGatewayMethods = {
  selectWorkspace: async (): Promise<never> => { throw new Error('Not used in this test.') },
  createTeam: async (): Promise<never> => { throw new Error('Not used in this test.') },
  createProject: async (): Promise<never> => { throw new Error('Not used in this test.') }
}
const cloudRecord = (
  workspace: SavedWorkspace,
  revision: number,
  id = projectId,
  owningTeamId = teamId,
  projectName = 'My project'
): CloudWorkspaceRecord => ({
  projectId: id,
  teamId: owningTeamId,
  projectName,
  revision,
  updatedAt: 1,
  workspace
})

test('loads the authenticated cloud workspace and saves authored changes with its revision', async () => {
  const session = createSession()
  const auth = new AuthSource()
  const saves: Parameters<CloudProjectGateway['saveWorkspace']>[0][] = []
  const gateway: CloudProjectGateway = {
    ...unavailableGatewayMethods,
    ensureDefault: async () => cloudRecord(remoteWorkspace(), 4),
    saveWorkspace: async (input) => {
      saves.push(input)
      return { projectId, revision: input.expectedRevision + 1, updatedAt: 2 }
    }
  }
  const connection = connectCloudProjectPersistence(session, gateway, auth, 5)

  await tick()
  expect(session.exportWorkspace()).toEqual(remoteWorkspace())
  expect(session.getSnapshot().saveStatus.label).toBe('Saved to cloud')

  session.updateSource('/src/App.btsx', 'h1 Edited\n')
  await tick()
  expect(saves).toHaveLength(1)
  expect(saves[0]).toMatchObject({ projectId, expectedRevision: 4 })
  expect(saves[0].workspace.project.files['/src/App.btsx']).toBe('h1 Edited\n')
  expect(session.getSnapshot().saveStatus.label).toBe('Saved to cloud')

  connection.dispose()
  session.dispose()
})

test('surfaces a stale revision without overwriting newer cloud data', async () => {
  const session = createSession()
  const auth = new AuthSource()
  let attempts = 0
  const existing = cloudRecord(localWorkspace(), 7)
  const gateway: CloudProjectGateway = {
    ...unavailableGatewayMethods,
    ensureDefault: async () => existing,
    saveWorkspace: async () => {
      attempts += 1
      throw { data: { code: 'CONFLICT', currentRevision: 8 } }
    }
  }
  const connection = connectCloudProjectPersistence(session, gateway, auth, 5)

  await tick()
  session.updateSource('/src/App.btsx', 'h1 Stale edit\n')
  await tick()
  expect(attempts).toBe(1)
  expect(session.getSnapshot().saveStatus.label).toBe('Cloud conflict')
  expect(session.getSnapshot().saveStatus.issue).toContain('newer cloud version')

  session.updateSource('/src/App.btsx', 'h1 Still local\n')
  await tick()
  expect(attempts).toBe(1)

  connection.dispose()
  session.dispose()
})

test('stops cloud writes after sign-out', async () => {
  const session = createSession()
  const auth = new AuthSource()
  let saves = 0
  const gateway: CloudProjectGateway = {
    ...unavailableGatewayMethods,
    ensureDefault: async () => cloudRecord(localWorkspace(), 1),
    saveWorkspace: async () => ({ projectId, revision: ++saves + 1, updatedAt: 2 })
  }
  const connection = connectCloudProjectPersistence(session, gateway, auth, 5)

  await tick()
  auth.signOut()
  session.updateSource('/src/App.btsx', 'h1 Offline\n')
  await tick()
  expect(saves).toBe(0)
  expect(session.getSnapshot().saveStatus.label).toBe('Saved locally')

  connection.dispose()
  session.dispose()
})

test('saves the current project before selecting and loading another signed-in project', async () => {
  const session = createSession()
  const auth = new AuthSource()
  const controller = new CloudProjectController()
  const calls: string[] = []
  const gateway: CloudProjectGateway = {
    ...unavailableGatewayMethods,
    ensureDefault: async () => cloudRecord(localWorkspace(), 3),
    selectWorkspace: async (selectedProjectId) => {
      calls.push(`select:${selectedProjectId}`)
      return cloudRecord(remoteWorkspace(), 8, otherProjectId, otherTeamId, 'Cloud project')
    },
    saveWorkspace: async (input) => {
      calls.push(`save:${input.projectId}`)
      return { projectId: input.projectId, revision: input.expectedRevision + 1, updatedAt: 2 }
    }
  }
  const connection = connectCloudProjectPersistence(session, gateway, auth, 500, controller)

  await tick()
  session.updateSource('/src/App.btsx', 'h1 Save before leaving\n')
  await controller.selectProject({ projectId: otherProjectId, teamId: otherTeamId, name: 'Cloud project' })

  expect(calls).toEqual([`save:${projectId}`, `select:${otherProjectId}`])
  expect(session.exportWorkspace()).toEqual(remoteWorkspace())
  expect(controller.getSnapshot()).toMatchObject({
    activeTeamId: otherTeamId,
    activeProjectId: otherProjectId,
    activeProjectName: 'Cloud project',
    isSwitching: false,
    error: ''
  })

  connection.dispose()
  session.dispose()
})
