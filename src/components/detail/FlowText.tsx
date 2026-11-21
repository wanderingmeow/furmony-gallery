// src/components/detail/FlowText.tsx - the way in for a translated description: words blur in the
// order they are read, so the paragraph sweeps a line at a time. It does not ask where the lines
// break - the source wraps, and where it wraps depends on the width the row happens to have.
import { For, createMemo } from 'solid-js'
import './FlowText.css'

// The window all the starts share. The gap between two of them is the window divided by the number
// of units, so a long description takes no longer to sweep in than a short one.
export const SWEEP_MS = 500
// How long one unit's animation runs - the duration FlowText.css writes. Change one, change the
// other.
const RISE_MS = 500
// When the sweep is over: the last unit starts as the window closes, then runs for RISE_MS.
export const FLOW_OVER_MS = SWEEP_MS + RISE_MS
// Below this gap the sweep is one soft blur anyway, and each unit still costs a filter of its own.
const MIN_STEP_MS = 25
// So the window divided by that gap is the most units worth cutting a description into.
const MAX_UNITS = Math.ceil(SWEEP_MS / MIN_STEP_MS)

// ICU's segmentation: it cuts 简体中文 into words, leaves the spaces and the punctuation standing as
// units of their own, and keeps an emoji in one piece. Absent before Safari 14.1 and Firefox 126.
const segmenter = typeof Intl.Segmenter === 'function'
  ? new Intl.Segmenter(undefined, { granularity: 'word' })
  : undefined

/** The words of `text`, or nothing when this browser has no segmenter or loses a character with it. */
function wordsOf(text: string): string[] | null {
  if (!segmenter) return null
  const words = [...segmenter.segment(text)].map((part) => part.segment)
  return words.join('') === text ? words : null
}

/** `text` in runs of `size` code points, so an emoji is not torn in half on the way. */
function chunk(text: string, size: number): string[] {
  const chars = Array.from(text)
  const out: string[] = []
  for (let i = 0; i < chars.length; i += size) out.push(chars.slice(i, i + size).join(''))
  return out
}

/** What blurs in: the words the browser finds, or runs of a fixed length once there are too many of
 *  them to blur one by one. */
function unitsOf(text: string): string[] {
  const words = wordsOf(text)
  if (words && words.length <= MAX_UNITS) return words
  return chunk(text, Math.ceil(Array.from(text).length / MAX_UNITS))
}

export function FlowText(props: { text: string; flow: boolean }) {
  const groups = createMemo(() => unitsOf(props.text))
  // The gap between one start and the next.
  const step = () => (props.flow ? SWEEP_MS / Math.max(groups().length, 1) : 0)

  return (
    <p class="whitespace-pre-wrap" style={{ '--step': `${step().toFixed(2)}ms` }}>
      {props.flow ? (
        <For each={groups()}>{(group, i) => (
          <span class="flow-unit" style={{ '--i': i() }}>{group}</span>
        )}</For>
      ) : (
        // Not new: the untranslated original, shown as it is.
        props.text
      )}
    </p>
  )
}
