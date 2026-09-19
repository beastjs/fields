import { Effect } from 'effect'
import type { FetchLike } from '../src/chat/contracts'
import { Jev, layer } from '../src/jev/client'
import { MAX_QUESTIONS, type Question, type Questions, type State } from '../src/jev/contracts'

/**
 * The playground's TypeSafe route.
 *
 * The browser never holds the key, exactly as with `/api/ai/chat`: it posts a state and a question
 * map here, this validates the shape, and the server-side client adds the key. The client itself is
 * the same `src/jev/client.ts` the workflows use — only the layer differs, which is the point of
 * building it as a layer.
 */

export interface JevEnvironment {
  TYPESAFE_API_KEY?: string
}

const headers = { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' }
const json = (body: unknown, status = 200) => Response.json(body, { status, headers })

const MAX_STATE = 200000
const MAX_INSTRUCTIONS = 8000

export interface EvaluationRequest {
  state: State
  questions: Questions
  model?: string
}

const sized = (value: unknown, limit: number) => JSON.stringify(value ?? null).length <= limit

/** Rejects anything Jev would reject anyway, before it costs a round trip or reveals the key works. */
function validateQuestion(question: unknown): question is Question {
  if (!question || typeof question !== 'object') return false
  const value = question as Question
  if (value.instructions === undefined || !sized(value.instructions, MAX_INSTRUCTIONS)) return false
  if (value.type === 'noul') {
    const criteria = (value as { criteria?: unknown }).criteria
    return (
      criteria === undefined ||
      (!!criteria &&
        typeof criteria === 'object' &&
        Object.entries(criteria).every(([key, text]) => ['true', 'false'].includes(key) && typeof text === 'string'))
    )
  }
  if (value.type === 'choice') {
    const options = Object.entries((value as { criteria?: Record<string, unknown> }).criteria ?? {})
    return (
      options.length >= 2 &&
      options.length <= 100 &&
      options.every(([option, text]) => !!option && option.length <= 100 && (text === null || typeof text === 'string'))
    )
  }
  if (value.type === 'score') {
    const levels = (value as { criteria?: unknown }).criteria
    return (
      Array.isArray(levels) && levels.length >= 2 && levels.length <= 20 && levels.every((level) => typeof level === 'string')
    )
  }
  return false
}

export function validateEvaluationRequest(value: unknown): EvaluationRequest {
  if (!value || typeof value !== 'object') throw new Error('Invalid evaluation request.')
  const request = value as EvaluationRequest
  if (request.state === undefined || request.state === null || !sized(request.state, MAX_STATE))
    throw new Error('Send a state under 200,000 characters.')
  if (request.model !== undefined && (typeof request.model !== 'string' || request.model.length > 100))
    throw new Error('Invalid model.')
  const entries = Object.entries(request.questions ?? {})
  if (!entries.length || entries.length > MAX_QUESTIONS)
    throw new Error(`Ask between 1 and ${MAX_QUESTIONS} questions in one call.`)
  if (!entries.every(([id, question]) => id.length <= 100 && validateQuestion(question)))
    throw new Error('Every question needs a type of noul, choice or score, and criteria that match it.')
  return request
}

export async function handleJevRequest(
  request: Request,
  env: JevEnvironment,
  fetchUpstream: FetchLike = fetch
): Promise<Response> {
  const url = new URL(request.url)
  if (request.headers.get('origin') && request.headers.get('origin') !== url.origin)
    return json({ error: 'Cross-origin requests are not allowed.' }, 403)
  if (request.headers.get('sec-fetch-site') === 'cross-site')
    return json({ error: 'Cross-site requests are not allowed.' }, 403)
  if (url.pathname === '/api/jev/status' && request.method === 'GET')
    return json({ configured: !!env.TYPESAFE_API_KEY })
  if (url.pathname !== '/api/jev/evaluate') return json({ error: 'Not found.' }, 404)
  if (request.method !== 'POST') return json({ error: 'Use POST.' }, 405)
  if (!request.headers.get('content-type')?.includes('application/json')) return json({ error: 'Send JSON.' }, 415)
  if (!env.TYPESAFE_API_KEY)
    return json({ error: 'Set TYPESAFE_API_KEY on the server to use structured evaluation.' }, 401)
  let input: EvaluationRequest
  try {
    const body = await request.text()
    if (body.length > 400000) return json({ error: 'Evaluation request is too large.' }, 413)
    input = validateEvaluationRequest(JSON.parse(body))
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'Invalid JSON.' }, 400)
  }
  // The route's whole job: same client, same retry policy, plus the key.
  const evaluation = Effect.flatMap(Jev, (client) =>
    client.ask({ state: input.state, questions: input.questions, model: input.model, signal: request.signal })
  ).pipe(Effect.provide(layer({ apiKey: env.TYPESAFE_API_KEY, fetch: fetchUpstream })), Effect.either)
  const result = await Effect.runPromise(evaluation)
  if (result._tag === 'Right') return json(result.right)
  const failure = result.left
  return failure._tag === 'JevBusy'
    ? json({ error: 'TypeSafe is rate limited or overloaded. Wait a moment, then retry.' }, 429)
    : json({ error: failure.message }, failure._tag === 'JevRejected' && failure.status === 401 ? 401 : 502)
}
