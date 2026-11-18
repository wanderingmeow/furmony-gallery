// FabCircle is shared by the floating controls, so these tests cover what the callers depend on:
// the box, the two fills, and the shadow a caller hands over.
import { afterEach, describe, expect, it, vi } from 'vitest'
import { render } from 'solid-js/web'
import { createSignal, type JSX } from 'solid-js'
import { FabCircle } from './FabCircle'

let disposeApp: () => void
let host: HTMLDivElement

function mount(view: () => JSX.Element): void {
  host = document.createElement('div')
  document.body.appendChild(host)
  disposeApp = render(view, host)
}

const button = () => host.querySelector('button') as HTMLButtonElement

afterEach(() => {
  disposeApp()
  host.remove()
})

describe('FabCircle', () => {
  it('is one circle that names itself', () => {
    mount(() => <FabCircle title="数据统计">x</FabCircle>)
    expect(button().title).toBe('数据统计')
    expect(button().getAttribute('aria-label')).toBe('数据统计')
    expect(button().className).toContain('fab-circle')
    expect(button().className).toContain('rounded-full')
  })

  it('wears the plain face by default', () => {
    mount(() => <FabCircle title="a">x</FabCircle>)
    expect(button().className).toContain('bg-surface')
    expect(button().className).not.toContain('bg-accent')
    expect(button().className).not.toContain('fab-glow')
  })

  it('follows the accent signal', () => {
    const [on, setOn] = createSignal(false)
    mount(() => <FabCircle title="a" accent={on}>x</FabCircle>)
    setOn(true)
    expect(button().className).toContain('bg-accent')
    expect(button().className).not.toContain('bg-surface')
  })

  it('pairs the orange fill with the orange shadow when the caller asks', () => {
    mount(() => <FabCircle title="a" accent glow>x</FabCircle>)
    expect(button().className).toContain('fab-glow')
  })

  it('says whether its own panel is open', () => {
    mount(() => <FabCircle title="a" expanded>x</FabCircle>)
    expect(button().getAttribute('aria-expanded')).toBe('true')
    disposeApp()
    mount(() => <FabCircle title="a">x</FabCircle>)
    expect(button().hasAttribute('aria-expanded')).toBe(false)
  })

  it('hands a click to the caller', () => {
    const press = vi.fn()
    mount(() => <FabCircle title="a" onClick={press}>x</FabCircle>)
    button().click()
    expect(press).toHaveBeenCalledTimes(1)
  })
})
