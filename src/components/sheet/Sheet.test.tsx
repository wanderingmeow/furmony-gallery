// The foot box is where a screen paints its own bottom bar. The box carries a marker, like the
// scroller does, so these tests do not guess which child of the card it is.
import { afterEach, describe, expect, it } from 'vitest'
import { createSignal, type JSX } from 'solid-js'
import { Portal, render } from 'solid-js/web'
import { Sheet } from './Sheet'
import { useSheetFooter } from '../ui/boxes'

let disposeApp: () => void
let host: HTMLDivElement

function mount(view: () => JSX.Element): void {
  host = document.createElement('div')
  document.body.appendChild(host)
  disposeApp = render(view, host)
}

afterEach(() => {
  disposeApp()
  host.remove()
})

// A screen that carries its own bar. It reads the box once, when the screen is created, the way
// Detail does.
function Screen(): JSX.Element | undefined {
  const box = useSheetFooter()
  return (
    box && (
      <Portal mount={box} useShadow={false}>
        <button type="button" id="bar">前往官网</button>
      </Portal>
    )
  )
}

const footBox = () => document.querySelector('[data-sheet-footer]')
const bar = () => document.querySelector('#bar')

describe('the foot box a screen paints its bar into', () => {
  it('holds the bar on the first open', () => {
    const [open, setOpen] = createSignal(false)
    mount(() => <Sheet open={open} onDismiss={() => setOpen(false)}>{() => <Screen />}</Sheet>)
    setOpen(true)
    expect(bar()).toBeTruthy()
    expect(bar()!.isConnected).toBe(true)
    expect(footBox()!.contains(bar())).toBe(true)
  })

  it('holds the bar again after a close and a reopen', () => {
    const [open, setOpen] = createSignal(false)
    mount(() => <Sheet open={open} onDismiss={() => setOpen(false)}>{() => <Screen />}</Sheet>)
    setOpen(true)
    setOpen(false)
    setOpen(true)
    expect(bar()).toBeTruthy()
    expect(bar()!.isConnected).toBe(true)
    expect(footBox()!.contains(bar())).toBe(true)
  })

  it('leaves the box empty when no screen claims it', () => {
    const [open, setOpen] = createSignal(false)
    mount(() => <Sheet open={open} onDismiss={() => setOpen(false)}>{() => <span>body</span>}</Sheet>)
    setOpen(true)
    expect(bar()).toBeNull()
    expect(footBox()!.textContent).toBe('')
  })
})
