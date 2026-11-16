import { beforeEach, describe, expect, it, vi } from 'vitest'
import { makeImeGate, type ImeGate } from './imeGate'

// The space an iOS pinyin field puts between syllables the writer has not committed.
const SP = '\u2006'

let committed: string[] = []
let box = ''
let gate: ImeGate

beforeEach(() => {
  vi.useFakeTimers()
  committed = []
  box = ''
  gate = makeImeGate(
    (value) => committed.push(value),
    () => box,
  )
})

/** The engine put `value` in the box and reported this input event. */
function edit(value: string, inputType: string, isComposing = false): void {
  box = value
  gate.input(inputType, isComposing)
}

/** Type one pinyin session, pausing long enough that a plain debounce would have asked twice.
 *  The events are the ones Safari on iPhone sends, in the order it sends them. */
function typePinyin(syllables: string[], committedText: string): void {
  gate.compositionStart()
  let held = ''
  for (const syllable of syllables) {
    held = held === '' ? syllable : `${held}${SP}${syllable}`
    edit(held, 'insertCompositionText')
    vi.advanceTimersByTime(500)
  }
  // Browsing candidates rewrites the value with no keystroke behind it.
  edit(`蓝${SP}眼`, 'insertCompositionText')
  vi.advanceTimersByTime(500)
  // The commit: the candidate text, the deletion, the committed text, then the end.
  edit(committedText, 'insertCompositionText')
  edit('', 'deleteCompositionText')
  edit(committedText, 'insertFromComposition')
  gate.compositionEnd()
}

describe('imeGate', () => {
  it('commits plain typing once the pause is long enough', () => {
    edit('蓝', 'insertText')
    vi.advanceTimersByTime(499)
    expect(committed).toEqual([])
    vi.advanceTimersByTime(1)
    expect(committed).toEqual(['蓝'])
  })

  it('asks nothing while the syllables are still going, and asks once at the end', () => {
    typePinyin(['cang', 'xue', 'lan', 'yan', 'jing'], '苍雪蓝眼睛')
    expect(committed).toEqual([])
    vi.advanceTimersByTime(500)
    expect(committed).toEqual(['苍雪蓝眼睛'])
  })

  it('keeps one commit per pause: the last value wins', () => {
    edit('blue', 'insertText')
    vi.advanceTimersByTime(300)
    edit('blue cat', 'insertText')
    vi.advanceTimersByTime(500)
    expect(committed).toEqual(['blue cat'])
  })

  it('commits a plain edit that follows a committed query', () => {
    edit('苍雪蓝眼睛', 'insertFromComposition')
    gate.compositionEnd()
    vi.advanceTimersByTime(500)
    edit('苍雪蓝眼', 'deleteContentBackward')
    vi.advanceTimersByTime(500)
    expect(committed).toEqual(['苍雪蓝眼睛', '苍雪蓝眼'])
  })

  // Firefox sends the last input after compositionend, while Chrome and the spec send it before
  // (w3c/uievents#202). Reading the box when the wait ends means the order costs nothing.
  it('commits when compositionend arrives before the text does', () => {
    gate.compositionStart()
    edit(`lan${SP}se`, 'insertCompositionText')
    gate.compositionEnd() // the box still holds lan␆se at this point
    vi.advanceTimersByTime(2)
    edit('蓝色', 'insertFromComposition')
    vi.advanceTimersByTime(500)
    expect(committed).toEqual(['蓝色'])
  })

  // The spec order puts that last input inside the composition, where the flag is true.
  it('commits when the last input arrives inside the composition', () => {
    gate.compositionStart()
    edit(`lan${SP}se`, 'insertCompositionText')
    edit('蓝色', 'insertFromComposition', true)
    gate.compositionEnd()
    vi.advanceTimersByTime(500)
    expect(committed).toEqual(['蓝色'])
  })

  // Measured on macOS Firefox with the system pinyin keyboard. When you pick a candidate, Firefox
  // sends the finished text twice: once inside the composition, then again after compositionend,
  // and the second one still arrives as insertCompositionText. Only the flag shows that the box
  // is free.
  it('commits the text Firefox sends after compositionend', () => {
    gate.compositionStart()
    edit(`cang${SP}xue`, 'insertCompositionText', true)
    edit('苍雪蓝眼睛', 'insertCompositionText', true)
    gate.compositionEnd()
    edit('苍雪蓝眼睛', 'insertCompositionText', false)
    vi.advanceTimersByTime(500)
    expect(committed).toEqual(['苍雪蓝眼睛'])
  })

  // Firefox separates the syllables with a plain space, so the marker in hasUncommittedText
  // cannot catch them: the state machine is what holds these back.
  it('holds the syllables Firefox separates with plain spaces', () => {
    gate.compositionStart()
    edit('cang xue lan', 'insertCompositionText', true)
    edit('苍xue lan yan jing', 'insertCompositionText', true)
    vi.advanceTimersByTime(1000)
    expect(committed).toEqual([])
  })

  // An engine that reports no input type at all: the flag is all it gives.
  it('falls back to the composing flag when the input type is missing', () => {
    edit('か', '', true)
    vi.advanceTimersByTime(500)
    expect(committed).toEqual([])
    edit('猫', '', false)
    vi.advanceTimersByTime(500)
    expect(committed).toEqual(['猫'])
  })

  // A compositionend that never arrives must not hold the box shut for good.
  it('recovers on blur when compositionend never arrives', () => {
    gate.compositionStart()
    edit(`lan${SP}se`, 'insertCompositionText')
    edit('蓝色', 'insertCompositionText') // on screen, but no end event
    gate.blur()
    vi.advanceTimersByTime(500)
    expect(committed).toEqual(['蓝色'])
  })

  // blur passes on whatever the box holds, and mid-composition that is still syllables.
  it('keeps the previous query when blur lands mid-composition', () => {
    gate.compositionStart()
    edit(`lan${SP}se`, 'insertCompositionText')
    gate.blur()
    vi.advanceTimersByTime(500)
    expect(committed).toEqual([])
  })

  it('recovers on a plain edit when compositionend never arrives', () => {
    gate.compositionStart()
    edit(`lan${SP}se`, 'insertCompositionText')
    edit('蓝色de', 'insertText')
    vi.advanceTimersByTime(500)
    expect(committed).toEqual(['蓝色de'])
  })

  it('drops a pending commit when the box is cleared by code', () => {
    edit('蓝色', 'insertText')
    gate.reset()
    vi.advanceTimersByTime(500)
    expect(committed).toEqual([])
  })

  it('drops a pending commit when the box goes away', () => {
    edit('蓝色', 'insertText')
    gate.dispose()
    vi.advanceTimersByTime(500)
    expect(committed).toEqual([])
  })
})
