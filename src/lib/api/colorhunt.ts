/**
 * Color Hunt's palette feed — the same endpoint colorhunt.co's own grid calls.
 *
 * One POST returns one page of 40 palettes, each packed into a single
 * 24-character string of four 6-digit hex colors.
 *
 * The response carries no `Access-Control-Allow-Origin`, so a browser refuses
 * it: call this from a server (a Convex action, a Worker route) and pass the
 * parsed palettes down to the client.
 */

const FEED_URL = 'https://colorhunt.co/php/feed.php'

/** Palettes per page — `step` walks the feed in blocks of this size. */
export const PAGE_SIZE = 40

/** A well-formed feed code: four 6-digit hex colors, packed unseparated. */
const FEED_CODE = /^[0-9a-f]{24}$/i

export type Sort = 'new' | 'popular' | 'random'

/** One entry as the feed sends it — note that its numbers arrive as strings. */
export type Code = {
  code: string
  likes: string
  date: string
}

export type Palette = {
  /** The raw 24-character code; stable, so it doubles as an id. */
  code: string
  /** The four colors as `#RRGGBB`, upper case. */
  colors: [string, string, string, string]
  likes: number
  /** Age as the feed phrases it: `15 hours`, `3 weeks`, `1 month`. */
  date: string
}

export type FeedOptions = {
  /** Zero-based page: step `n` covers palettes `n * 40` through `n * 40 + 39`. */
  step?: number
  /** `popular` is scoped to `timeframe`; `new` and `random` span everything. */
  sort?: Sort
  /**
   * Color and style tags, e.g. `['pastel', 'vintage']`. The feed ANDs them, so
   * each extra tag narrows the page — and a single unknown tag empties it.
   */
  tags?: string[]
  /** How far back `popular` reaches, in days. */
  timeframe?: number
  signal?: AbortSignal
}

/** Splits a packed feed code into its `#RRGGBB` colors. */
export const toHex = (hexStr: string) => {
  const colors: string[] = []
  for (let i = 0; i < hexStr.length; i += 6) {
    colors.push('#' + hexStr.slice(i, i + 6).toUpperCase())
  }
  return colors
}

const toPalette = (entry: unknown): Palette | null => {
  if (typeof entry !== 'object' || entry === null) return null

  const { code, date, likes } = entry as Partial<Code>
  if (typeof code !== 'string' || !FEED_CODE.test(code)) return null

  // The pattern pins the code at 24 characters, so this is always four colors.
  const [one, two, three, four] = toHex(code)

  return {
    code,
    colors: [one, two, three, four],
    likes: Number.parseInt(String(likes), 10) || 0,
    date: typeof date === 'string' ? date : ''
  }
}

/**
 * Fetches one page of the feed — 40 palettes at `step: 0` — and drops any entry
 * whose code the feed did not send in the shape above.
 */
export const fetchPalettes = async (options: FeedOptions = {}): Promise<Palette[]> => {
  const { signal, sort = 'new', step = 0, tags = [], timeframe = 30 } = options

  const response = await fetch(FEED_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' },
    // A request with no body comes back `[]`, so every field goes on the wire.
    body: new URLSearchParams({
      step: String(step),
      sort,
      tags: tags.join(' '),
      timeframe: String(timeframe)
    }),
    signal
  })

  if (!response.ok) {
    throw new Error(`Color Hunt feed failed: ${response.status} ${response.statusText}`)
  }

  // The feed labels its JSON `text/html`, and serves an HTML error page on a bad
  // day, so parse the body here rather than failing inside `response.json()`.
  const payload = await response.text()

  let parsed: unknown
  try {
    parsed = JSON.parse(payload)
  } catch {
    throw new Error(`Color Hunt feed returned non-JSON: ${payload.slice(0, 120)}`)
  }

  if (!Array.isArray(parsed)) {
    throw new Error('Color Hunt feed returned something other than a list')
  }

  return parsed.map(toPalette).filter((palette): palette is Palette => palette !== null)
}
