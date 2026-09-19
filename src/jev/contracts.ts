/**
 * Wire types for TypeSafe's System One endpoint (`POST /v1/systemone`), and the typed question
 * builders the workflows compose.
 *
 * Jev does not generate text. It evaluates one `state` against a map of named questions and returns
 * a structured answer per question, each carrying the probability distribution it came from. Every
 * question is evaluated in parallel and in isolation against that state, so asking twenty costs
 * barely more latency than asking one, and no question can rot another's context.
 *
 * Answers are inferred from the questions, so `answers.intent.choice` is the union of the options
 * that question defined rather than `string`.
 */

/** Text, or structured data the model reads as records. `instructions` accept the same shapes. */
export type State = string | Record<string, unknown> | unknown[]
export type Instructions = State

export interface NoulQuestion {
  type: 'noul'
  instructions: Instructions
  criteria?: { true?: string; false?: string }
}
export interface ChoiceQuestion<Option extends string = string> {
  type: 'choice'
  instructions: Instructions
  criteria: Record<Option, string | null>
}
export interface ScoreQuestion {
  type: 'score'
  instructions: Instructions
  /** Ordered level descriptions, worst to best. At least two. */
  criteria: readonly string[]
}
export type Question = NoulQuestion | ChoiceQuestion<string> | ScoreQuestion
export type Questions = Record<string, Question>

/** 0 (no) to 1 (yes). A noul carries no confidence: the value is itself the distribution. */
export interface NoulAnswer { type: 'noul'; noul: number }
export interface ChoiceAnswer<Option extends string = string> {
  type: 'choice'
  choice: Option
  probabilities: Record<Option, number>
  confidence: number
}
/** `score` is probability-weighted across the levels, so it lands between them. */
export interface ScoreAnswer {
  type: 'score'
  score: number
  legend: Record<string, string>
  probabilities: Record<string, number>
  confidence: number
}
export type Answer = NoulAnswer | ChoiceAnswer | ScoreAnswer

export type AnswerFor<Q extends Question> =
  Q extends ChoiceQuestion<infer Option> ? ChoiceAnswer<Option> : Q extends ScoreQuestion ? ScoreAnswer : NoulAnswer
export type AnswersFor<Q extends Questions> = { [Key in keyof Q]: AnswerFor<Q[Key]> }

export interface Evaluation<Q extends Questions> {
  model: string
  answers: AnswersFor<Q>
  usage: { input_tokens: number; output_tokens: number }
}

export const DEFAULT_MODEL = 'jev-latest'
export const ENDPOINT = 'https://api.typesafe.ai/v1/systemone'
/** Jev's 64k budget covers the state plus every question; this keeps a wide fan-out inside it. */
export const MAX_QUESTIONS = 200

/** Is this statement true of the state? */
export const noul = (instructions: Instructions, criteria?: NoulQuestion['criteria']): NoulQuestion => ({
  type: 'noul',
  instructions,
  ...(criteria ? { criteria } : {})
})

/** Pick one option. The option keys survive into the answer's type. */
export const choice = <const Criteria extends Record<string, string | null>>(
  instructions: Instructions,
  criteria: Criteria
): ChoiceQuestion<Extract<keyof Criteria, string>> => ({
  type: 'choice',
  instructions,
  criteria: criteria as Record<Extract<keyof Criteria, string>, string | null>
})

/** Rate the state against ordered levels, worst first. */
export const score = <const Levels extends readonly [string, string, ...string[]]>(
  instructions: Instructions,
  criteria: Levels
): ScoreQuestion => ({ type: 'score', instructions, criteria })

/**
 * Confidence is how concentrated an answer's distribution is, from 0 to 1 — the model's own way of
 * saying "I am not sure". A gate turns it into one of three behaviours.
 *
 * The thresholds belong to the action, not to the model: showing a suggestion can act on a weak
 * read, overwriting a file should not. Tuning risk here means editing a number, not a prompt.
 */
export type Band = 'act' | 'confirm' | 'defer'
export interface Gate { act: number; confirm: number }

export const gates = {
  /** Reversible and visible. The worst case is a suggestion the developer ignores. */
  suggestion: { act: 0.45, confirm: 0.2 },
  /** The developer sees the result before it lands. */
  assisted: { act: 0.6, confirm: 0.35 },
  /** Writes project files without another prompt. */
  destructive: { act: 0.85, confirm: 0.6 }
} as const satisfies Record<string, Gate>

export const band = (confidence: number, gate: Gate): Band =>
  confidence >= gate.act ? 'act' : confidence >= gate.confirm ? 'confirm' : 'defer'

/**
 * A noul is a probability, not a boolean. Read it at the threshold the decision deserves: a
 * guardrail should trip well below 0.5, a merely useful hint well above it.
 */
export const yes = (noul: number, threshold = 0.5) => noul >= threshold

/** A Choice's full distribution, best first — the runners-up, not just the winner. */
export const ranked = <Option extends string>(probabilities: Record<Option, number>) =>
  (Object.entries(probabilities) as [Option, number][]).sort(([, a], [, b]) => b - a)

/** A Score normalised to 0..1 across its own levels, so dimensions with different level counts combine. */
export const normalized = (answer: ScoreAnswer) => {
  const top = Object.keys(answer.legend).length - 1
  return top > 0 ? Math.min(1, Math.max(0, answer.score / top)) : 0
}
