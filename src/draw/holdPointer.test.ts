// Tests for the pointer hold (holdPointer.ts). One element, real events.
import { afterEach, describe, expect, it } from 'vitest'
import { holdPointer } from './holdPointer'

let strip: HTMLElement
const moved: number[] = []
let stops = 0

const hold = () => {
  strip = document.createElement('div')
  document.body.appendChild(strip)
  holdPointer(strip, 1, (x) => { moved.push(x) }, () => { stops += 1 })
}
const move = (clientX: number) =>
  strip.dispatchEvent(new PointerEvent('pointermove', { clientX, bubbles: true }))
const release = () => strip.dispatchEvent(new Event('pointerup', { bubbles: true }))
const cancel = () => strip.dispatchEvent(new Event('pointercancel', { bubbles: true }))

afterEach(() => {
  strip?.remove()
  moved.length = 0
  stops = 0
})

describe('holdPointer', () => {
  it('reports every move until the release', () => {
    hold()
    move(10)
    move(20)
    release()
    move(30)
    expect(moved).toEqual([10, 20])
    expect(stops).toBe(1)
  })

  it('treats a cancel as a release', () => {
    hold()
    move(10)
    cancel()
    move(20)
    expect(moved).toEqual([10])
    expect(stops).toBe(1)
  })

  it('lets go once, however the pointer is returned', () => {
    hold()
    release()
    release()
    cancel()
    expect(stops).toBe(1)
  })

  it('still holds the moves where a browser has no pointer capture', () => {
    strip = document.createElement('div')
    strip.setPointerCapture = undefined as unknown as Element['setPointerCapture']
    document.body.appendChild(strip)
    holdPointer(strip, 1, (x) => { moved.push(x) }, () => { stops += 1 })
    move(7)
    release()
    expect(moved).toEqual([7])
    expect(stops).toBe(1)
  })
})
