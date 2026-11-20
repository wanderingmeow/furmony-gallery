// src/draw/axisLabels.ts - the room a bar chart's x-axis words need.
//
// Tilted words run as parallel strips, so what keeps them apart is the distance between their ticks
// measured across the tilt, not their length. Canvas text metrics differ between engines, so the
// widths and the depth are asked from a canvas instead of guessed from the font size.

/** The axis font size the charts draw at. */
export const AXIS_PX = 10
export const AXIS_FONT = `${AXIS_PX}px ui-sans-serif, system-ui, sans-serif`

/** The air one word's strip keeps from the next. */
const STRIP_GAP = 1
/** The gap a label keeps from the axis line. */
const BASELINE_GAP = 6
/** The room below the axis line that the letters themselves need. */
const ASCENT = 4

let scratch: CanvasRenderingContext2D | null | undefined

function context(): CanvasRenderingContext2D | null {
  if (scratch === undefined) {
    try {
      scratch = typeof document === 'undefined' ? null : document.createElement('canvas').getContext('2d')
    } catch {
      scratch = null
    }
  }
  return scratch
}

/** How wide a word is on this engine. Where there is no canvas to ask (a test), a CJK glyph counts
 *  as a full square and a Latin letter as about half of one. */
export function measureLabel(text: string, font = AXIS_FONT): number {
  const g = context()
  if (g !== null) {
    g.font = font
    return g.measureText(text).width
  }
  return [...text].reduce((w, ch) => w + (ch.charCodeAt(0) > 0x2e80 ? 10 : 5.5), 0)
}

/** How deep a word's strip is: the ink two neighbors must not share. */
export function measureDepth(font = AXIS_FONT): number {
  const g = context()
  if (g !== null) {
    g.font = font
    const m = g.measureText('国Mg')
    const ink = m.actualBoundingBoxAscent + m.actualBoundingBoxDescent
    if (ink > 0) return ink
  }
  return 11
}

/** The tilt that names every bar: flat while each word fits the bar it stands on, 45° once a strip
 *  at 45° clears its neighbor, and straight up when even that is too close. */
export function tiltFor(labels: string[], slot: number, font = AXIS_FONT): number {  if (slot <= 0) return 0
  if (labels.every((text) => measureLabel(text, font) <= slot)) return 0
  const seat = (deg: number) => slot * Math.sin((deg * Math.PI) / 180) - measureDepth(font) - STRIP_GAP
  return seat(45) >= 0 ? 45 : 90
}

/** How far a word may run along its tilt before it reaches past the band the axis was given. */
export function wordRoom(band: number, deg: number): number {
  return (band - BASELINE_GAP - ASCENT) / Math.sin((deg * Math.PI) / 180)
}

/** The band the axis needs: the longest word's drop, cut to what the chart is willing to give. */
export function axisRoom(labels: string[], deg: number, band: number): number {
  const rad = (deg * Math.PI) / 180
  const longest = Math.max(0, ...labels.map((text) => measureLabel(text)))
  return Math.min(band, Math.ceil(longest * Math.sin(rad) + BASELINE_GAP + ASCENT))
}

/** Cut a word to `room` pixels, at a word end when one fits, and mark the cut. */
export function elide(text: string, room: number, font = AXIS_FONT): string {
  if (measureLabel(text, font) <= room) return text
  let kept = ''
  for (const ch of text) {
    if (measureLabel(kept + ch + '…', font) > room) break
    kept += ch
  }
  kept = kept.trimEnd()
  if (kept === '') return '…'
  const space = kept.lastIndexOf(' ')
  return (space > 0 ? kept.slice(0, space) : kept) + '…'
}

/** The words the axis draws, one per entry of `xs` (each word's tick in pixels from the axis's
 *  left): cut to the band it was given, and left off where a strip would overlap the one kept. */
export function axisWords(
  labels: string[],
  xs: number[],
  slot: number,
  deg: number,
  band: number,
  font = AXIS_FONT,
): string[] {
  const room = deg === 0 ? slot : wordRoom(band, deg)
  const words = labels.map((text) => (text === '' ? '' : elide(text, room, font)))
  if (deg === 0) return words
  const along = (measureDepth(font) + STRIP_GAP) / Math.sin((deg * Math.PI) / 180)
  let next = -Infinity
  return words.map((text, i) => {
    if (text === '') return ''
    if (xs[i] < next) return ''
    next = xs[i] + along
    return text
  })
}
