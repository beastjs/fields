import { expect, test } from 'bun:test'
import { IDBFactory } from 'fake-indexeddb'
import { BrowserMemoryRepository } from '../src/chat/memory-storage'
import { ProjectMemory, VictralMemory, splitMemoryText, utf8Bytes, requestedMemory, type MemoryRepository, type MemorySnapshot } from '../src/chat/memory'
import { createMemoryCompactor } from '../src/chat/memory-compactor'
import { ChatController } from '../src/chat/controller'
import { defaultSettings, type ChatRequest, type FetchLike } from '../src/chat/contracts'

const signal = () => new AbortController().signal
const repository = (): MemoryRepository & { snapshot: MemorySnapshot | null } => ({
  snapshot: null,
  async load() { return this.snapshot ? structuredClone(this.snapshot) : null },
  async save(update) {
    this.snapshot = structuredClone({ state: update.state, roots: [...(this.snapshot?.roots ?? []), ...update.roots], nodes: [...(this.snapshot?.nodes ?? []), ...update.nodes] })
  }
})
const wire = (text: string) => new Response(`data: ${JSON.stringify({ choices: [{ delta: { content: text } }] })}\n\ndata: [DONE]\n\n`, { headers: { 'Content-Type': 'text/event-stream' } })

test('UTF-8 chunks preserve every character, including a literal replacement character', () => {
  const text = ('hello 🌏 世界 �\n').repeat(4000)
  const chunks = splitMemoryText(text)
  expect(chunks.join('')).toBe(text)
  expect(chunks.every(part => utf8Bytes(part) <= 30_000)).toBe(true)
  expect(() => splitMemoryText('🌏', 1)).toThrow('UTF-8')
})

test('binary view batches compact older siblings, persist exact ranges, and retain originals', () => {
  const memory = new VictralMemory(null, 230, 150)
  for (let i = 0; i < 12; i++) {
    memory.append('user', `decision-${i}: ` + 'original source '.repeat(5))
    for (;;) {
      const candidates = memory.candidates(new Set())
      if (!candidates.length) break
      for (const part of candidates) memory.saveNode(part, part.l ? `merged-${part.l}-${part.i}` : `decision-${part.i}: important constraint`)
    }
  }
  expect(utf8Bytes(memory.render())).toBeLessThanOrEqual(230)
  expect(memory.state().view.some(part => part.l > 0)).toBe(true)
  expect(memory.zoom(0, 1)).toContain('original source')
  expect(memory.zoom(0, 4)).toContain('0+2|merged-1-0')
  expect(() => memory.zoom(1, 4)).toThrow('range')
  const reopened = new VictralMemory(memory.snapshot(), 230, 150)
  expect(reopened.render()).toBe(memory.render())
  expect(reopened.state()).toEqual(memory.state())
  expect(reopened.zoom(0, 1)).toBe(memory.zoom(0, 1))
  const corrupt = memory.snapshot(); corrupt.state.view[0].i = 999
  expect(() => new VictralMemory(corrupt)).toThrow('coverage')
})

test('compaction failure preserves durable originals and retries on the next request', async () => {
  const store = repository(); let fail = true
  const memory = await ProjectMemory.open(store, async () => { if (fail) throw new Error('offline'); return 'Decision: use blue.' })
  await memory.append('Use blue. ' + 'context '.repeat(100), 'I propose blue.')
  await expect(memory.prepare(signal())).rejects.toThrow('offline')
  expect(store.snapshot!.roots.map(root => root.text).join('\n')).toContain('Use blue.')
  fail = false
  expect(await memory.prepare(signal())).toContain('Decision: use blue.')
  const reopened = await ProjectMemory.open(store, async () => 'summary')
  expect(await reopened.prepare(signal())).toContain('Decision: use blue.')
  memory.close(); reopened.close()
})

test('guest repositories isolate project IDs, reopen memory, and reject a stale tab atomically', async () => {
  const db = new IDBFactory()
  const a = new BrowserMemoryRepository('A', db), stale = new BrowserMemoryRepository('A', db), b = new BrowserMemoryRepository('B', db)
  await a.load(); await stale.load(); await b.load()
  const memory = new VictralMemory(); memory.append('user', 'A private decision')
  const update = { state: memory.state(), roots: memory.roots, nodes: [] }
  await a.save(update)
  expect(await b.load()).toBeNull()
  await expect(stale.save(update)).rejects.toThrow('Another tab')
  const reopened = await new BrowserMemoryRepository('A', db).load()
  expect(reopened!.roots).toEqual(memory.roots)
})

test('new chat keeps memory, switching projects clears it, and zoom is resolved within the selected instance', async () => {
  const a = await ProjectMemory.open(repository(), async () => 'summary')
  const b = await ProjectMemory.open(repository(), async () => 'summary')
  const requests: ChatRequest[] = []
  const send: FetchLike = async (_url, init) => {
    const input: ChatRequest = JSON.parse(init!.body as string); requests.push(input)
    if (input.messages[0].content === 'Recall' && !input.memory?.recalled) return wire('```memory\n{"id":0,"n":1}\n```')
    return wire('Answer')
  }
  const chat = new ChatController(defaultSettings, () => {}, send)
  chat.setProjectMemory(a)
  await chat.submit('Use sapphire blue')
  chat.clear()
  await chat.submit('Recall')
  expect(requests[1].memory!.view).toContain('sapphire blue')
  expect(requests[2].memory!.recalled).toContain('sapphire blue')
  expect(chat.getSnapshot().messages.at(-1)!.content).toBe('Answer')
  chat.setProjectMemory(b)
  expect(chat.getSnapshot().messages).toEqual([])
  await chat.submit('Project B')
  expect(requests.at(-1)!.memory!.view).not.toContain('sapphire blue')
  expect(a.core.roots.map(root => root.text)).not.toContain('Project B')
  chat.setProjectMemory(a)
  await chat.submit('Remember A')
  expect(requests.at(-1)!.memory!.view).toContain('sapphire blue')
  chat.dispose(); a.close(); b.close()
})

test('project switch and stop cannot deliver a stale answer into another project', async () => {
  const a = await ProjectMemory.open(repository(), async () => 'summary')
  const b = await ProjectMemory.open(repository(), async () => 'summary')
  let finish!: () => void
  const send: FetchLike = async () => { await new Promise<void>(resolve => { finish = resolve }); return wire('Old A answer') }
  const chat = new ChatController(defaultSettings, () => {}, send)
  chat.setProjectMemory(a)
  const turn = chat.submit('A prompt')
  while (!finish) await new Promise(resolve => setTimeout(resolve, 0))
  chat.setProjectMemory(b); finish(); await turn
  expect(chat.getSnapshot().messages).toEqual([])
  expect(b.core.roots).toEqual([])
  expect(a.core.roots).toEqual([])
  chat.dispose(); a.close(); b.close()
})

test('auto repairs do not pollute project memory', async () => {
  const memory = await ProjectMemory.open(repository(), async () => 'summary')
  const chat = new ChatController(defaultSettings, () => {}, async () => wire('Repair proposal'))
  chat.setProjectMemory(memory)
  await chat.submit('repair', undefined, 1, [], 2)
  await chat.submit('editor error', undefined, 1, [], 1, [], 'editor')
  expect(memory.core.roots).toEqual([])
  chat.dispose(); memory.close()
})

test('manual history beyond thirty turns remains available after reopening the project', async () => {
  const store = repository(), memory = await ProjectMemory.open(store, async () => 'Retained older decisions')
  const chat = new ChatController(defaultSettings, () => {}, async () => wire('Understood'))
  chat.setProjectMemory(memory)
  await chat.submit('First decision: use a sapphire palette')
  for (let i = 0; i < 35; i++) await chat.submit(`Next detail ${i}`)
  const reopened = await ProjectMemory.open(store, async () => 'Retained older decisions')
  expect(await reopened.prepare(signal())).toContain('First decision: use a sapphire palette')
  expect(reopened.core.roots).toHaveLength(72)
  expect(reopened.core.zoom(0, 1)).toContain('sapphire palette')
  chat.dispose(); memory.close(); reopened.close()
})

test('stopping while memory is being summarized releases the waiting chat immediately', async () => {
  const store = repository(); let finish!: (text: string) => void
  const memory = await ProjectMemory.open(store, async () => new Promise(resolve => { finish = resolve }))
  await memory.append('Long note '.repeat(100), 'Understood')
  const abort = new AbortController(), waiting = memory.prepare(abort.signal)
  abort.abort()
  await expect(waiting).rejects.toThrow()
  finish('Stored note')
  memory.close()
})

test('compactor uses bounded context, retries byte overruns, and never truncates the chosen summary', async () => {
  const requests: ChatRequest[] = []
  const compactor = createMemoryCompactor(() => defaultSettings, async (_url, init) => {
    requests.push(JSON.parse(init!.body as string))
    return wire(requests.length === 1 ? '🌏'.repeat(200) : 'Preserved user decision.')
  })
  expect(await compactor('source', '<chat>\n</chat>', signal())).toBe('Preserved user decision.')
  expect(requests).toHaveLength(2)
  expect(requests[0].purpose).toBe('compaction')
  expect(requests[1].messages.at(-1)!.content).toContain('800 bytes')
  expect(requests[0].memory!.view).toBe('<chat>\n</chat>')
  expect(requestedMemory('```memory\n{"id":8,"n":4,"page":0}\n```')).toEqual({ id: 8, n: 4, page: 0 })
  expect(() => requestedMemory('```memory\n{"id":"A","n":1}\n```')).toThrow('invalid')
})
