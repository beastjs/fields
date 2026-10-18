import type { api } from '../../convex/_generated/api'
import type { Id } from '../../convex/_generated/dataModel'
import type { FunctionReturnType } from 'convex/server'
import { convexClient, getConvexAuthState, subscribeToConvexAuthState } from '../lib/convex-client'
import type { CloudProjectController } from '../playground/cloud-project-persistence'
import type { ChatController } from './controller'
import { ProjectMemory, type MemoryRepository, type MemoryRoot, type MemorySnapshot, type MemoryUpdate } from './memory'
import { BrowserMemoryRepository } from './memory-storage'
import { createMemoryCompactor } from './memory-compactor'
import { BrowserConversationRepository, conversationFromMemory, conversationWriter } from './history'

const get = 'projectMemory:get' as unknown as typeof api.projectMemory.get
const list = 'projectMemory:listRecords' as unknown as typeof api.projectMemory.listRecords
const save = 'projectMemory:save' as unknown as typeof api.projectMemory.save

export class CloudMemoryRepository implements MemoryRepository {
  private revision = 0
  constructor(private projectId: Id<'projects'>) {}
  async load(): Promise<MemorySnapshot | null> {
    if (!convexClient) throw new Error('Cloud memory is unavailable.')
    // Retry a bounded read if another tab compacts while pages are being loaded.
    for (let attempt = 0; ; attempt++) {
      try {
        const memory = await convexClient.query(get, { projectId: this.projectId })
        this.revision = memory?.revision ?? 0
        if (!memory) return null
        const roots: MemoryRoot[] = [], nodes: MemorySnapshot['nodes'] = []
        let cursor: string | null = null
        do {
          const page: FunctionReturnType<typeof list> = await convexClient.query(list, { projectId: this.projectId, revision: this.revision, paginationOpts: { cursor, numItems: 200 } })
          for (const { record } of page.page) {
            if (record.kind === 'root') {
              if (record.index !== roots.length) throw new Error('Project memory has missing messages.')
              roots.push(record.value)
            } else nodes.push(record.value)
          }
          cursor = page.isDone ? null : page.continueCursor
        } while (cursor)
        return { state: memory.state, roots, nodes }
      } catch (error) {
        const data = (error as { data?: { code?: string } }).data
        if (attempt >= 2 || data?.code !== 'CONFLICT') throw error
      }
    }
  }
  async save(update: MemoryUpdate) {
    if (!convexClient) throw new Error('Cloud memory is unavailable.')
    this.revision = await convexClient.mutation(save, { projectId: this.projectId, expectedRevision: this.revision, ...update })
  }
}

/** Project IDs, rather than names or source generations, select the memory instance. */
export function connectProjectMemory(chat: ChatController, cloud: CloudProjectController) {
  let selected: string | undefined, current: ProjectMemory | undefined, operation = 0, disposed = false
  const change = () => {
    const auth = getConvexAuthState(), project = cloud.getSnapshot()
    const waiting = auth.isLoading || project.isSwitching || (auth.isAuthenticated && !project.activeProjectId)
    const key = waiting ? 'waiting' : auth.isAuthenticated ? `cloud:${auth.userId}:${project.activeProjectId}` : 'local:workspace'
    if (key === selected) return
    selected = key; const ticket = ++operation
    current?.close(); current = undefined
    chat.setProjectMemory(undefined, true)
    if (waiting) return
    const repository = auth.isAuthenticated && project.activeProjectId
      ? new CloudMemoryRepository(project.activeProjectId)
      : new BrowserMemoryRepository(key)
    const history = new BrowserConversationRepository(key)
    void Promise.allSettled([
      ProjectMemory.open(repository, createMemoryCompactor(() => chat.getSnapshot().settings), () => chat.refreshMemoryStatus()),
      history.load()
    ]).then(([memory, conversation]) => {
      if (disposed || ticket !== operation) { if (memory.status === 'fulfilled') memory.value.close(); return }
      current = memory.status === 'fulfilled' ? memory.value : undefined
      chat.setProjectMemory(current, false, memory.status === 'rejected'
        ? memory.reason instanceof Error ? memory.reason.message : 'Project memory could not be loaded.' : '')
      chat.restoreConversation(
        conversation.status === 'fulfilled' && conversation.value !== null ? conversation.value : conversationFromMemory(current?.core.roots ?? []),
        conversation.status === 'fulfilled' ? conversationWriter(history) : undefined,
        conversation.status === 'rejected' ? 'Conversation history could not be loaded. Existing saved history has been kept.' : ''
      )
    })
  }
  const uncloud = cloud.subscribe(change), unauth = subscribeToConvexAuthState(change)
  change()
  return () => { disposed = true; operation++; current?.close(); uncloud(); unauth() }
}
