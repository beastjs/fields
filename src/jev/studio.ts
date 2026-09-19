import { Effect } from 'effect'
import { sectionKinds } from '../playground/studio/kinds'
import type { SectionKindId } from '../playground/studio/types'
import { ask } from './client'
import {
  MAX_QUESTIONS,
  band,
  choice,
  gates,
  noul,
  normalized,
  score,
  yes,
  type Band,
  type ScoreQuestion
} from './contracts'

/**
 * Design Studio workflows.
 *
 * The studio already knows its catalog cold — 14 kinds, their stage in a page's story, and a
 * keyworded summary per preset. What it cannot do is read a sentence like "landing page for a
 * B2B security product, technical buyers" and say which of those presets belong on it. That is a
 * judgment, and it is the kind Jev answers in one call over the whole catalog.
 */

export interface SectionCandidate {
  presetId: string
  kind: SectionKindId
  title: string
  description: string
  keywords: readonly string[]
}

export interface SuggestedSection {
  presetId: string
  kind: SectionKindId
  fit: number
  confidence: number
  band: Band
}

const FIT = [
  'Wrong for this page: it would have to be cut',
  'Plausible: it would not look out of place',
  'Clearly belongs: this page is weaker without it'
] as const

/**
 * Rank the preset catalog against a brief.
 *
 * One Score per preset, every one evaluated against the same brief in a single request. The
 * ranking is returned whole rather than reduced to a page, because the library wants to show the
 * runners-up and the developer picks.
 */
export const suggestSections = (input: { brief: string; catalog: readonly SectionCandidate[] }, limit = 12) =>
  Effect.gen(function* () {
    const catalog = input.catalog.slice(0, MAX_QUESTIONS)
    if (!catalog.length) return [] as SuggestedSection[]
    const questions: Record<string, ScoreQuestion> = Object.fromEntries(
      catalog.map((preset, index) => [
        `p${index}`,
        score(
          { section: preset.title, kind: preset.kind, describes: preset.description, keywords: [...preset.keywords] },
          FIT
        )
      ])
    )
    const { answers } = yield* ask({ state: { brief: input.brief }, questions })
    return catalog
      .map((preset, index) => {
        const answer = answers[`p${index}`]
        return {
          presetId: preset.presetId,
          kind: preset.kind,
          fit: answer.score,
          confidence: answer.confidence,
          band: band(answer.confidence, gates.suggestion)
        }
      })
      .filter((preset) => preset.fit >= 1)
      .sort((a, b) => b.fit - a.fit)
      .slice(0, limit)
  })

/**
 * What a page is judged on, and what each dimension is worth.
 *
 * This is the point of composite scoring: four narrow questions Jev can answer reliably, combined
 * by weights that live here. "Our pages under-convert" is a coefficient change in this object, not
 * a rewritten prompt and not a retrained anything.
 */
export const weights = { narrative: 0.3, conversion: 0.3, proof: 0.25, clarity: 0.15 } as const
export type Dimension = keyof typeof weights

export interface PageReview {
  /** 0..1, the weighted combination of the dimensions below. */
  health: number
  parts: Record<Dimension, number>
  /** The section kind the page most wants next, or undefined when it is not missing one. */
  missing?: SectionKindId
  missingConfidence: number
  ready: boolean
}

const kindCriteria: Record<string, string | null> = {
  ...Object.fromEntries(sectionKinds.map((kind) => [kind.id, kind.summary])),
  none: 'The page covers what it needs. Adding another section would pad it.'
}

/** Read an outline of the composed page, so the judgment is about the page and not its markup. */
export const reviewPage = (input: {
  brief: string
  blocks: readonly { kind: SectionKindId; title?: string }[]
}) =>
  Effect.gen(function* () {
    const outline = input.blocks.map((block, index) => ({
      position: index + 1,
      kind: block.kind,
      stage: sectionKinds.find((kind) => kind.id === block.kind)?.stage ?? 'explain',
      section: block.title ?? block.kind
    }))
    const { answers } = yield* ask({
      state: { brief: input.brief, page: outline, section_count: outline.length },
      questions: {
        narrative: score('How well the sections build on each other from top to bottom', [
          'Disjointed: sections fight each other or repeat',
          'Serviceable: the order makes sense but does not build',
          'Deliberate: each section earns the next one'
        ]),
        conversion: score('How clearly the page gives a visitor something to do', [
          'No obvious next step',
          'A next step exists but is buried or vague',
          'An unmissable, specific next step'
        ]),
        proof: score('How well the page supports its claims with evidence', [
          'Claims stand alone',
          'Some proof, thin or generic',
          'Concrete proof a sceptical buyer would accept'
        ]),
        clarity: score('How quickly a first-time visitor understands what is being offered', [
          'Unclear after reading the whole page',
          'Clear after some work',
          'Clear within the first screen'
        ]),
        missing: choice('Which single section would most improve this page for its brief?', kindCriteria),
        ready: noul('This page is good enough to put in front of its intended audience as it stands', {
          true: 'A reasonable person would ship it and iterate',
          false: 'Something important is missing or actively working against it'
        })
      }
    })
    const parts = {
      narrative: normalized(answers.narrative),
      conversion: normalized(answers.conversion),
      proof: normalized(answers.proof),
      clarity: normalized(answers.clarity)
    } satisfies Record<Dimension, number>
    const missing = answers.missing
    return {
      health: (Object.keys(weights) as Dimension[]).reduce((sum, key) => sum + weights[key] * parts[key], 0),
      parts,
      // A suggestion in a side panel, so a soft gate — but `none` is an answer, not a miss.
      missing:
        missing.choice !== 'none' && band(missing.confidence, gates.suggestion) !== 'defer'
          ? (missing.choice as SectionKindId)
          : undefined,
      missingConfidence: missing.confidence,
      ready: yes(answers.ready.noul)
    } satisfies PageReview
  })
