import { beforeEach, describe, expect, it } from 'vitest'
import { makeImeGate, type ImeGate } from './imeGate'

// The space an iOS pinyin field puts between syllables the writer has not committed.
const SP = '\u2006'

let box = ''
let gate: ImeGate

beforeEach(() => {
  box = ''
  gate = makeImeGate(() => box)
})

/** The engine put `value` in the box and reported this input event. */
function edit(value: string, inputType: string, isComposing = false): void {
  box = value
  gate.input(inputType, isComposing)
}

/** One pinyin session, in the order Safari on iPhone sends it. */
function typePinyin(syllables: string[], committedText: string): void {
  gate.compositionStart()
  let held = ''
  for (const syllable of syllables) {
    held = held === '' ? syllable : `${held}${SP}${syllable}`
    edit(held, 'insertCompositionText')
    expect(gate.ready()).toBe(false)
  }
  // Browsing candidates rewrites the value with no keystroke behind it.
  edit(`蓝${SP}眼`, 'insertCompositionText')
  // The commit: the candidate text, the deletion, the committed text, then the end.
  edit(committedText, 'insertCompositionText')
  edit('', 'deleteCompositionText')
  edit(committedText, 'insertFromComposition')
  gate.compositionEnd()
}

describe('imeGate', () => {
  it('reads plain typing as finished text', () => {
    edit('蓝', 'insertText')
    expect(gate.ready()).toBe(true)
  })

  it('holds every syllable and frees the box once at the end', () => {
    typePinyin(['cang', 'xue', 'lan', 'yan', 'jing'], '苍雪蓝眼睛')
    expect(gate.ready()).toBe(true)
    expect(box).toBe('苍雪蓝眼睛')
  })

  it('holds a value that still carries syllables', () => {
    edit(`lan${SP}se`, 'insertText')
    expect(gate.ready()).toBe(false)
  })

  // Firefox sends the last input after compositionend, while Chrome and the spec send it before
  // (w3c/uievents#202). The gate answers at the moment the field asks, so the order costs nothing.
  it('is ready when compositionend arrives before the text does', () => {
    gate.compositionStart()
    edit(`lan${SP}se`, 'insertCompositionText')
    gate.compositionEnd()
    expect(gate.ready()).toBe(false) // the box still holds lan␆se at this point
    edit('蓝色', 'insertFromComposition')
    expect(gate.ready()).toBe(true)
  })

  // The spec order puts that last input inside the composition, where the flag is true.
  it('is ready when the last input arrives inside the composition', () => {
    gate.compositionStart()
    edit(`lan${SP}se`, 'insertCompositionText')
    edit('蓝色', 'insertFromComposition', true)
    expect(gate.ready()).toBe(false)
    gate.compositionEnd()
    expect(gate.ready()).toBe(true)
  })

  // Measured on macOS Firefox with the system pinyin keyboard. When you pick a candidate, Firefox
  // sends the finished text twice: once inside the composition, then again after compositionend,
  // and the second one still arrives as insertCompositionText. Only the flag shows that the box
  // is free.
  it('is ready for the text Firefox sends after compositionend', () => {
    gate.compositionStart()
    edit(`cang${SP}xue`, 'insertCompositionText', true)
    edit('苍雪蓝眼睛', 'insertCompositionText', true)
    gate.compositionEnd()
    edit('苍雪蓝眼睛', 'insertCompositionText', false)
    expect(gate.ready()).toBe(true)
  })

  // Firefox separates the syllables with a plain space, so the marker in hasUncommittedText
  // cannot catch them: the state machine is what holds these back.
  it('holds the syllables Firefox separates with plain spaces', () => {
    gate.compositionStart()
    edit('cang xue lan', 'insertCompositionText', true)
    edit('苍xue lan yan jing', 'insertCompositionText', true)
    expect(gate.ready()).toBe(false)
  })

  // An engine that reports no input type at all: the flag is all it gives.
  it('falls back to the composing flag when the input type is missing', () => {
    edit('か', '', true)
    expect(gate.ready()).toBe(false)
    edit('猫', '', false)
    expect(gate.ready()).toBe(true)
  })

  // A compositionend that never arrives must not hold the box shut for good.
  it('recovers on blur when compositionend never arrives', () => {
    gate.compositionStart()
    edit(`lan${SP}se`, 'insertCompositionText')
    edit('蓝色', 'insertCompositionText') // on screen, but no end event
    gate.blur()
    expect(gate.ready()).toBe(true)
  })

  // Blur clears the composing flag, and mid-composition the box still holds syllables.
  it('holds the syllables that blur leaves in the box', () => {
    gate.compositionStart()
    edit(`lan${SP}se`, 'insertCompositionText')
    gate.blur()
    expect(gate.ready()).toBe(false)
  })

  it('recovers on a plain edit when compositionend never arrives', () => {
    gate.compositionStart()
    edit(`lan${SP}se`, 'insertCompositionText')
    edit('蓝色de', 'insertText')
    expect(gate.ready()).toBe(true)
  })

  it('forgets the composition when code changes the value', () => {
    gate.compositionStart()
    edit(`lan${SP}se`, 'insertCompositionText')
    gate.reset()
    box = '蓝色'
    expect(gate.ready()).toBe(true)
  })
})
