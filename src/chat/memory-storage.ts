import type { MemoryRepository, MemorySnapshot, MemoryUpdate } from './memory'

/** Guest memory is browser-local and separate from source exports and provider credentials. */
export class BrowserMemoryRepository implements MemoryRepository {
  private revision = 0
  constructor(private projectKey: string, private database: IDBFactory = indexedDB) {}
  private open(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = this.database.open('beast-playground-memory', 1)
      request.onupgradeneeded = () => request.result.createObjectStore('projects')
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(new Error('Project memory storage is unavailable. Enable browser storage and reload.'))
    })
  }
  async load(): Promise<MemorySnapshot | null> {
    const db = await this.open()
    try {
      return await new Promise((resolve, reject) => {
        const tx = db.transaction('projects', 'readonly'), request = tx.objectStore('projects').get(this.projectKey)
        tx.oncomplete = () => { const saved = request.result; this.revision = saved?.revision ?? 0; resolve(saved?.snapshot ?? null) }
        tx.onerror = () => reject(new Error('Project memory could not be read.'))
        tx.onabort = () => reject(new Error('Project memory read was interrupted.'))
      })
    } finally { db.close() }
  }
  async save(update: MemoryUpdate) {
    const db = await this.open()
    try {
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction('projects', 'readwrite'), store = tx.objectStore('projects'), request = store.get(this.projectKey)
        let conflict = false
        request.onsuccess = () => {
          const saved = request.result as { revision: number; snapshot: MemorySnapshot } | undefined
          if ((saved?.revision ?? 0) !== this.revision) { conflict = true; tx.abort(); return }
          const snapshot: MemorySnapshot = { state: update.state, roots: [...(saved?.snapshot.roots ?? []), ...update.roots], nodes: [...(saved?.snapshot.nodes ?? []), ...update.nodes] }
          store.put({ revision: this.revision + 1, snapshot }, this.projectKey)
        }
        tx.oncomplete = () => { this.revision++; resolve() }
        tx.onerror = () => reject(new Error('Project memory could not be saved. Check browser storage space.'))
        tx.onabort = () => reject(new Error(conflict ? 'Another tab updated this project’s memory. Reload to continue.' : 'Project memory could not be saved.'))
      })
    } finally { db.close() }
  }
}
