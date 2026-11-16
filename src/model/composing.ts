// src/model/composing.ts - text an IME has not committed yet.
//
// iOS leaves uncommitted syllables in the field value, split by U+2006: `cang xue lan`
// arrives as `cang␆xue␆lan`. Measured in Safari on iPhone.

const COMPOSING_SPACE = '\u2006'

export function hasUncommittedText(text: string): boolean {
  return text.includes(COMPOSING_SPACE)
}
