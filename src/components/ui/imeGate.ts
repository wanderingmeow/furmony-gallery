// src/components/ui/imeGate.ts - decides when the text in an input is a query.
//
// A half-typed pinyin line is not a question: iOS keeps the syllables a writer has not
// committed in the field value, and browsing candidates rewrite it with no keystroke at
// all. Measured in Safari on iPhone, `compositionstart` and `compositionend` arrive once
// around a whole session, every keystroke arrives as `insertCompositionText`, and
// `isComposing` stays false on every `input` event. The state machine therefore reads
// `inputType`. This is the one guard: nothing else in the app accepts text that the writer
// has not finished with.

import { hasUncommittedText } from '../../model/composing'

/** How long a pause counts as finished typing. */
const COMMIT_WAIT = 500

export interface ImeGate {
  input(value: string, inputType: string, isComposing: boolean): void
  compositionStart(): void
  compositionEnd(value: string): void
  /** The box lost focus: this is the way out when `compositionend` never arrives. */
  blur(value: string): void
  /** The value changed by code, so no event will arrive: the clear button. */
  reset(): void
  dispose(): void
}

/** Watch one input and call `commit` with text the writer has finished. */
export function makeImeGate(commit: (value: string) => void): ImeGate {
  let composing = false
  let timer: ReturnType<typeof setTimeout> | null = null

  const cancel = (): void => {
    if (timer !== null) {
      clearTimeout(timer)
      timer = null
    }
  }
  const schedule = (value: string): void => {
    cancel()
    timer = setTimeout(() => {
      timer = null
      // The escape hatches - blur and a lost compositionend - pass on whatever the box
      // holds, and that can still be syllables. Then the previous query stays.
      if (!composing && !hasUncommittedText(value)) commit(value)
    }, COMMIT_WAIT)
  }

  return {
    input(value, inputType, isComposing) {
      // Syllables being put together, or taken back: nothing to ask yet.
      if (/^(insert|delete)CompositionText$/.test(inputType)) {
        composing = true
        cancel()
        return
      }
      // The committed text. Safari sends this a few milliseconds before `compositionend`,
      // which is the one that schedules.
      if (inputType === 'insertFromComposition') return
      if (inputType === '') {
        // An engine that reports no input type. For one that gives nothing else, the flag
        // turning false is the only signal that composition ended.
        if (isComposing) {
          composing = true
          cancel()
        } else {
          composing = false
          schedule(value)
        }
        return
      }
      // A plain edit. After a composition it means the IME has let go of the box, so it
      // also recovers from a `compositionend` that never arrived.
      composing = false
      schedule(value)
    },

    compositionStart() {
      composing = true
      cancel()
    },

    compositionEnd(value) {
      composing = false
      schedule(value)
    },

    blur(value) {
      if (!composing) return
      composing = false
      schedule(value)
    },

    reset() {
      composing = false
      cancel()
    },

    dispose: cancel,
  }
}
