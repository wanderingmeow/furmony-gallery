import { beforeEach, describe, expect, it, vi } from 'vitest'
import { makeImeGate, type ImeGate } from './imeGate'

// The space an iOS pinyin field puts between syllables the writer has not committed.
const SP = '\u2006'

let committed: string[] = []
let gate: ImeGate

beforeEach(() => {
  vi.useFakeTimers()
  committed = []
  gate = makeImeGate((value) => committed.push(value))
})

/** Type one pinyin session, pausing long enough that a plain debounce would have asked twice.
 *  The events are the ones Safari on iPhone sends, in the order it sends them. */
function typePinyin(syllables: string[], committedText: string): void {
  gate.compositionStart()
  let held = ''
  for (const syllable of syllables) {
    held = held === '' ? syllable : `${held}${SP}${syllable}`
    gate.input(held, 'insertCompositionText', false)
    vi.advanceTimersByTime(500)
  }
  // Browsing candidates rewrites the value with no keystroke behind it.
  gate.input(`蓝${SP}眼`, 'insertCompositionText', false)
  vi.advanceTimersByTime(500)
  // The commit: the candidate text, the deletion, the committed text, then the end.
  gate.input(committedText, 'insertCompositionText', false)
  gate.input('', 'deleteCompositionText', false)
  gate.input(committedText, 'insertFromComposition', false)
  gate.compositionEnd(committedText)
}

describe('imeGate', () => {
  it('commits plain typing once the pause is long enough', () => {
    gate.input('蓝', 'insertText', false)
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
    gate.input('blue', 'insertText', false)
    vi.advanceTimersByTime(300)
    gate.input('blue cat', 'insertText', false)
    vi.advanceTimersByTime(500)
    expect(committed).toEqual(['blue cat'])
  })

  it('commits a plain edit that follows a committed query', () => {
    gate.input('苍雪蓝眼睛', 'insertFromComposition', false)
    gate.compositionEnd('苍雪蓝眼睛')
    vi.advanceTimersByTime(500)
    gate.input('苍雪蓝眼', 'deleteContentBackward', false)
    vi.advanceTimersByTime(500)
    expect(committed).toEqual(['苍雪蓝眼睛', '苍雪蓝眼'])
  })

  // An engine that reports no input type at all: the flag is all it gives.
  it('falls back to the composing flag when the input type is missing', () => {
    gate.input('か', '', true)
    vi.advanceTimersByTime(500)
    expect(committed).toEqual([])
    gate.input('猫', '', false)
    vi.advanceTimersByTime(500)
    expect(committed).toEqual(['猫'])
  })

  // A compositionend that never arrives must not hold the box shut for good.
  it('recovers on blur when compositionend never arrives', () => {
    gate.compositionStart()
    gate.input('lan\u2006se', 'insertCompositionText', false)
    gate.blur('蓝色')
    vi.advanceTimersByTime(500)
    expect(committed).toEqual(['蓝色'])
  })

  // blur passes on whatever the box holds, and mid-composition that is still syllables.
  it('keeps the previous query when blur lands mid-composition', () => {
    gate.compositionStart()
    gate.input('lan\u2006se', 'insertCompositionText', false)
    gate.blur('lan\u2006se')
    vi.advanceTimersByTime(500)
    expect(committed).toEqual([])
  })

  it('recovers on a plain edit when compositionend never arrives', () => {
    gate.compositionStart()
    gate.input('lan\u2006se', 'insertCompositionText', false)
    gate.input('蓝色de', 'insertText', false)
    vi.advanceTimersByTime(500)
    expect(committed).toEqual(['蓝色de'])
  })

  it('drops a pending commit when the box is cleared by code', () => {
    gate.input('蓝色', 'insertText', false)
    gate.reset()
    vi.advanceTimersByTime(500)
    expect(committed).toEqual([])
  })

  it('drops a pending commit when the box goes away', () => {
    gate.input('蓝色', 'insertText', false)
    gate.dispose()
    vi.advanceTimersByTime(500)
    expect(committed).toEqual([])
  })
})
