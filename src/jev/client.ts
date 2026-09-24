import { Context, Data, Duration, Effect, Layer, Schedule, Schema } from 'effect'
import { DEFAULT_MODEL, ENDPOINT, MAX_QUESTIONS, type AnswersFor, type Evaluation, type Questions, type State } from './contracts'

/**
 * The Jev client, as an Effect service.
 *
 * Four things this buys over a bare `async function askJev()`, and they are the reason Effect is
 * here rather than a promise and a try/catch:
 *
 * 1. Failures are in the type. `ask` returns `Effect<Evaluation<Q>, JevFailure>`; a caller that
 *    forgets a rate limit does not compile, and `Effect.catchTag('JevBusy', …)` narrows to exactly
 *    that case. Nothing is thrown, so nothing is silently swallowed.
 * 2. Retry is a value. `backoff` is a `Schedule` you can read, test and swap, instead of a loop
 *    with a counter braided through the request code.
 * 3. Interruption is real. The promise handed to `Effect.tryPromise` receives an `AbortSignal`
 *    that fires when the fiber is interrupted, so a cancelled chat turn cancels its HTTP call.
 * 4. The dependency is a value too. A workflow says `ask({ … })` and Effect records `Jev` as a
 *    requirement; the browser provides `proxyLayer()`, the server provides `layer({ apiKey })`,
 *    and a test provides a stub — none of which the workflow knows about.
 */

/** 401/403/422 and friends: the request itself is wrong, so retrying it changes nothing. */
export class JevRejected extends Data.TaggedError('JevRejected')<{ status: number; message: string }> {}
/** 429/529: correct request, wrong moment. `retryAfter` is the server's own advice. */
export class JevBusy extends Data.TaggedError('JevBusy')<{ status: number; retryAfter: Duration.Duration }> {}
/** The call never produced an answer: network or timeout. Transient, so worth another attempt. */
export class JevUnreachable extends Data.TaggedError('JevUnreachable')<{ message: string; cause?: unknown }> {}
/**
 * A 200 whose body is not the evaluation it claims to be: a field of the wrong type, or an answer
 * missing for a question we asked. Separate from `JevUnreachable` because it is deterministic —
 * retrying gets the same malformed body, for the same reason a 422 is not retried.
 */
export class JevMalformed extends Data.TaggedError('JevMalformed')<{ message: string }> {}
export type JevFailure = JevRejected | JevBusy | JevUnreachable | JevMalformed

/**
 * The wire shape, checked rather than asserted.
 *
 * These numbers gate destructive things — auto-applying a patch, spending a developer's remaining
 * attempts, reporting whether attached source tried to inject instructions. An unchecked cast turns
 * a missing field into `undefined`, and every threshold in `contracts.ts` compares with `>=`, so
 * `undefined` reads as a quiet "no" instead of a failure. A guardrail that fails open in silence is
 * worse than one that throws, so the shape is verified before any of it is believed.
 */
const Distribution = Schema.Record({ key: Schema.String, value: Schema.Number })
const WireAnswer = Schema.Union(
  Schema.Struct({ type: Schema.Literal('noul'), noul: Schema.Number }),
  Schema.Struct({
    type: Schema.Literal('choice'),
    choice: Schema.String,
    probabilities: Distribution,
    confidence: Schema.Number
  }),
  Schema.Struct({
    type: Schema.Literal('score'),
    score: Schema.Number,
    legend: Schema.Record({ key: Schema.String, value: Schema.String }),
    probabilities: Distribution,
    confidence: Schema.Number
  })
)
const WireEvaluation = Schema.Struct({
  model: Schema.String,
  answers: Schema.Record({ key: Schema.String, value: WireAnswer }),
  usage: Schema.Struct({ input_tokens: Schema.Number, output_tokens: Schema.Number })
})
const decode = Schema.decodeUnknown(WireEvaluation)

/**
 * Every question answered, and answered as the type it was asked as. The schema proves the envelope;
 * this proves the envelope holds the answers this particular call is about to read.
 */
const verify = <Q extends Questions>(
  evaluation: Schema.Schema.Type<typeof WireEvaluation>,
  questions: Q
): Effect.Effect<Evaluation<Q>, JevMalformed> => {
  for (const [id, question] of Object.entries(questions)) {
    const answer = evaluation.answers[id]
    if (!answer) return Effect.fail(new JevMalformed({ message: `TypeSafe did not answer "${id}".` }))
    if (answer.type !== question.type)
      return Effect.fail(
        new JevMalformed({ message: `"${id}" was asked as ${question.type} and answered as ${answer.type}.` })
      )
  }
  return Effect.succeed({
    model: evaluation.model,
    answers: evaluation.answers as AnswersFor<Q>,
    usage: evaluation.usage
  })
}

export interface Ask<Q extends Questions> {
  state: State
  questions: Q
  model?: string
  /** Caller-side cancellation, on top of the fiber's own interruption. */
  signal?: AbortSignal
}

export interface JevClient {
  readonly ask: <Q extends Questions>(request: Ask<Q>) => Effect.Effect<Evaluation<Q>, JevFailure>
}

export class Jev extends Context.Tag('Jev')<Jev, JevClient>() {}

/**
 * How a workflow asks. The `Jev` requirement travels in the effect's type until something provides
 * a layer, which is what keeps the workflows below free of endpoints, keys and fetch.
 */
export const ask = <Q extends Questions>(request: Ask<Q>): Effect.Effect<Evaluation<Q>, JevFailure, Jev> =>
  Effect.flatMap(Jev, (client) => client.ask(request))

export interface JevConfig {
  /** Server-side only. The browser layer sends no key and proxies through the playground instead. */
  apiKey?: string
  endpoint?: string
  model?: string
  /** Per attempt, not for the whole retry sequence. */
  timeout?: Duration.DurationInput
  retries?: number
  /** Structurally `FetchLike`: the playground's own injectable fetch, not the DOM's full type. */
  fetch?: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>
}

const explain = (status: number) =>
  status === 401 || status === 403
    ? 'TypeSafe rejected the API key. Check TYPESAFE_API_KEY on the server.'
    : status === 422
      ? 'TypeSafe could not read the questions in this request.'
      : status === 404
        ? 'The TypeSafe endpoint or model was not found.'
        : 'TypeSafe could not complete this evaluation.'

/** Clamped: a server asking us to wait ten minutes is not something a chat turn should honour. */
const retryAfterOf = (response: Response) => {
  const seconds = Number(response.headers.get('retry-after'))
  return Number.isFinite(seconds) && seconds > 0 ? Duration.seconds(Math.min(seconds, 20)) : Duration.zero
}

const discard = (response: Response) => Effect.promise(() => response.body?.cancel().catch(() => {}) ?? Promise.resolve())

/** One attempt. The retry policy lives outside it, where it can be read on its own. */
const attempt = <Q extends Questions>(config: JevConfig, request: Ask<Q>) =>
  Effect.suspend(() => {
    // Own the connection through body consumption, not just until headers arrive.
    const connection = new AbortController()
    return Effect.gen(function* () {
      const send = config.fetch ?? fetch
      const response = yield* Effect.tryPromise({
        try: (interrupt) =>
          send(config.endpoint ?? ENDPOINT, {
            method: 'POST',
            redirect: 'error',
            signal: AbortSignal.any([connection.signal, interrupt, ...(request.signal ? [request.signal] : [])]),
            headers: {
              'Content-Type': 'application/json',
              ...(config.apiKey ? { Authorization: `Bearer ${config.apiKey}` } : {})
            },
            body: JSON.stringify({
              state: request.state,
              model: request.model ?? config.model ?? DEFAULT_MODEL,
              questions: request.questions
            })
          }),
        catch: (cause) => new JevUnreachable({ message: 'Could not reach TypeSafe. Check the connection and retry.', cause })
      })
      if (response.status === 429 || response.status === 529) {
        yield* discard(response)
        return yield* new JevBusy({ status: response.status, retryAfter: retryAfterOf(response) })
      }
      if (!response.ok) {
        yield* discard(response)
        return yield* new JevRejected({ status: response.status, message: explain(response.status) })
      }
      const body = yield* Effect.tryPromise({
        try: () => response.json() as Promise<unknown>,
        catch: () => new JevMalformed({ message: 'TypeSafe returned a body that was not JSON.' })
      })
      const evaluation = yield* decode(body).pipe(
        Effect.mapError(
          (error) => new JevMalformed({ message: `TypeSafe returned an unexpected evaluation: ${error.message.slice(0, 200)}` })
        )
      )
      return yield* verify(evaluation, request.questions)
    }).pipe(Effect.ensuring(Effect.sync(() => connection.abort())))
  })

/** Jittered so a fan-out that rate-limits does not retry in lockstep. */
const backoff = (retries: number) =>
  Schedule.exponential(Duration.millis(400), 2).pipe(Schedule.jittered, Schedule.intersect(Schedule.recurs(retries)))

/** Only the two transient failures. A rejected request and a malformed body are the same every time. */
const retryable = (error: JevFailure) => error._tag === 'JevBusy' || error._tag === 'JevUnreachable'

/**
 * The live client. On the server this carries the key; pointed at the playground's own route it
 * carries none, which is the whole of `proxyLayer`.
 */
export const layer = (config: JevConfig = {}): Layer.Layer<Jev> =>
  Layer.succeed(Jev, {
    ask: <Q extends Questions>(request: Ask<Q>) => {
      const count = Object.keys(request.questions).length
      if (!count || count > MAX_QUESTIONS)
        return Effect.fail(new JevRejected({ status: 422, message: `Ask between 1 and ${MAX_QUESTIONS} questions in one call.` }))
      return attempt(config, request).pipe(
        Effect.timeoutFail({
          duration: config.timeout ?? Duration.seconds(30),
          onTimeout: () => new JevUnreachable({ message: 'TypeSafe did not answer in time.' })
        }),
        // The server's own advice comes first; the schedule's backoff is added on top of it.
        Effect.tapError((error) =>
          error._tag === 'JevBusy' && Duration.greaterThan(error.retryAfter, Duration.zero)
            ? Effect.sleep(error.retryAfter)
            : Effect.void
        ),
        Effect.retry({ while: retryable, schedule: backoff(config.retries ?? 3) })
      )
    }
  })

/** The browser layer: identical interface, no key, routed through the playground's server. */
export const proxyLayer = (endpoint = '/api/jev/evaluate') => layer({ endpoint })
