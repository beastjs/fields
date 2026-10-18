import type { ChatMessage } from './controller'
import type { MemoryRoot } from './memory'

export interface ConversationRepository {
  load(): Promise<ChatMessage[] | null>
  save(messages: ChatMessage[]): Promise<void>
}

/** Persist only conversation data, never provider settings or runtime generations. */
function savedMessage(message: ChatMessage): ChatMessage {
  const { id, role, content, reasoning, context, references, attachments, attempt, model, origin, state } = message
  return { id, role, content, reasoning, context, references, attachments, attempt, model, origin, state }
}

function validMessage(message: ChatMessage) {
  const file = (value: unknown) => !!value && typeof value === 'object' &&
    typeof (value as { file?: unknown }).file === 'string' && typeof (value as { source?: unknown }).source === 'string'
  return message && Number.isSafeInteger(message.id) && message.id > 0 &&
    (message.role === 'user' || message.role === 'assistant') && typeof message.content === 'string' &&
    (message.reasoning === undefined || typeof message.reasoning === 'string') &&
    (message.model === undefined || typeof message.model === 'string') &&
    (message.context === undefined || file(message.context)) &&
    (message.references === undefined || (Array.isArray(message.references) && message.references.every(file))) &&
    (message.attachments === undefined || (Array.isArray(message.attachments) && message.attachments.every(path => typeof path === 'string'))) &&
    (message.attempt === undefined || (Number.isSafeInteger(message.attempt) && message.attempt > 0)) &&
    (message.origin === undefined || message.origin === 'editor') &&
    (message.state === undefined || ['complete', 'streaming', 'stopped', 'error'].includes(message.state))
}

/** Each browser account/project has a separate transcript, including failed and automatic turns. */
export class BrowserConversationRepository implements ConversationRepository {
  private revision = 0
  constructor(private key: string, private database: IDBFactory = indexedDB) {}
  private open(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = this.database.open('beast-playground-conversations', 1)
      request.onupgradeneeded = () => request.result.createObjectStore('conversations')
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(new Error('Conversation history storage is unavailable.'))
    })
  }
  async load(): Promise<ChatMessage[] | null> {
    const db = await this.open()
    try {
      return await new Promise((resolve, reject) => {
        const tx = db.transaction('conversations', 'readonly')
        const request = tx.objectStore('conversations').get(this.key)
        tx.oncomplete = () => {
          const saved = request.result
          if (!saved) { resolve(null); return }
          if (saved.version !== 1 || !Number.isSafeInteger(saved.revision) || !Array.isArray(saved.messages) ||
            !saved.messages.every(validMessage) || new Set(saved.messages.map((message: ChatMessage) => message.id)).size !== saved.messages.length) {
            reject(new Error('Saved conversation history could not be read.')); return
          }
          this.revision = saved.revision
          resolve(saved.messages.map(savedMessage))
        }
        tx.onerror = tx.onabort = () => reject(new Error('Conversation history could not be read.'))
      })
    } finally { db.close() }
  }
  async save(messages: ChatMessage[]) {
    const db = await this.open()
    try {
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction('conversations', 'readwrite'), store = tx.objectStore('conversations')
        const request = store.get(this.key)
        let conflict = false
        request.onsuccess = () => {
          if ((request.result?.revision ?? 0) !== this.revision) { conflict = true; tx.abort(); return }
          store.put({ version: 1, revision: this.revision + 1, messages: messages.map(savedMessage) }, this.key)
        }
        tx.oncomplete = () => { this.revision++; resolve() }
        tx.onerror = tx.onabort = () => reject(new Error(conflict ? 'Another tab updated this conversation. Reload to continue.' : 'Conversation history could not be saved.'))
      })
    } finally { db.close() }
  }
}

/** Serialize writes, coalescing streaming snapshots while an IndexedDB write is in flight. */
export function conversationWriter(repository: ConversationRepository) {
  let pending: ChatMessage[] | undefined, work: Promise<void> | undefined
  return (messages: ChatMessage[]) => {
    pending = messages
    if (!work) work = (async () => {
      while (pending) {
        const next = pending; pending = undefined
        await repository.save(next)
      }
    })().finally(() => { work = undefined })
    return work
  }
}

/** Recover originals already retained by project memory for users predating transcript storage. */
export function conversationFromMemory(roots: MemoryRoot[]): ChatMessage[] {
  const messages: ChatMessage[] = []
  for (const root of roots) {
    const previous = messages.at(-1)
    // Memory splits large messages into UTF-8 chunks with the same role.
    if (previous?.role === root.role) previous.content += root.text
    else messages.push({ id: messages.length + 1, role: root.role, content: root.text, state: 'complete' })
  }
  return messages
}
