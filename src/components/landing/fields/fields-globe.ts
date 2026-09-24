import type { Theme } from '../../../playground/theme'

/**
 * The hero's "fields": a globe drawn as a stack of horizontal rules. Each rule crosses the globe as a
 * coloured chord, split where it meets one meridian, and carries a grey tick outside the globe that sits
 * further out the shorter the chord is — so the ticks trace the globe's negative space. Rules thin out and
 * their dots shrink toward the poles, following the cosine of their latitude. The meridian sways
 * on the page clock, or follows the pointer across the globe, sliding every split along its chord.
 */

type Rgb = readonly [number, number, number]
/** A colour down the globe: `at` runs from 0 on the top rule to 1 on the bottom one. */
type Stop = readonly [at: number, color: Rgb]

interface Palette {
  /** Each rule's full-width hairline. */
  rule: string
  /** The stretch of rule between an outer tick and the globe. */
  reach: string
  /** The outer ticks. */
  tick: string
  /** Chords west of the meridian, top to bottom. */
  west: readonly Stop[]
  /** Chords east of the meridian, top to bottom. */
  east: readonly Stop[]
}

const palettes: Record<Theme, Palette> = {
  dark: {
    rule: 'rgb(255 255 255 / 0.045)',
    reach: 'rgb(255 255 255 / 0.13)',
    tick: 'rgb(255 255 255 / 0.38)',
    west: [
      [0, [214, 236, 234]],
      [0.3, [218, 215, 118]],
      [0.62, [126, 190, 98]],
      [1, [24, 124, 72]]
    ],
    east: [
      [0, [234, 244, 244]],
      [0.42, [240, 228, 210]],
      [0.68, [244, 162, 184]],
      [1, [238, 136, 64]]
    ]
  },
  light: {
    rule: 'rgb(20 21 23 / 0.06)',
    reach: 'rgb(20 21 23 / 0.17)',
    tick: 'rgb(20 21 23 / 0.45)',
    west: [
      [0, [14, 116, 124]],
      [0.3, [140, 136, 20]],
      [0.62, [72, 138, 40]],
      [1, [21, 101, 52]]
    ],
    east: [
      [0, [71, 85, 105]],
      [0.42, [182, 110, 14]],
      [0.68, [214, 44, 116]],
      [1, [226, 88, 18]]
    ]
  }
}

/** Rule spacing bounds in CSS pixels; small globes pack their rules tighter. */
const MAX_GAP = 11
const MIN_GAP = 5
/** Stroke width, in CSS pixels, of a rule at the equator and of one at a pole. */
const EQUATOR_WIDTH = 1.1
const POLE_WIDTH = 0.25
/** How far out the outer ticks reach, as a multiple of the radius. */
const REACH = 2.6
/** The clear space either side of the meridian on each chord. */
const SPLIT_GAP = 3
/** The meridian's idle sway: longitude in radians is `amplitude * sin(2π·t/period + phase)`. */
const SWAY = { amplitude: 0.95, period: 16_000, phase: -0.7 }
/** Time constant, in milliseconds, of the meridian easing toward its target. */
const EASE = 160

interface Layout {
  width: number
  cx: number
  cy: number
  radius: number
  reach: number
  gap: number
  count: number
  span: number
}

function layout(width: number, height: number): Layout {
  // The radius is capped by the height and by the width the outer ticks need either side of the globe.
  const radius = Math.max(24, Math.min(height / 2 - 12, (width / 2 - 8) / 2.15))
  const gap = Math.min(MAX_GAP, Math.max(MIN_GAP, radius / 20))
  // Stop just short of the poles so the top and bottom rules still show a chord.
  const count = Math.floor((radius * 2 - gap * 1) / gap) + 6
  return {
    width,
    cx: width / 2,
    cy: height / 2,
    radius,
    reach: Math.min(radius * REACH, width / 2 - 6),
    gap,
    count,
    span: (count - 1) * gap
  }
}

const mix = (a: Rgb, b: Rgb, amount: number): Rgb => [
  a[0] + (b[0] - a[0]) * amount,
  a[1] + (b[1] - a[1]) * amount,
  a[2] + (b[2] - a[2]) * amount
]

function sample(stops: readonly Stop[], at: number): Rgb {
  let index = 1
  while (index < stops.length - 1 && stops[index][0] < at) index++
  const [from, a] = stops[index - 1]
  const [to, b] = stops[index]
  return mix(a, b, Math.min(1, Math.max(0, (at - from) / (to - from))))
}

const css = ([r, g, b]: Rgb, alpha = 1) => `rgb(${Math.round(r)} ${Math.round(g)} ${Math.round(b)} / ${alpha})`

function line(context: CanvasRenderingContext2D, from: number, to: number, y: number, color: string) {
  if (to - from < 0.5) return
  context.strokeStyle = color
  context.beginPath()
  context.moveTo(from, y)
  context.lineTo(to, y)
  context.stroke()
}

function dot(context: CanvasRenderingContext2D, x: number, y: number, radius: number, color: string) {
  context.fillStyle = color
  context.beginPath()
  context.arc(x, y, radius, 0, Math.PI * 2)
  context.fill()
}

function draw(context: CanvasRenderingContext2D, height: number, frame: Layout, palette: Palette, meridian: number) {
  const { width, cx, cy, radius, reach, gap, count, span } = frame
  const turn = Math.sin(meridian)
  // Dots scale with the rule spacing, so tightly packed rules don't run their beads together.
  const bead = Math.min(2.4, gap * 0.24)
  context.clearRect(0, 0, width, height)

  for (let index = 0; index < count; index++) {
    const dy = index * gap - span / 2
    // Snap to the half pixel so hairlines stay crisp.
    const y = Math.round(cy + dy) + 0.5
    const half = Math.sqrt(radius * radius - dy * dy)
    // The cosine of the rule's latitude: 1 on the equator, falling to 0 at the poles.
    const weight = half / radius
    const size = 0.45 + 0.55 * weight
    const outer = Math.max(reach - half, half + gap)
    const split = cx + half * turn
    const at = count > 1 ? index / (count - 1) : 0.5
    const west = sample(palette.west, at)
    const east = sample(palette.east, at)

    context.lineWidth = POLE_WIDTH + (EQUATOR_WIDTH - POLE_WIDTH) * weight
    line(context, 0, cx - outer, y, palette.rule)
    line(context, cx + outer, width, y, palette.rule)
    line(context, cx - outer, cx - half, y, palette.reach)
    line(context, cx + half, cx + outer, y, palette.reach)
    line(context, cx - half, split - SPLIT_GAP, y, css(west, 0.72))
    line(context, split + SPLIT_GAP, cx + half, y, css(east, 0.72))
    dot(context, cx - outer, y, 1.25 * size, palette.tick)
    dot(context, cx + outer, y, 1.25 * size, palette.tick)
    dot(context, cx - half, y, bead * size, css(west))
    dot(context, cx + half, y, bead * size, css(east))
    // Where the meridian crosses; with the rules this close, a dot per rule reads as a curve.
    dot(context, split, y, bead * 0.66 * size, css(mix(west, east, 0.5)))
  }
}

const sway = (now: number) => SWAY.amplitude * Math.sin((now / SWAY.period) * Math.PI * 2 + SWAY.phase)

/**
 * Draws the globe into `canvas`, sized to its CSS box, and animates it while it is on screen. The sway is
 * keyed to the page clock rather than the mount, so remounting (say, for a theme change) picks up exactly
 * where the last mount left off. Returns the cleanup.
 */
export function mountFieldsGlobe(canvas: HTMLCanvasElement, theme: Theme): () => void {
  const context = canvas.getContext('2d')
  if (!context) return () => {}
  const palette = palettes[theme]
  const still = matchMedia('(prefers-reduced-motion: reduce)').matches
  let height = 0
  let frame = layout(0, 0)
  let meridian = sway(still ? 0 : performance.now())
  /** The pointer's distance from the canvas's left edge, while it is over the canvas. */
  let pointer: number | null = null
  let visible = false
  let request = 0
  let last = 0

  const render = () => draw(context, height, frame, palette, meridian)
  const tick = (now: number) => {
    request = requestAnimationFrame(tick)
    const target =
      pointer === null ? sway(now) : Math.asin(Math.min(0.96, Math.max(-0.96, (pointer - frame.cx) / frame.radius)))
    meridian += (target - meridian) * (1 - Math.exp(-(now - last) / EASE))
    last = now
    render()
  }
  const start = () => {
    if (request || still || !visible) return
    last = performance.now()
    // Coming back on screen, rejoin the sway where it is now rather than sweeping over to it.
    if (pointer === null) meridian = sway(last)
    request = requestAnimationFrame(tick)
  }
  const stop = () => {
    cancelAnimationFrame(request)
    request = 0
  }

  const resize = () => {
    const ratio = window.devicePixelRatio || 1
    height = canvas.clientHeight
    frame = layout(canvas.clientWidth, height)
    canvas.width = Math.round(frame.width * ratio)
    canvas.height = Math.round(height * ratio)
    context.setTransform(ratio, 0, 0, ratio, 0, 0)
    render()
  }
  const move = (event: PointerEvent) => {
    pointer = event.offsetX
  }
  const leave = () => {
    pointer = null
  }

  const sizes = new ResizeObserver(resize)
  sizes.observe(canvas)
  const sightings = new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting
    if (visible) start()
    else stop()
  })
  sightings.observe(canvas)
  canvas.addEventListener('pointermove', move)
  canvas.addEventListener('pointerleave', leave)

  return () => {
    stop()
    sizes.disconnect()
    sightings.disconnect()
    canvas.removeEventListener('pointermove', move)
    canvas.removeEventListener('pointerleave', leave)
  }
}
