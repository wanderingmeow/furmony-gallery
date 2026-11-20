// Tests for the buzz label: where it appears, and what the switch behind it does to the control it
// sits in. Whether iOS gives a buzz cannot be tested here, because that needs a phone.
import { afterEach, describe, expect, it, vi } from 'vitest'
import { withSwitch } from '../testSetup'
import { hapticTap } from './haptics'

afterEach(() => withSwitch(false))

describe('the buzz label', () => {
  it('adds nothing when the engine has no switch', () => {
    withSwitch(false)
    const host = document.createElement('div')
    hapticTap(host)
    expect(host.children.length).toBe(0)
  })

  it('adds nothing when Safari has no switch on the element', () => {
    withSwitch(true)
    // No `switch` on the element, as on Safari before 17.4.
    Reflect.deleteProperty(window.HTMLInputElement.prototype, 'switch')
    const host = document.createElement('div')
    hapticTap(host)
    expect(host.children.length).toBe(0)
  })

  it('adds one label, and a second call adds nothing', () => {
    withSwitch(true)
    const host = document.createElement('div')
    hapticTap(host)
    hapticTap(host)
    const hits = host.querySelectorAll('.haptic-hit')
    expect(hits.length).toBe(1)
    expect(hits[0].getAttribute('aria-hidden')).toBe('true')
    const input = hits[0].querySelector('input')!
    expect(input.type).toBe('checkbox')
    expect(input.getAttribute('switch')).toBe('')
    expect(input.getAttribute('aria-hidden')).toBe('true')
    expect(input.tabIndex).toBe(-1)
  })

  // The reader's tap lands on the label, and the label turns the switch. The control sees the tap
  // once, and the switch is the one that turned.
  it('a tap on the label reaches the control once and turns the switch', () => {
    withSwitch(true)
    const host = document.createElement('button')
    const taps = vi.fn()
    host.addEventListener('click', taps)
    const buzz = hapticTap(host)!
    host.querySelector<HTMLElement>('.haptic-hit')!.click()
    expect(taps).toHaveBeenCalledTimes(1)
    expect(buzz.checked, 'the label turned the switch, and that is the buzz').toBe(true)
  })

  // The label forwards its tap to the switch. That forwarded click is the same tap, so it stops at
  // the switch: the control must not see it a second time.
  it('turning the switch does not reach the control', () => {
    withSwitch(true)
    const host = document.createElement('button')
    const taps = vi.fn()
    host.addEventListener('click', taps)
    hapticTap(host)!.click()
    expect(taps, 'the forwarded click stops at the switch').toHaveBeenCalledTimes(0)
  })

  it('returns the switch, and the same one on a second call', () => {
    withSwitch(false)
    expect(hapticTap(document.createElement('div')), 'no buzz, no switch').toBeNull()
    withSwitch(true)
    const host = document.createElement('div')
    const first = hapticTap(host)
    expect(first).toBe(host.querySelector('.haptic-switch'))
    expect(hapticTap(host), 'a second call does not add a second switch').toBe(first)
  })
})
