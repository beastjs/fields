import { expect, test } from 'bun:test'
import { createServer, type Server } from 'node:http'
import { aiMiddleware } from '../server/middleware'
import { defaultSettings } from '../src/chat/contracts'

async function listen(server: Server) {
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
  const address = server.address()
  if (!address || typeof address === 'string') throw new Error('Expected an HTTP port')
  return `http://127.0.0.1:${address.port}`
}
async function close(server: Server) {
  const closing = new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()))
  server.closeAllConnections()
  await closing
}

test('local middleware forwards Meta credentials and both endpoint variable names', async () => {
  const captured: { model: string; auth?: string; path?: string }[] = []
  const upstream = createServer(async (req, res) => {
    const chunks: Buffer[] = []
    for await (const chunk of req) chunks.push(Buffer.from(chunk))
    captured.push({ model: JSON.parse(Buffer.concat(chunks).toString()).model, auth: req.headers.authorization, path: req.url })
    res.writeHead(200, { 'content-type': 'text/event-stream' })
    res.end('data: {"choices":[{"delta":{"content":"OK"},"finish_reason":"stop"}]}\n\ndata: [DONE]\n\n')
  })
  const server = createServer((req, res) => aiMiddleware(req, res, () => { res.writeHead(404); res.end() }))
  const names = ['META_API_KEY', 'META_BASE_URL', 'META_URL'] as const
  const original = Object.fromEntries(names.map(name => [name, process.env[name]]))
  try {
    const endpoint = await listen(upstream)
    const origin = await listen(server)
    process.env.META_API_KEY = 'test-meta-key'
    for (const name of ['META_BASE_URL', 'META_URL'] as const) {
      delete process.env.META_BASE_URL
      delete process.env.META_URL
      process.env[name] = `${endpoint}/v1`
      const status = await fetch(`${origin}/api/ai/status`)
      const settings = await status.json()
      expect(settings.configured.meta).toBe(true)
      expect(JSON.stringify(settings)).not.toContain('test-meta-key')
      const response = await fetch(`${origin}/api/ai/chat`, {
        method: 'POST', headers: { 'content-type': 'application/json', origin },
        body: JSON.stringify({ ...defaultSettings, messages: [{ role: 'user', content: 'Hello' }] })
      })
      expect(response.status).toBe(200)
      expect(await response.text()).toContain('[DONE]')
    }
    expect(captured).toEqual(Array.from({ length: 2 }, () => ({ model: 'muse-spark-1.3-contributor', auth: 'Bearer test-meta-key', path: '/v1/chat/completions' })))
  } finally {
    for (const name of names) {
      if (original[name] === undefined) delete process.env[name]
      else process.env[name] = original[name]
    }
    if (server.listening) await close(server)
    if (upstream.listening) await close(upstream)
  }
})
