// FlowText: how a translated description arrives - words coming out of a blur in reading order, or
// plainly when the words are not new.
import { afterEach, describe, expect, it } from 'vitest'
import { createSignal } from 'solid-js'
import { render } from 'solid-js/web'
import { FlowText, SWEEP_MS } from './FlowText'

let dispose: (() => void) | undefined
let host: HTMLDivElement
const [text, setText] = createSignal('')
const [flow, setFlow] = createSignal(false)

function draw(): void {
  host = document.createElement('div')
  document.body.append(host)
  dispose = render(() => <FlowText text={text()} flow={flow()} />, host)
}

const box = () => host.firstElementChild as HTMLElement
const units = () => [...host.querySelectorAll<HTMLSpanElement>('.flow-unit')]

afterEach(() => {
  dispose?.()
  host?.remove()
})

describe('FlowText', () => {
  it('hands words that are not new straight through', () => {
    setText('领养费 27800')
    setFlow(false)
    draw()
    expect(units(), 'nothing to announce').toHaveLength(0)
    expect(host.textContent).toBe('领养费 27800')
  })

  it('brings a translation in a word at a time, in reading order', () => {
    setText('这只兽设支持分期领养。')
    setFlow(true)
    draw()
    const all = units().map((el) => el.textContent!)
    expect(all.length, 'the browser cuts 简体中文 into words').toBeGreaterThan(1)
    expect(all.join(''), 'the paragraph is still one run of words').toBe('这只兽设支持分期领养。')
    expect(units().map((el) => el.style.getPropertyValue('--i'))).toEqual(all.map((_, i) => String(i)))
  })

  it('spreads the starts over one fixed window, whatever the length', () => {
    setText('这只兽设支持分期领养。')
    setFlow(true)
    draw()
    expect(box().style.getPropertyValue('--step')).toBe((SWEEP_MS / units().length).toFixed(2) + 'ms')
    setText('x '.repeat(400))
    const many = units()
    expect(many.length, 'too many words to blur one by one: a stride instead').toBeLessThanOrEqual(20)
    expect(parseFloat(box().style.getPropertyValue('--step')), 'the gap stays out of the blur').toBeGreaterThanOrEqual(25)
    expect(many.map((el) => el.textContent).join(''), 'and nothing dropped').toBe('x '.repeat(400))
  })

  it('keeps a joined glyph in one piece', () => {
    setText('🐕 兽设')
    setFlow(true)
    draw()
    const all = units().map((el) => el.textContent!)
    expect(all.join('')).toBe('🐕 兽设')
    // A code point of one code unit sitting in the surrogate range is a pair cut in half.
    const torn = (unit: string): boolean =>
      [...unit].some((ch) => ch.length === 1 && ch >= '\ud800' && ch <= '\udfff')
    expect(all.some(torn), 'no half of a surrogate pair').toBe(false)
  })
})
