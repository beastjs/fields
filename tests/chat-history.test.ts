import { expect, test } from 'bun:test'
import { IDBFactory } from 'fake-indexeddb'
import { ChatController, type ChatMessage } from '../src/chat/controller'
import { defaultSettings } from '../src/chat/contracts'
import { BrowserConversationRepository, conversationFromMemory, conversationWriter } from '../src/chat/history'

const wire = (content: string) => new Response(`data: ${JSON.stringify({ choices: [{ delta: { content } }] })}\n\ndata: [DONE]\n\n`, { headers: { 'Content-Type': 'text/event-stream' } })

test('transcripts retain messages, source context, reasoning, and automatic/error turns without settings or generations', async () => {
  const database = new IDBFactory()
  const store = new BrowserConversationRepository('cloud:alice:project-a', database)
  expect(await store.load()).toBeNull()
  const messages: ChatMessage[] = [
    { id: 1, role: 'user', content: 'Make the heading blue', attachments: ['/src/App.btsx'] },
    { id: 2, role: 'assistant', content: '```btsx\nh1 Blue\n```', reasoning: 'A calmer heading.', model: 'model', context: { file: '/src/App.btsx', source: 'h1 Original' }, references: [{ file: '/src/styles.css', source: 'h1 { color: blue; }' }], projectGeneration: 42, attempt: 1, state: 'complete' },
    { id: 3, role: 'user', content: 'Repair the heading', origin: 'editor', attempt: 2 },
    { id: 4, role: 'assistant', content: 'Partial repair', origin: 'editor', state: 'error' }
  ]
  await store.save(messages)
  const restored = await new BrowserConversationRepository('cloud:alice:project-a', database).load()
  expect(restored).toHaveLength(4)
  expect(restored![1]).toMatchObject({ content: messages[1].content, context: messages[1].context, references: messages[1].references, reasoning: 'A calmer heading.' })
  expect(restored![1]!.projectGeneration).toBeUndefined()
  expect(restored![3]).toMatchObject({ content: 'Partial repair', origin: 'editor', state: 'error' })
  expect(await new BrowserConversationRepository('cloud:bob:project-a', database).load()).toBeNull()
  expect(await new BrowserConversationRepository('cloud:alice:project-b', database).load()).toBeNull()
  expect(await new BrowserConversationRepository('local:workspace', database).load()).toBeNull()
})

test('restoring is read-only, interrupts streaming, preserves ID uniqueness, and new chat persists empty history', async () => {
  const database = new IDBFactory(), store = new BrowserConversationRepository('local:workspace', database)
  await store.load()
  await store.save([
    { id: 10, role: 'user', content: 'An older question' },
    { id: 11, role: 'assistant', content: 'An unfinished answer', projectGeneration: 0, state: 'streaming' }
  ])
  const reopened = new BrowserConversationRepository('local:workspace', database)
  const messages = (await reopened.load())!
  const write = conversationWriter(reopened)
  const chat = new ChatController(defaultSettings, () => {}, async () => wire('New answer'))
  chat.restoreConversation(messages, write)
  expect(chat.getSnapshot().messages[1]).toMatchObject({ restored: true, state: 'stopped' })
  expect(chat.getSnapshot().messages[1]!.projectGeneration).toBeUndefined()
  await chat.submit('A new question')
  expect(new Set(chat.getSnapshot().messages.map(message => message.id)).size).toBe(4)
  await write(chat.getSnapshot().messages)
  expect((await new BrowserConversationRepository('local:workspace', database).load())!.map(message => message.content))
    .toEqual(['An older question', 'An unfinished answer', 'A new question', 'New answer'])
  chat.clear()
  await write(chat.getSnapshot().messages)
  expect(await new BrowserConversationRepository('local:workspace', database).load()).toEqual([])
  chat.dispose()
})

test('project switches detach old writers before clearing messages', async () => {
  const saves: ChatMessage[][] = []
  const chat = new ChatController(defaultSettings, () => {})
  chat.restoreConversation([{ id: 1, role: 'user', content: 'Project A' }], async messages => { saves.push(messages) })
  chat.setProjectMemory(undefined, true)
  expect(chat.getSnapshot().messages).toEqual([])
  expect(saves.map(messages => messages.map(message => message.content))).toEqual([['Project A']])
  chat.dispose()
})

test('writes coalesce streaming changes and stale tabs cannot overwrite the saved conversation', async () => {
  const database = new IDBFactory()
  const store = new BrowserConversationRepository('local:workspace', database), stale = new BrowserConversationRepository('local:workspace', database)
  await store.load(); await stale.load()
  const write = conversationWriter(store)
  const message: ChatMessage = { id: 1, role: 'assistant', content: '', state: 'streaming' }
  const first = write([message])
  void write([{ ...message, content: 'A' }])
  const last = write([{ ...message, content: 'A finished answer', state: 'complete' }])
  await Promise.all([first, last])
  await expect(stale.save([])).rejects.toThrow('Another tab')
  expect((await new BrowserConversationRepository('local:workspace', database).load())![0]!.content).toBe('A finished answer')
})

test('storage failures surface without dropping the visible conversation', async () => {
  const chat = new ChatController(defaultSettings, () => {}, async () => wire('Answer'))
  chat.restoreConversation([], async () => { throw new Error('Storage is full') })
  await chat.submit('Keep this visible')
  expect(chat.getSnapshot().messages.map(message => message.content)).toEqual(['Keep this visible', 'Answer'])
  expect(chat.getSnapshot().historyError).toBe('Storage is full')
  chat.dispose()
})

test('legacy project memory recovers exact originals and rejoins large message chunks', () => {
  expect(conversationFromMemory([
    { role: 'user', text: 'Use a ', date: 1 }, { role: 'user', text: 'blue heading', date: 1 },
    { role: 'assistant', text: '```btsx\nh1 Blue\n```', date: 2 }
  ])).toEqual([
    { id: 1, role: 'user', content: 'Use a blue heading', state: 'complete' },
    { id: 2, role: 'assistant', content: '```btsx\nh1 Blue\n```', state: 'complete' }
  ])
})

test('unreadable history is preserved rather than silently replaced', async () => {
  const database = new IDBFactory()
  await new BrowserConversationRepository('local:workspace', database).load()
  const db = await new Promise<IDBDatabase>((resolve, reject) => {
    const request = database.open('beast-playground-conversations', 1)
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
  const unreadable = { version: 99, revision: 5, messages: [{ role: 'assistant', content: 'Keep the original data' }] }
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction('conversations', 'readwrite')
    tx.objectStore('conversations').put(unreadable, 'local:workspace')
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
  await expect(new BrowserConversationRepository('local:workspace', database).load()).rejects.toThrow('could not be read')
  const saved = await new Promise((resolve, reject) => {
    const tx = db.transaction('conversations', 'readonly'), request = tx.objectStore('conversations').get('local:workspace')
    tx.oncomplete = () => resolve(request.result)
    tx.onerror = () => reject(tx.error)
  })
  expect(saved).toEqual(unreadable)
  db.close()
})
