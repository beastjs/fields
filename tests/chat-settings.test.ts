import { afterEach, beforeEach, expect, test } from 'bun:test'
import { DEFAULT_MODEL, defaultSettings } from '../src/chat/contracts'
import { readChatSettings, saveChatSettings } from '../src/chat/settings'

const key = 'beast-playground.chat-settings.v1'
const originalStorage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage')
let values: Map<string, string>

beforeEach(() => {
  values = new Map()
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => values.set(key, value) }
  })
})
afterEach(() => {
  if (originalStorage) Object.defineProperty(globalThis, 'localStorage', originalStorage)
  else Reflect.deleteProperty(globalThis, 'localStorage')
})

test('saved Meta settings migrate the mistyped default without retaining credentials', () => {
  values.set(key, JSON.stringify({ provider: 'meta', model: 'muse-spark-1.5-contributor', apiKey: 'old-secret' }))
  expect(readChatSettings()).toEqual({ ...defaultSettings, model: DEFAULT_MODEL })
})

test('explicit model choices and other providers survive the default correction', () => {
  for (const [provider, model] of [['meta', 'another-model'], ['custom', 'muse-spark-1.5-contributor']] as const) {
    values.set(key, JSON.stringify({ provider, model, baseURL: 'https://models.test/v1' }))
    expect(readChatSettings()).toEqual({ provider, model, baseURL: 'https://models.test/v1', apiKey: '' })
  }
})

test('settings persist the corrected model and exclude session credentials', () => {
  saveChatSettings({ ...defaultSettings, apiKey: 'session-secret' })
  expect(values.get(key)).not.toContain('session-secret')
  expect(readChatSettings()).toEqual(defaultSettings)
})

test('missing or invalid saved settings use the corrected default', () => {
  expect(readChatSettings()).toEqual(defaultSettings)
  values.set(key, '{invalid')
  expect(readChatSettings()).toEqual(defaultSettings)
})
