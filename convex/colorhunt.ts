import { v } from 'convex/values'
import { action } from './_generated/server'
import { appError, requireIdentity } from './auth'
import { type Palette, fetchPalettes } from '../src/lib/api/colorhunt'

/**
 * Color Hunt's palette feed, proxied.
 *
 * The feed answers without `Access-Control-Allow-Origin`, so the browser refuses
 * it: the request is made here instead and the parsed palettes go back to the
 * client. Nothing is stored — each call is a live read of colorhunt.co.
 */

const paletteValidator = v.object({
  code: v.string(),
  /** Always four `#RRGGBB` colors, though a validator cannot pin the length. */
  colors: v.array(v.string()),
  likes: v.number(),
  date: v.string()
})

/** The feed's tags are single lowercase words: `pastel`, `mint`, `vintage`. */
const TAG = /^[a-z]+$/

/** Pages run out long before this; the cap stops a typo walking the whole feed. */
const MAX_STEP = 100
const MAX_TAGS = 8

/** The feed answers in well under a second — past this it is not coming. */
const TIMEOUT_MS = 10_000

/**
 * One page of palettes, 40 per page at `step: 0`.
 *
 * Signed in only: this calls a third party on the caller's behalf, so it is not
 * left open to the internet.
 */
export const list = action({
  args: {
    step: v.optional(v.number()),
    sort: v.optional(v.union(v.literal('new'), v.literal('popular'), v.literal('random'))),
    tags: v.optional(v.array(v.string())),
    timeframe: v.optional(v.number())
  },
  returns: v.array(paletteValidator),
  handler: async (ctx, args): Promise<Palette[]> => {
    await requireIdentity(ctx)

    const step = args.step ?? 0
    if (!Number.isInteger(step) || step < 0 || step > MAX_STEP) {
      return appError('INVALID_ARGUMENT', `step must be a whole number from 0 to ${MAX_STEP}.`)
    }

    const timeframe = args.timeframe ?? 30
    if (!Number.isInteger(timeframe) || timeframe < 1) {
      return appError('INVALID_ARGUMENT', 'timeframe must be a whole number of days.')
    }

    const tags = args.tags ?? []
    if (tags.length > MAX_TAGS) {
      return appError('INVALID_ARGUMENT', `Pass at most ${MAX_TAGS} tags.`)
    }

    // The feed ANDs its tags and returns an empty page for one it does not know,
    // so a malformed tag is worth naming rather than reporting as "no palettes".
    const malformed = tags.find((tag) => !TAG.test(tag))
    if (malformed !== undefined) {
      return appError('INVALID_ARGUMENT', `"${malformed}" is not a Color Hunt tag; tags are single lowercase words.`)
    }

    try {
      return await fetchPalettes({ sort: args.sort, step, tags, timeframe, signal: AbortSignal.timeout(TIMEOUT_MS) })
    } catch (error) {
      const reason = error instanceof Error ? error.message : 'unknown error'
      return appError('COLORHUNT_UNAVAILABLE', `Could not read the Color Hunt feed: ${reason}`)
    }
  }
})
