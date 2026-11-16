import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render } from 'solid-js/web'
import { SearchBar } from './SearchBar'
import { searchText, setSearchText } from '../../stores/filterStore'
import { setSemanticSearch } from '../../stores/displayStore'
import { semanticPending } from '../../store'

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

// The mark follows `semanticPending`, so those two tests need a request that they answer by
// hand. The enhanced search switch is module state, so each test turns it back off again.
let answer: (body: unknown) => void = () => {}

beforeEach(() => {
  vi.useFakeTimers()
  setSearchText('')
  host = document.createElement('div')
  document.body.appendChild(host)
  disposeApp = render(() => <SearchBar />, host)
  box = host.querySelector('.search-field input') as HTMLInputElement
  seen = []
  box.addEventListener('input', (e) => seen.push((e as InputEvent).inputType))
  vi.stubGlobal('fetch', () => new Promise<Response>((resolve) => {
    answer = (body) => resolve(new Response(JSON.stringify(body)))
  }))
})

afterEach(() => {
  disposeApp()
  host.remove()
  setSemanticSearch(false)
  vi.unstubAllGlobals()
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

  // An answer usually arrives in the middle of a pulse. Stopping the animation there makes the
  // opacity jump back to full in one frame, so the mark finishes the pulse first and only then
  // goes back to faint. The pulse itself is CSS; this covers the wiring that waits for it.
  it('finishes the pulse before the mark goes back to faint', async () => {
    setSemanticSearch(true)
    setSearchText('黑色的龙')
    await settle()
    const glyph = host.querySelector('.search-field span') as HTMLSpanElement
    expect(glyph.className).toContain('spark-pulse')
    answer({ ids: [2871] })
    await settle()
    expect(semanticPending()).toBe(false)
    expect(glyph.className).toContain('spark-pulse')
    glyph.dispatchEvent(new Event('animationiteration'))
    expect(glyph.className).not.toContain('spark-pulse')
    setSemanticSearch(false)
  })

  // A sentence that the service already answered comes back from the cache with no request, so
  // this test uses a different sentence and leaves it unanswered.
  it('keeps pulsing while the next query is still in flight', async () => {
    setSemanticSearch(true)
    setSearchText('白色的猫')
    await settle()
    const glyph = host.querySelector('.search-field span') as HTMLSpanElement
    glyph.dispatchEvent(new Event('animationiteration'))
    expect(glyph.className).toContain('spark-pulse')
    setSemanticSearch(false)
  })
})
