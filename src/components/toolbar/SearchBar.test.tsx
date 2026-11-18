import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render } from 'solid-js/web'
import { SearchBar } from './SearchBar'
import { searchText, setSearchText } from '../../stores/filterStore'
import { setSemanticSearch } from '../../stores/displayStore'
import { semanticPending } from '../../stores/semanticStore'
import { setOnFilterChange } from '../../stores/filterStore'
// imeGate.test.ts covers the gate's own rules. These cover the wiring between the browser and
// that gate, and the wait that the field keeps before it asks: a dropped `onCompositionEnd` would
// lock the gate, so the search would never receive the finished text. No desktop keyboard can
// produce that failure, and no store test can see it.
const COMMIT_WAIT = 500

let disposeApp: () => void
let host: HTMLDivElement
let box: HTMLInputElement
// The `inputType` of every event that reached the box. The `insertCompositionText` assertions
// below only mean something if the harness really reached that branch.
let seen: string[]

/** happy-dom, like Chromium, ignores `inputType` in the InputEvent constructor. */
function fireInput(value: string, inputType: string): void {
  box.value = value
  const ev = new InputEvent('input', { bubbles: true, cancelable: true, data: value })
  Object.defineProperty(ev, 'inputType', { get: () => inputType })
  Object.defineProperty(ev, 'isComposing', { get: () => false })
  box.dispatchEvent(ev)
}

/** One of the two events that Safari on iPhone sends around a composition, measured on a
 * real device. */
function fireComposition(type: 'compositionstart' | 'compositionend'): void {
  box.dispatchEvent(new Event(type, { bubbles: true }))
}

const settle = () => vi.advanceTimersByTimeAsync(COMMIT_WAIT + 50)

// The mark follows `semanticPending`, so the pulse tests need a request that they answer by hand.
// The enhanced search switch is module state, so afterEach turns it off again.
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
  setOnFilterChange(null)
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
      // The gate holds back the query, and the typing still reaches the box.
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

  // Emptying the box in one edit arrives as a single `input` event. The names fired below are the
  // browser's own, whatever the keyboard did. An empty box holds no unfinished text, so the wait is
  // dropped: the store takes the answer in the same frame, and the list moves with it.
  it('brings the whole list back as soon as the box goes empty', async () => {
    const kinds: string[] = []
    setOnFilterChange((kind) => kinds.push(kind))
    fireInput('蓝色', 'insertText')
    await settle()
    expect(searchText()).toBe('蓝色')
    kinds.length = 0
    fireInput('', 'deleteContentBackward')
    expect(searchText()).toBe('')
    expect(kinds).toEqual(['search'])
  })

  // Cutting the text out arrives the same way, under another event name. Nothing here reads it.
  it('brings the whole list back when a cut empties the box', async () => {
    fireInput('蓝色', 'insertText')
    await settle()
    fireInput('', 'deleteByCut')
    expect(searchText()).toBe('')
  })

  // The same edit with syllables in the box: they went with the rest of it, so there is nothing
  // left for the gate to hold. The list comes back at once, and a `compositionend` that would only
  // repeat this can arrive later or not at all.
  it('brings the whole list back when the reader deletes the syllables', () => {
    setSearchText('苍雪')
    fireComposition('compositionstart')
    fireInput('lan', 'insertCompositionText')
    fireInput('', 'deleteCompositionText')
    expect(searchText()).toBe('')
  })

  // A tap on 图片 comes a moment after typing, and the field leaves the screen with a commit still
  // in the air. That sentence is the one the reader asked for.
  it('hands the sentence to the store when the field leaves the screen', () => {
    fireInput('蓝色', 'insertText')
    disposeApp()
    disposeApp = () => {}
    expect(searchText()).toBe('蓝色')
  })

  // The same exit mid-composition: syllables are no question, so the store keeps the query that
  // the reader asked before.
  it('hands nothing but syllables back when the field leaves the screen', () => {
    setSearchText('苍雪')
    fireComposition('compositionstart')
    fireInput('lan\u2006se', 'insertCompositionText')
    disposeApp()
    disposeApp = () => {}
    expect(searchText()).toBe('苍雪')
  })

  it('drops a pending commit when the reader clears the box', async () => {
    fireInput('蓝色', 'insertText')
    const clear = host.querySelector('[aria-label="清除搜索"]') as HTMLButtonElement
    clear.click()
    await settle()
    expect(searchText()).toBe('')
  })

  // A lost compositionend would otherwise lock the gate for the rest of the visit. Leaving
  // the box passes on the text that the reader finished with.
  it('commits the finished text on blur when compositionend never arrives', async () => {
    fireComposition('compositionstart')
    fireInput('lan\u2006se', 'insertCompositionText')
    fireInput('蓝色', 'insertCompositionText')   // committed, but the end event never came
    box.dispatchEvent(new Event('blur'))
    await settle()
    expect(searchText()).toBe('蓝色')
  })

  // The same hatch with syllables still in the box: that is not a question, so the search
  // keeps the query that the reader asked before.
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
  })

  // A sentence that the service already answered comes back from the cache with no request, so
  // this test uses a different sentence and leaves it unanswered.
  it('keeps pulsing while a query is still in flight', async () => {
    setSemanticSearch(true)
    setSearchText('白色的猫')
    await settle()
    const glyph = host.querySelector('.search-field span') as HTMLSpanElement
    glyph.dispatchEvent(new Event('animationiteration'))
    expect(glyph.className).toContain('spark-pulse')
  })

  // The animation supplies the accent now, so the resting class has to stay on the element.
  // Without it the mark would fall back to the browser's default color when the answer lands.
  it('keeps the resting color on the mark while it pulses', async () => {
    setSemanticSearch(true)
    setSearchText('黑色的龙')
    await settle()
    const glyph = host.querySelector('.search-field span') as HTMLSpanElement
    expect(glyph.className).toContain('spark-pulse')
    expect(glyph.className).toContain('text-faint')
    glyph.dispatchEvent(new Event('animationiteration'))
    expect(glyph.className).not.toContain('spark-pulse')
    expect(glyph.className).toContain('text-faint')
  })

  // A reload hands the saved query to the store while the box is already on screen. The bar used
  // to appear only after that restore finished, so reading the store once was enough.
  it('shows the query that the store restores after the box is on screen', () => {
    setSearchText('苍雪蓝龙')
    expect(box.value).toBe('苍雪蓝龙')
  })

  // That restore can land while a commit is still in the air. The effect resets the gate, so the
  // restore resets the list once and nothing resets it a moment later.
  it('drops the commit it holds when the store brings another query', async () => {
    const kinds: string[] = []
    setOnFilterChange((kind) => kinds.push(kind))
    fireInput('蓝色', 'insertText')
    setSearchText('苍雪')
    await settle()
    expect(searchText()).toBe('苍雪')
    expect(box.value).toBe('苍雪')
    expect(kinds).toEqual(['search'])
  })
})
