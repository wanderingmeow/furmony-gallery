import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render } from 'solid-js/web'
import { SearchBar } from './SearchBar'
import { searchText, setSearchText } from '../../stores/filterStore'
import { setSemanticSearch } from '../../stores/displayStore'
import { setOnFilterChange } from '../../stores/filterStore'
const COMMIT_WAIT = 500

let disposeApp: () => void
let host: HTMLDivElement
let box: HTMLInputElement
let seenInputTypes: string[]
let api: { clear: () => void } | undefined

/** happy-dom, like Chromium, ignores `inputType` in the InputEvent constructor. */
function fireInput(value: string, inputType: string): void {
  box.value = value
  const ev = new InputEvent('input', { bubbles: true, cancelable: true, data: value })
  Object.defineProperty(ev, 'inputType', { get: () => inputType })
  Object.defineProperty(ev, 'isComposing', { get: () => false })
  box.dispatchEvent(ev)
}

/** One of the two events Safari on iPhone sends around a composition, measured on a real device. */
function fireComposition(type: 'compositionstart' | 'compositionend'): void {
  box.dispatchEvent(new Event(type, { bubbles: true }))
}

const settle = () => vi.advanceTimersByTimeAsync(COMMIT_WAIT + 50)

beforeEach(() => {
  vi.useFakeTimers()
  setSearchText('')
  host = document.createElement('div')
  document.body.appendChild(host)
  disposeApp = render(() => <SearchBar onApi={(a) => (api = a)} />, host)
  box = host.querySelector('input') as HTMLInputElement
  seenInputTypes = []
  box.addEventListener('input', (e) => seenInputTypes.push((e as InputEvent).inputType))
})

afterEach(() => {
  disposeApp()
  host.remove()
  setSemanticSearch(false)
  setOnFilterChange(null)
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

// imeGate.test.ts covers the gate's own rules; these cover the events the browser really sends.
describe('the search field', () => {
  it('holds every syllable back, then asks once with the committed text', async () => {
    fireComposition('compositionstart')
    let held = ''
    for (const syllable of ['cang', 'xue', 'lan']) {
      held = held === '' ? syllable : `${held}\u2006${syllable}`
      fireInput(held, 'insertCompositionText')
      await settle()
      expect(searchText()).toBe('')
      expect(box.value).toBe(held)
    }
    fireInput('苍雪蓝', 'insertFromComposition')
    fireComposition('compositionend')
    await settle()
    expect(searchText()).toBe('苍雪蓝')
    expect(seenInputTypes).toContain('insertCompositionText')
  })

  it('still asks as the user types without an IME', async () => {
    fireInput('蓝', 'insertText')
    await settle()
    expect(searchText()).toBe('蓝')
    fireInput('蓝色', 'insertText')
    await settle()
    expect(searchText()).toBe('蓝色')
  })

  it('brings the whole list back in the same frame as the edit that empties the box', async () => {
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

  it('brings the whole list back when a cut empties the box', async () => {
    fireInput('蓝色', 'insertText')
    await settle()
    fireInput('', 'deleteByCut')
    expect(searchText()).toBe('')
  })

  it('brings the whole list back when the user deletes the syllables', () => {
    setSearchText('苍雪')
    fireComposition('compositionstart')
    fireInput('lan', 'insertCompositionText')
    fireInput('', 'deleteCompositionText')
    expect(searchText()).toBe('')
  })

  it('hands the half-typed sentence to the store when the field leaves the screen', () => {
    fireInput('蓝色', 'insertText')
    disposeApp()
    disposeApp = () => {}
    expect(searchText()).toBe('蓝色')
  })

  it('keeps the previous query when the field leaves the screen mid-composition', () => {
    setSearchText('苍雪')
    fireComposition('compositionstart')
    fireInput('lan\u2006se', 'insertCompositionText')
    disposeApp()
    disposeApp = () => {}
    expect(searchText()).toBe('苍雪')
  })

  it('drops a pending commit when the user clears the box', async () => {
    fireInput('蓝色', 'insertText')
    api!.clear()
    await settle()
    expect(searchText()).toBe('')
  })

  it('commits the finished text on blur when compositionend never arrives', async () => {
    fireComposition('compositionstart')
    fireInput('lan\u2006se', 'insertCompositionText')
    // finished text, still arriving under the composition's event name
    fireInput('蓝色', 'insertCompositionText')
    box.dispatchEvent(new Event('blur'))
    await settle()
    expect(searchText()).toBe('蓝色')
  })

  it('keeps the previous query when blur lands mid-composition', async () => {
    setSearchText('苍雪')
    fireComposition('compositionstart')
    fireInput('lan\u2006se', 'insertCompositionText')
    box.dispatchEvent(new Event('blur'))
    await settle()
    expect(searchText()).toBe('苍雪')
  })

  it('shows the query that the store restores after the box is on screen', () => {
    setSearchText('苍雪蓝龙')
    expect(box.value).toBe('苍雪蓝龙')
  })

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

  it('rolls the examples in place of the hint while the enhanced search is on', () => {
    setSemanticSearch(true)
    const lines = host.querySelectorAll('[data-reel-line]')
    // every question, plus the first again where the loop restarts
    expect(lines).toHaveLength(8)
    expect(box.getAttribute('placeholder')).toBe('')
  })

  it('shows the plain hint when the enhanced search is off', () => {
    expect(host.querySelector('[data-reel]')).toBe(null)
    expect(box.getAttribute('placeholder')).toContain('ID')
  })

  it('gives the reel back to the hint as soon as the user types', async () => {
    setSemanticSearch(true)
    fireInput('蓝色的龙', 'insertText')
    expect(host.querySelector('[data-reel]')).toBe(null)
    expect(box.getAttribute('placeholder')).toContain('爱吃肉的棒小龙')
    await settle()
    expect(searchText()).toBe('蓝色的龙')
  })
})
