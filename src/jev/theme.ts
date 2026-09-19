import { Effect } from 'effect'
import { portrait, type ThemeAxes, type ThemePortrait } from '../playground/studio/palette'
import type { ThemeDocument } from '../playground/studio/themes'
import { ask } from './client'
import { choice, noul, normalized, score } from './contracts'
import {
  ERA_CRITERIA,
  GROUND_CRITERIA,
  HUE_CRITERIA,
  MAX_QUERIES,
  MAX_QUERY_LENGTH,
  NEUTRAL_AXES,
  VOICE_CRITERIA,
  auras,
  axisChoice,
  buildTheme,
  quantize,
  type ThemeAnswer,
  type ThemeDesign,
  type ThemeMood
} from './theme-model'

/**
 * Themes, palettes and mood, by asking rather than generating.
 *
 * Jev writes nothing — no prose, no hex, no CSS. What it does is locate a point in a space you define, with a
 * calibrated distribution over the alternatives. A theme in this playground happens to *be* such a point: seven
 * coordinates in `palette.ts` reconstruct the whole stylesheet. So the division of labour writes itself. Jev
 * answers "how dark, which hue, how vivid, how round, which voice, how tight, how stark" against a brief,
 * `theme-model.ts` composes the palette from those answers and proves it is readable, and nothing anywhere has to
 * invent a colour.
 *
 * Two properties of System One make this better than asking a text model for a palette, rather than merely
 * different. A Score is probability-weighted, so "fairly vivid" comes back as 0.62 and becomes a chroma — the
 * answers are continuous where the parameters are. And every question is answered with its full distribution, so
 * "mostly blue, but teal was a real contender" survives into the UI instead of collapsing to one guess.
 *
 * Three things a caller can do: design a theme from a brief, read the mood of any theme that already exists, and
 * put the user's own questions to it. Everything pure is in `theme-model.ts`, which keeps Effect out of the
 * studio's bundle until someone actually designs something.
 */

/** A Score's levels double as its own documentation: the axis is named by its ends. */
const SATURATION = ['Almost no colour. Greys and barely-there tints', 'Present but restrained', 'Vivid. The colour is the point'] as const
const CORNERS = ['Perfectly square. Nothing is rounded', 'Softened but still architectural', 'Very round, approaching pills and circles'] as const
const DENSITY = ['Tight. Information-dense, little breathing room', 'Comfortable, conventional spacing', 'Airy. Generous space, few things per screen'] as const
const CONTRAST = ['Quiet. Type sits close to its ground', 'Clear and ordinary', 'Stark. Maximum separation, high drama'] as const

const axisQuestions = {
  ground: choice('How dark should the page itself be?', GROUND_CRITERIA),
  hue: choice('What colour cast should the page ground carry?', HUE_CRITERIA),
  accent: choice('What colour should the accent be — links, buttons, emphasis?', HUE_CRITERIA),
  voice: choice('What kind of typeface should this page be set in?', VOICE_CRITERIA),
  saturation: score('How saturated the palette should be', SATURATION),
  corners: score('How rounded the corners should be', CORNERS),
  density: score('How much space the layout should use', DENSITY),
  contrast: score('How stark the type should be against its ground', CONTRAST),
  aura: choice('Which of these characters should this page carry?', auras)
}

export interface ThemeBrief {
  /** What the page is for, in the developer's own words. */
  brief: string
  /** Refinements in the order they were asked for, so later ones win. */
  refinements?: readonly string[]
  /** The theme being refined, described for the model, when this is not the first pass. */
  current?: ThemePortrait
}

const briefState = (input: ThemeBrief) => ({
  brief: input.brief,
  ...(input.current ? { current_theme: input.current } : {}),
  ...(input.refinements?.length ? { adjustments_requested_in_order: [...input.refinements] } : {})
})

/**
 * Locate a theme for a brief.
 *
 * One call, nine questions, every one evaluated against the same brief in parallel. The four Scores come back as
 * probability-weighted values rather than labels, which is what lets a palette be tuned continuously instead of
 * snapped to a preset — and what makes a refinement like "a little warmer" a real move rather than a jump to the
 * next bucket.
 *
 * Refinements are additive: pass the previous portrait and the ordered list of what the developer asked for, and
 * this answers the same nine questions with that history in the state. Nothing is stateful here; the caller owns
 * the history, which is what makes a refinement undoable.
 */
export const designTheme = (input: ThemeBrief) =>
  Effect.gen(function* () {
    const { answers } = yield* ask({ state: briefState(input), questions: axisQuestions })
    const aura = axisChoice(answers.aura, 'minimal')
    const ground = axisChoice(answers.ground, NEUTRAL_AXES.ground)
    const hue = axisChoice(answers.hue, NEUTRAL_AXES.hue)
    const accentHue = axisChoice(answers.accent, NEUTRAL_AXES.accent)
    const voice = axisChoice(answers.voice, NEUTRAL_AXES.voice)
    // Quantised so the theme and its id describe exactly the same palette; see `quantize`.
    const scales = {
      saturation: quantize(normalized(answers.saturation)),
      corners: quantize(normalized(answers.corners)),
      density: quantize(normalized(answers.density)),
      contrast: quantize(normalized(answers.contrast))
    }
    const axes: ThemeAxes = { ground: ground.value, hue: hue.value, accent: accentHue.value, voice: voice.value, ...scales }
    const composed = buildTheme(axes, aura.value)
    return {
      axes,
      theme: composed.theme,
      contrast: composed.contrast,
      contrastRaised: composed.raised,
      aura,
      ground,
      hue,
      accentHue,
      voice,
      scales
    } satisfies ThemeDesign
  })

const moodQuestions = {
  aura: choice('Which character does this palette carry?', auras),
  temperature: score('How warm or cold this palette feels', ['Cold and distant', 'Neither warm nor cool', 'Warm and close']),
  energy: score('How much energy this palette has', ['Still and quiet', 'Steady', 'Loud and electric']),
  formality: score('How formal this palette is', ['Informal and playful', 'Professional but human', 'Institutional and serious']),
  weight: score('How heavy this palette feels', ['Weightless and airy', 'Balanced', 'Heavy and solid']),
  era: choice('Which period does this palette look like it belongs to?', ERA_CRITERIA),
  premium: noul('This palette would be read as expensive rather than cheap', {
    true: 'Restrained, confident, sparing with colour and decoration',
    false: 'Busy, loud, or using colour to compensate for something'
  }),
  trustworthy: noul('A cautious person would trust a financial or medical product wearing this palette', {
    true: 'Calm, conventional, unsurprising',
    false: 'Loud, novel, or playful enough to raise a doubt'
  })
}

/**
 * The mood of any theme — generated here, built in, or written by a team.
 *
 * Jev reads text, so a palette has to be put into words first. `portrait()` does that, and hands over the contrast
 * ratios as measured numbers rather than letting them be estimated. Everything this returns is therefore a
 * judgment about the *portrait*, which is the honest limit of the feature: improve the verbalisation and every
 * answer here improves with it.
 */
export const readMood = (theme: ThemeDocument) =>
  Effect.gen(function* () {
    const shown = portrait(theme)
    const { answers } = yield* ask({ state: { palette: shown }, questions: moodQuestions })
    return {
      aura: axisChoice(answers.aura, 'minimal'),
      era: axisChoice(answers.era, 'now'),
      temperature: normalized(answers.temperature),
      energy: normalized(answers.energy),
      formality: normalized(answers.formality),
      weight: normalized(answers.weight),
      premium: answers.premium.noul,
      trustworthy: answers.trustworthy.noul,
      portrait: shown
    } satisfies ThemeMood
  })

/**
 * Put the developer's own questions to a palette.
 *
 * The neat part is that no translation is needed: a Noul's `instructions` *are* a yes/no question in English, so
 * "would this work for a children's hospital?" is already a well-formed question and comes back as a calibrated
 * probability. Asking twelve costs one call.
 *
 * It is also the safest possible place to accept free text. A System One model has no tools and emits no prose —
 * the only thing it can return is a number between 0 and 1 — so text that tries to issue instructions has nothing
 * to reach. The usual prompt-injection surface simply is not there.
 */
export const askAboutTheme = (theme: ThemeDocument, questions: readonly string[]) =>
  Effect.gen(function* () {
    const asked = questions
      .map(question => question.trim().slice(0, MAX_QUERY_LENGTH))
      .filter(question => question.length > 0)
      .slice(0, MAX_QUERIES)
    if (!asked.length) return [] as ThemeAnswer[]
    const { answers } = yield* ask({
      state: { palette: portrait(theme) },
      questions: Object.fromEntries(asked.map((question, index) => [`q${index}`, noul(question)]))
    })
    return asked.map((question, index) => {
      const probability = answers[`q${index}`].noul
      return {
        question,
        probability,
        // A margin, not a threshold: 0.52 is the model declining to commit, and saying so is more useful than a yes.
        verdict: probability >= 0.68 ? 'yes' : probability <= 0.32 ? 'no' : 'unsure'
      } satisfies ThemeAnswer
    })
  })
