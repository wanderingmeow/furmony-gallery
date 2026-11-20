// Tests for both ways of keeping a press: with the browser holding the gesture, and without.
// One element, real events.
import { afterEach, describe, expect, it } from 'vitest'
import { followPointer, holdPointer } from './trackPointer'

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
  it('passes every move to the callback until the release', () => {
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

  it('runs the stop once, whether the pointer ends on up or cancel', () => {
    hold()
    release()
    release()
    cancel()
    expect(stops).toBe(1)
  })

  it('keeps the moves when the browser has no pointer capture', () => {
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

describe('followPointer', () => {
  const follow = () => followPointer(1, (x) => { moved.push(x) }, () => { stops += 1 })
  const at = (type: string, clientX: number, pointerId = 1) =>
    document.body.dispatchEvent(new PointerEvent(type, { clientX, pointerId, bubbles: true }))

  it('reads moves that arrive on any element', () => {
    follow()
    at('pointermove', 10)
    // The finger has walked off the box that the press started on, and the drag goes on.
    at('pointermove', 20)
    document.documentElement.dispatchEvent(
      new PointerEvent('pointermove', { clientX: 30, pointerId: 1, bubbles: true }))
    at('pointerup', 0)
    at('pointermove', 40)
    expect(moved).toEqual([10, 20, 30])
    expect(stops).toBe(1)
  })

  it('a second pointer does not move this drag', () => {
    follow()
    at('pointermove', 10, 2)
    at('pointermove', 20)
    at('pointerup', 0, 2)
    expect(moved).toEqual([20])
    expect(stops, 'another finger letting go is not this drag ending').toBe(0)
    at('pointerup', 0)
    expect(stops).toBe(1)
  })

  it('runs the stop once, whether the pointer ends on up or cancel', () => {
    follow()
    at('pointerup', 0)
    at('pointerup', 0)
    at('pointercancel', 0)
    expect(stops).toBe(1)
  })

  it('the detach stops the moves and does not run the stop', () => {
    const drop = followPointer(1, (x) => { moved.push(x) }, () => { stops += 1 })
    drop()
    at('pointermove', 10)
    at('pointerup', 0)
    expect(moved).toEqual([])
    expect(stops, 'the drag was dropped, not released').toBe(0)
  })
})
