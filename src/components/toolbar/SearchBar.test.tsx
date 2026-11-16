import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render } from 'solid-js/web'
import { SearchBar } from './SearchBar'
import { searchText, setSearchText } from '../../stores/filterStore'

// The gate's own rules are covered in ../ui/imeGate.test.ts. These cover the wiring between
// the browser and that gate: a dropped `onCompositionEnd` would leave the gate locked, so the
// box would show every keystroke and the search would never receive one of them - a failure
// that no desktop keyboard can produce, and that no store test can see.
const COMMIT_WAIT = 500

let disposeApp: () => void
let host: HTMLDivElement
let box: HTMLInputElement
// What the component received: the `insertCompositionText` assertions below depend on the
// harness reaching that branch.
let seen: string[]

/** happy-dom, like Chromium, ignores `inputType` in the InputEvent constructor. */
function fireInput(value: string, inputType: string): void {
  box.value = value
  const ev = new InputEvent('input', { bubbles: true, cancelable: true, data: value })
  Object.defineProperty(ev, 'inputType', { get: () => inputType })
  Object.defineProperty(ev, 'isComposing', { get: () => false })
  box.dispatchEvent(ev)
}

/** The order Safari on iPhone sends, measured on a real device. */
function fireComposition(type: 'compositionstart' | 'compositionend'): void {
  box.dispatchEvent(new Event(type, { bubbles: true }))
}

const settle = () => vi.advanceTimersByTimeAsync(COMMIT_WAIT + 50)

beforeEach(() => {
  vi.useFakeTimers()
  setSearchText('')
  host = document.createElement('div')
  document.body.appendChild(host)
  disposeApp = render(() => <SearchBar />, host)
  box = host.querySelector('.search-field input') as HTMLInputElement
  seen = []
  box.addEventListener('input', (e) => seen.push((e as InputEvent).inputType))
})

afterEach(() => {
  disposeApp()
  host.remove()
  vi.useRealTimers()
})

describe('the search box', () => {
  it('holds every syllable back, then asks once with the committed text', async () => {
    fireComposition('compositionstart')
    let held = ''
    for (const syllable of ['cang', 'xue', 'lan']) {
      held = held === '' ? syllable : `${held}\u2006${syllable}`
      fireInput(held, 'insertCompositionText')
      await settle()
      expect(searchText()).toBe('')
      // The box follows every keystroke: the gate holds back the query, not the typing.
      expect(box.value).toBe(held)
    }
    fireInput('苍雪蓝', 'insertFromComposition')
    fireComposition('compositionend')
    await settle()
    expect(searchText()).toBe('苍雪蓝')
    expect(seen).toContain('insertCompositionText')
  })

  it('still asks as the reader types without an IME', async () => {
    fireInput('蓝', 'insertText')
    await settle()
    expect(searchText()).toBe('蓝')
    fireInput('蓝色', 'insertText')
    await settle()
    expect(searchText()).toBe('蓝色')
  })

  it('drops a pending commit when the reader clears the box', async () => {
    fireInput('蓝色', 'insertText')
    const clear = host.querySelector('[aria-label="清除搜索"]') as HTMLButtonElement
    clear.click()
    await settle()
    expect(searchText()).toBe('')
  })

  // A lost compositionend would otherwise lock the gate for the rest of the visit. Leaving
  // the box passes on the text the reader finished with.
  it('commits the finished text on blur when compositionend never arrives', async () => {
    fireComposition('compositionstart')
    fireInput('lan\u2006se', 'insertCompositionText')
    fireInput('蓝色', 'insertCompositionText')   // committed, but the end event never came
    box.dispatchEvent(new Event('blur'))
    await settle()
    expect(searchText()).toBe('蓝色')
  })

  // The same hatch with syllables still in the box: that is not a question, so the search
  // keeps the query the reader asked before.
  it('keeps the previous query when blur lands mid-composition', async () => {
    setSearchText('苍雪')
    fireComposition('compositionstart')
    fireInput('lan\u2006se', 'insertCompositionText')
    box.dispatchEvent(new Event('blur'))
    await settle()
    expect(searchText()).toBe('苍雪')
  })
})
