/** Victral 162b20643: binary summaries, persistent views, age-weighted batch merging and zoom.
 * The browser/Convex adapters replace its filesystem and Effect job supervisor.
 */
export const NODE_BYTES = 512
export const VIEW_BYTES = 128_000
export const COMPACT_BYTES = 32_000
export const MESSAGE_BYTES = 30_000
const encoder = new TextEncoder()
const decoder = new TextDecoder('utf-8', { fatal: true })
export const utf8Bytes = (text: string) => encoder.encode(text).length
export function splitMemoryText(text: string, limit = MESSAGE_BYTES): string[] {
  const data = encoder.encode(text), parts: string[] = []
  for (let start = 0; start < data.length;) {
    let end = Math.min(start + limit, data.length)
    if (end < data.length) while (end > start && (data[end] & 0xc0) === 0x80) end--
    if (end === start) throw new Error('Memory chunk cannot hold a UTF-8 character.')
    parts.push(decoder.decode(data.subarray(start, end))); start = end
  }
  return parts.length ? parts : ['']
}
export interface MemoryPart { l: number; i: number }
export interface MemoryRoot { role: 'user' | 'assistant'; text: string; date: number }
export interface MemoryNode extends MemoryPart { text: string }
export interface MemoryState {
  version: 1
  count: number
  view: MemoryPart[]
  shrinking: boolean
  compactView: MemoryPart[]
  compactShrinking: boolean
}
export interface MemorySnapshot { state: MemoryState; roots: MemoryRoot[]; nodes: MemoryNode[] }
export interface MemoryUpdate { state: MemoryState; roots: MemoryRoot[]; nodes: MemoryNode[] }
export interface MemoryRepository {
  load(): Promise<MemorySnapshot | null>
  save(update: MemoryUpdate): Promise<void>
}
export type SummarizeMemory = (source: string, context: string, signal: AbortSignal) => Promise<string>
export const memoryKey = ({ l, i }: MemoryPart) => `${l}:${i}`
const start = (p: MemoryPart) => p.i * 2 ** p.l
const end = (p: MemoryPart) => (p.i + 1) * 2 ** p.l
const copyParts = (parts: MemoryPart[]) => parts.map(p => ({ ...p }))

class SummaryView {
  shrinking = false
  constructor(private memory: VictralMemory, readonly high: number, public parts: MemoryPart[] = []) {}
  line(p: MemoryPart) { return `${start(p)}+${2 ** p.l}|${this.memory.text(p).replace(/\r\n|\r|\n/g, ' ')}` }
  render(parts = this.parts) { return `<chat>\n${parts.map(p => this.line(p)).join('\n')}${parts.length ? '\n' : ''}</chat>` }
  prefix(until: number) {
    const result: MemoryPart[] = []
    const visit = (p: MemoryPart) => {
      if (start(p) >= until) return
      if (end(p) <= until) result.push(p)
      else if (p.l) { visit({ l: p.l - 1, i: 2 * p.i }); visit({ l: p.l - 1, i: 2 * p.i + 1 }) }
    }
    for (const part of this.parts) { if (start(part) >= until) break; visit(part) }
    return result
  }
  fit(force = false) {
    let size = utf8Bytes(this.render()), merged = 0
    if (force || size > this.high) this.shrinking = true
    while (this.shrinking && size > this.high / 2) {
      let chosen = -1, weight = -Infinity
      for (let at = 0; at < this.parts.length - 1; at++) {
        const a = this.parts[at], b = this.parts[at + 1]
        if (a.l !== b.l || a.i % 2 || b.i !== a.i + 1) continue
        const parent = { l: a.l + 1, i: a.i / 2 }
        if (!this.memory.node(parent)) continue
        // Victral measures age from the pair's last message in child-line units.
        const due = (this.memory.roots.length - (end(parent) - 1)) / 2 ** a.l
        if (due > weight) { chosen = at; weight = due }
      }
      if (chosen < 0) break
      const a = this.parts[chosen], b = this.parts[chosen + 1], parent = { l: a.l + 1, i: a.i / 2 }
      size += utf8Bytes(this.line(parent) + '\n') - utf8Bytes(this.line(a) + '\n') - utf8Bytes(this.line(b) + '\n')
      this.parts.splice(chosen, 2, parent); merged++
    }
    if (size <= this.high / 2) this.shrinking = false
    return merged
  }
}

/** The originals and tree are immutable. Only the two bounded views change. */
export class VictralMemory {
  roots: MemoryRoot[] = []
  nodes = new Map<string, MemoryNode>()
  private main: SummaryView
  private compact: SummaryView
  constructor(snapshot?: MemorySnapshot | null, readonly viewBudget = VIEW_BYTES, compactBudget = COMPACT_BYTES) {
    this.main = new SummaryView(this, viewBudget)
    this.compact = new SummaryView(this, compactBudget)
    if (!snapshot) return
    if (snapshot.state.version !== 1 || snapshot.state.count !== snapshot.roots.length) throw new Error('Invalid project memory.')
    this.roots = snapshot.roots.slice()
    for (const root of this.roots) {
      if (!['user', 'assistant'].includes(root.role) || typeof root.text !== 'string' || utf8Bytes(root.text) > MESSAGE_BYTES || !Number.isFinite(root.date)) throw new Error('Invalid memory message.')
    }
    for (const node of snapshot.nodes) {
      if (!this.valid(node) || typeof node.text !== 'string' || !node.text.trim() || this.nodes.has(memoryKey(node))) throw new Error('Invalid memory summary.')
      this.nodes.set(memoryKey(node), { ...node })
    }
    this.restore(this.main, snapshot.state.view, snapshot.state.shrinking)
    this.restore(this.compact, snapshot.state.compactView, snapshot.state.compactShrinking, true)
    if ((this.main.parts.length ? end(this.main.parts.at(-1)!) : 0) !== this.roots.length) throw new Error('Incomplete memory view.')
  }
  private valid(p: MemoryPart) {
    return Number.isSafeInteger(p.l) && p.l >= 0 && p.l <= 40 && Number.isSafeInteger(p.i) && p.i >= 0 && end(p) <= this.roots.length
  }
  private restore(view: SummaryView, parts: MemoryPart[], shrinking: boolean, built = false) {
    let cursor = 0
    for (const part of parts) {
      if (!this.valid(part) || start(part) !== cursor || ((built || part.l > 0) && !this.node(part))) throw new Error('Invalid memory view coverage.')
      cursor = end(part)
    }
    view.parts = copyParts(parts); view.shrinking = shrinking
  }
  node(p: MemoryPart) { return this.nodes.get(memoryKey(p)) }
  text(p: MemoryPart) { return this.node(p)?.text ?? '(not summarized yet: retrieve original)' }
  append(role: MemoryRoot['role'], text: string) {
    for (const chunk of splitMemoryText(text)) {
      const i = this.roots.length
      this.roots.push({ role, text: chunk, date: Date.now() }); this.main.parts.push({ l: 0, i })
    }
    this.fit()
  }
  get builtThrough() {
    let i = 0
    while (i < this.roots.length && this.node({ l: 0, i })) i++
    return i
  }
  source(p: MemoryPart) {
    if (!p.l) { const root = this.roots[p.i]; return `${root.role}${root.role === 'assistant' ? ' (proposal, not proof of application)' : ''}: ${root.text}` }
    return `${this.node({ l: p.l - 1, i: 2 * p.i })!.text}\n${this.node({ l: p.l - 1, i: 2 * p.i + 1 })!.text}`
  }
  candidates(failed: Set<string>) {
    const parts: MemoryPart[] = []
    for (let l = 0; 2 ** l <= this.roots.length; l++) {
      for (let i = 0; (i + 1) * 2 ** l <= this.roots.length; i++) {
        const part = { l, i }
        if (this.node(part) || failed.has(memoryKey(part))) continue
        if (l && (!this.node({ l: l - 1, i: 2 * i }) || !this.node({ l: l - 1, i: 2 * i + 1 }))) continue
        parts.push(part)
        if (parts.length === 8) return parts
      }
    }
    return parts
  }
  saveNode(p: MemoryPart, text: string) {
    if (!text.trim()) throw new Error('The memory compactor returned an empty summary.')
    if (this.node(p)) return
    this.nodes.set(memoryKey(p), { ...p, text }); this.fit()
  }
  private fit() {
    const merged = this.main.fit()
    const built = this.builtThrough
    if (merged) {
      this.compact.parts = this.main.prefix(built); this.compact.fit(true)
    } else {
      const covered = this.compact.parts.length ? end(this.compact.parts.at(-1)!) : 0
      for (let i = covered; i < built; i++) this.compact.parts.push({ l: 0, i })
      this.compact.fit()
    }
  }
  context(p: MemoryPart) { return this.compact.render(this.compact.prefix(Math.min(p.l ? end(p) : p.i, this.builtThrough))) }
  render() {
    if (this.builtThrough !== this.roots.length || utf8Bytes(this.main.render()) > this.viewBudget) throw new Error('Project memory is still being summarized. Retry after compaction finishes.')
    return this.main.render()
  }
  zoom(id: number, n: number, page = 0) {
    if (!Number.isSafeInteger(id) || id < 0 || !Number.isSafeInteger(n) || n < 1 || !Number.isInteger(Math.log2(n)) || id % n || id + n > this.roots.length) throw new Error('Invalid memory range.')
    if (!Number.isSafeInteger(page) || page < 0 || (n !== 1 && page !== 0)) throw new Error('Invalid memory page.')
    if (n === 1) {
      const root = this.roots[id], pages = splitMemoryText(root.text, MESSAGE_BYTES - 512)
      if (page >= pages.length) throw new Error('Invalid memory page.')
      return `${id}+0|${root.role} (${new Date(root.date).toISOString()}): ${pages[page]}\n[page ${page + 1}/${pages.length}]`
    }
    const l = Math.log2(n) - 1, i = 2 * id / n
    const a = this.node({ l, i }), b = this.node({ l, i: i + 1 })
    if (!a || !b) throw new Error('Memory range is still being summarized.')
    return `${id}+${n / 2}|${a.text}\n${id + n / 2}+${n / 2}|${b.text}`
  }
  state(): MemoryState {
    return { version: 1, count: this.roots.length, view: copyParts(this.main.parts), shrinking: this.main.shrinking, compactView: copyParts(this.compact.parts), compactShrinking: this.compact.shrinking }
  }
  snapshot(): MemorySnapshot { return { state: this.state(), roots: this.roots.slice(), nodes: [...this.nodes.values()] } }
}

/** One lifetime per project. A failed summary is retried when another turn starts. */
export class ProjectMemory {
  readonly abort = new AbortController()
  private savedRoots = 0
  private savedNodes = new Set<string>()
  private saves: Promise<void> = Promise.resolve()
  private work?: Promise<void>
  private failed = new Set<string>()
  error = ''
  private constructor(readonly core: VictralMemory, private repository: MemoryRepository, private summarize: SummarizeMemory,
    private changed: () => void) {
    this.savedRoots = core.roots.length
    for (const node of core.nodes.values()) this.savedNodes.add(memoryKey(node))
  }
  static async open(repository: MemoryRepository, summarize: SummarizeMemory, changed: () => void = () => {}) {
    return new ProjectMemory(new VictralMemory(await repository.load()), repository, summarize, changed)
  }
  private persist() {
    // Capture only after the previous save commits, so each delta starts at the committed count.
    const save = this.saves.then(async () => {
      const roots = this.core.roots.slice(this.savedRoots), nodes = [...this.core.nodes.values()].filter(n => !this.savedNodes.has(memoryKey(n)))
      const state = this.core.state()
      if (!roots.length && !nodes.length) return
      await this.repository.save({ state, roots, nodes })
      this.savedRoots += roots.length
      for (const node of nodes) this.savedNodes.add(memoryKey(node))
    })
    this.saves = save
    return save
  }
  async append(user: string, assistant: string) {
    this.core.append('user', user); this.core.append('assistant', assistant)
    try { await this.persist() } catch (error) { this.error = (error as Error).message; this.changed(); throw error }
    this.changed(); void this.drain().catch(() => {})
  }
  private drain() {
    if (this.work) return this.work
    this.work = (async () => {
      while (!this.abort.signal.aborted) {
        const batch = this.core.candidates(this.failed)
        if (!batch.length) break
        await Promise.all(batch.map(async part => {
          try {
            const source = this.core.source(part)
            const text = utf8Bytes(source) <= NODE_BYTES ? source : await this.summarize(source, this.core.context(part), this.abort.signal)
            this.abort.signal.throwIfAborted(); this.core.saveNode(part, text)
          } catch (error) {
            if (!this.abort.signal.aborted) { this.failed.add(memoryKey(part)); this.error = (error as Error).message }
          }
        }))
        if (!this.abort.signal.aborted) await this.persist()
        this.changed()
      }
    })().catch(error => { this.error = (error as Error).message; this.changed(); throw error }).finally(() => { this.work = undefined })
    return this.work
  }
  async prepare(signal: AbortSignal) {
    signal.throwIfAborted(); this.abort.signal.throwIfAborted()
    this.failed.clear(); this.error = ''
    // A failed durable save must keep failing until this project is reopened.
    await new Promise<void>((resolve, reject) => {
      const stopped = () => { cleanup(); reject(signal.reason ?? new DOMException('Stopped', 'AbortError')) }
      const cleanup = () => signal.removeEventListener('abort', stopped)
      signal.addEventListener('abort', stopped, { once: true })
      this.saves.then(() => this.drain()).then(() => { cleanup(); resolve() }, error => { cleanup(); reject(error) })
      if (signal.aborted) stopped()
    })
    signal.throwIfAborted(); this.abort.signal.throwIfAborted()
    if (this.failed.size) throw new Error(`Project memory could not be summarized: ${this.error}`)
    return this.core.render()
  }
  close() { this.abort.abort() }
}

export function requestedMemory(reply: string) {
  const fence = /^```memory\s*\n([\s\S]*?)\n```\s*$/m.exec(reply)
  if (!fence) return null
  try {
    const value = JSON.parse(fence[1])
    if (!value || typeof value !== 'object' || !Number.isSafeInteger(value.id) || !Number.isSafeInteger(value.n) || (value.page !== undefined && !Number.isSafeInteger(value.page))) throw new Error()
    return { id: value.id as number, n: value.n as number, page: (value.page ?? 0) as number }
  } catch { throw new Error('The assistant requested an invalid memory range. Retry the response.') }
}
