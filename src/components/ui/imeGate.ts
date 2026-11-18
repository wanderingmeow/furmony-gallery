// src/components/ui/imeGate.ts - reports whether the text in an input is finished with.
//
// A half-typed pinyin line is no question. iOS leaves uncommitted syllables in the field value,
// and moving through the candidate list rewrites that value with no keystroke behind it. Measured
// in Safari on iPhone: `compositionstart` and `compositionend` arrive once for a whole session,
// every keystroke arrives as `insertCompositionText`, and `isComposing` stays false on every
// `input` event. The state machine therefore reads `inputType`.
//
// Engines disagree about when these events arrive and about what they call them, so three rules
// keep the machine from depending on one engine's habits:
//
// - an `input` event with `isComposing` true keeps `ready()` false;
// - an `inputType` that names composition text keeps `ready()` false only while a composition is
//   open, because macOS Firefox sends the finished text a second time under that same name right
//   after `compositionend`, and that copy carries the finished question;
// - blur clears the flag that a missing `compositionend` would leave set.
//
// The gate holds no timer, so `ready()` costs no time. How long a field waits before it asks
// again belongs to that field: see the pause in SearchBar.tsx.

import { hasUncommittedText } from '../../model/composing'

export interface ImeGate {
  input(inputType: string, isComposing: boolean): void
  compositionStart(): void
  compositionEnd(): void
  /** The box lost focus: this is the way out when `compositionend` never arrives. */
  blur(): void
  /** The value changed by code, so no event will arrive: the clear button. */
  reset(): void
  /** Whether the box holds the text that the writer finished with. */
  ready(): boolean
}

/** Track the events that show whether a writer is still at work. `read` returns what the box
 *  holds when the field asks the question. */
export function makeImeGate(read: () => string): ImeGate {
  let composing = false
  return {
    input(inputType, isComposing) {
      // Syllables being put together, or taken back: nothing to ask yet. The flag is the clearest
      // signal, but iOS leaves it false for every event, so the event name is the only signal
      // while a composition is open.
      composing = isComposing
        || (composing && /^(insert|delete)CompositionText$/.test(inputType))
    },
    compositionStart() { composing = true },
    compositionEnd() { composing = false },
    blur() { composing = false },
    reset() { composing = false },
    ready() { return !composing && !hasUncommittedText(read()) },
  }
}
