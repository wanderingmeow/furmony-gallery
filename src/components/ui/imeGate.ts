// src/components/ui/imeGate.ts - decides when the text in an input is a query.
//
// A half-typed pinyin line is not a question: iOS keeps the syllables a writer has not
// committed in the field value, and browsing candidates rewrite it with no keystroke at
// all. Measured in Safari on iPhone, `compositionstart` and `compositionend` arrive once
// around a whole session, every keystroke arrives as `insertCompositionText`, and
// `isComposing` stays false on every `input` event. The state machine therefore reads
// `inputType`. This is the one guard: nothing else in the app accepts text that the writer
// has not finished with.
//
// Engines disagree about when these events arrive and about what they call them, so three
// rules keep the machine from depending on any one engine's habits. The gate reads the value
// when its wait ends. An engine that sends `compositionend` before the text is in the box
// still commits the finished text. An `input` event with `isComposing` true always holds the
// box. An `inputType` that names composition text holds the box only while a composition is
// open: macOS Firefox sends the finished text again under that same name right after
// `compositionend`, and that second copy carries the finished question.

import { hasUncommittedText } from '../../model/composing'

/** How long a pause counts as finished typing. */
const COMMIT_WAIT = 500

export interface ImeGate {
  input(inputType: string, isComposing: boolean): void
  compositionStart(): void
  compositionEnd(): void
  /** The box lost focus: this is the way out when `compositionend` never arrives. */
  blur(): void
  /** The value changed by code, so no event will arrive: the clear button. */
  reset(): void
  dispose(): void
}

/**
 * Watch one input and call `commit` with the text that the writer has finished. `read` returns
 * what the box holds at the moment it is called, and the gate calls it when the wait ends.
 */
export function makeImeGate(commit: (value: string) => void, read: () => string): ImeGate {
  let composing = false
  let timer: ReturnType<typeof setTimeout> | null = null

  const cancel = (): void => {
    if (timer !== null) {
      clearTimeout(timer)
      timer = null
    }
  }
  const schedule = (): void => {
    cancel()
    timer = setTimeout(() => {
      timer = null
      // The escape hatches - blur and a lost compositionend - pass on whatever the box
      // holds, and that can still be syllables. Then the previous query stays.
      const value = read()
      if (!composing && !hasUncommittedText(value)) commit(value)
    }, COMMIT_WAIT)
  }

  return {
    input(inputType, isComposing) {
      // Syllables being put together, or taken back: nothing to ask yet. The flag is the
      // clearest signal, but iOS leaves it false for every event, so the event name is the
      // only signal while a composition is open. Once the composition has closed, the name
      // alone is not enough: macOS Firefox sends the finished text a second time under
      // `insertCompositionText` after `compositionend`, and holding the box on that copy
      // would ask nothing forever.
      if (isComposing || (composing && /^(insert|delete)CompositionText$/.test(inputType))) {
        composing = true
        cancel()
        return
      }
      // Text that is no longer being put together: the committed characters, an ordinary key,
      // or a backspace. Any of them can hold the finished sentence, so each one starts the
      // wait, and one that follows a composition also covers a `compositionend` that never
      // came.
      composing = false
      schedule()
    },

    compositionStart() {
      composing = true
      cancel()
    },

    compositionEnd() {
      composing = false
      schedule()
    },

    blur() {
      if (!composing) return
      composing = false
      schedule()
    },

    reset() {
      composing = false
      cancel()
    },

    dispose: cancel,
  }
}
