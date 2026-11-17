import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { makeTapGate, watchTaps, type TapPointer } from './tapGate'

const picture = { name: 'picture' } as unknown as EventTarget
const button = { name: 'button' } as unknown as EventTarget

/** A pointer event as far as the gate can see it: where it landed, where, and when. */
const at = (target: EventTarget | null, x = 100, y = 100, t = 0): TapPointer => ({
  target, timeStamp: t, clientX: x, clientY: y,
})

function gate() {
  const taps: number[] = []
  const g = makeTapGate({ owns: (target) => target === picture, onTap: () => taps.push(1) })
  return { taps, g }
}

// After an accepted tap, a click listener sits on the document for a short window. These tests run
// on fake timers, and every test ends by advancing past that window, so a listener left by one
// test cannot stop a click in the next.
const PAST_WINDOW_MS = 1000

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.advanceTimersByTime(PAST_WINDOW_MS)
  vi.useRealTimers()
})

/** Two fingers go down together and lift one at a time, ending where the first one started and
 *  inside the time that a tap is allowed. A pinch that ends like this looks exactly like a tap to
 *  anything that counts only the last finger. */
function pinch(g: ReturnType<typeof gate>['g']) {
  g.down(at(picture, 100, 300, 0))
  g.down(at(picture, 220, 300, 20))
  g.up(at(picture, 220, 300, 120))
  g.up(at(picture, 100, 300, 160))
}

describe('tapGate', () => {
  it('takes one tap on the picture', () => {
    const { taps, g } = gate()
    g.down(at(picture, 100, 300, 0))
    g.up(at(picture, 100, 300, 60))
    expect(taps).toHaveLength(1)
  })

  // The limits are inclusive, so these two pin where a tap stops being one. A press at the edge
  // is still a tap: making the reader tap again is worse than letting a slow one through.
  it('still counts a press at the edge of both limits', () => {
    const { taps, g } = gate()
    g.down(at(picture, 100, 300, 0))
    g.up(at(picture, 110, 300, 400))
    expect(taps).toHaveLength(1)
  })

  it('ignores a press that drifted, because that is a pan', () => {
    const { taps, g } = gate()
    g.down(at(picture, 100, 300, 0))
    g.up(at(picture, 190, 320, 200))
    expect(taps).toHaveLength(0)
  })

  it('ignores a press held too long, because that is a hold', () => {
    const { taps, g } = gate()
    g.down(at(picture, 100, 300, 0))
    g.up(at(picture, 100, 300, 600))
    expect(taps).toHaveLength(0)
  })

  it('ignores a pinch, whose fingers lift at different times', () => {
    const { taps, g } = gate()
    pinch(g)
    expect(taps).toHaveLength(0)
  })

  // Two fingers close together are the case that the drift check cannot see: the last finger lifts
  // nearly where the press was recorded and inside the time a tap gets, so only the count of
  // fingers says this was no tap.
  it('ignores two fingers that land close together and lift in turn', () => {
    const { taps, g } = gate()
    g.down(at(picture, 100, 300, 0))
    g.down(at(picture, 108, 300, 20))
    g.up(at(picture, 108, 300, 120))
    g.up(at(picture, 100, 300, 160))
    expect(taps).toHaveLength(0)
  })
  it('ignores a press on a button above the picture', () => {
    const { taps, g } = gate()
    g.down(at(button, 100, 300, 0))
    g.up(at(button, 100, 300, 60))
    expect(taps).toHaveLength(0)
  })

  // Zooming in and then tapping to leave is the normal way through this screen, so the state that
  // a pinch leaves behind must not carry into the next press.
  it('takes a tap that follows a pinch', () => {
    const { taps, g } = gate()
    pinch(g)
    g.down(at(picture, 100, 300, 1000))
    g.up(at(picture, 100, 300, 1060))
    expect(taps).toHaveLength(1)
  })

  // A cancelled gesture says nothing about what the reader meant, so it neither closes the
  // viewer nor leaves a finger counted as still down.
  it('takes a tap that follows a cancelled gesture', () => {
    const { taps, g } = gate()
    g.down(at(picture, 100, 300, 0))
    g.cancel()
    g.down(at(picture, 100, 300, 1000))
    g.up(at(picture, 100, 300, 1060))
    expect(taps).toHaveLength(1)
  })

  // A pan resets the press, and the next tap on the same picture still closes: this is the other
  // reset path, the one that a pinch does not go through.
  it('takes a tap that follows a pan', () => {
    const { taps, g } = gate()
    g.down(at(picture, 100, 300, 0))
    g.up(at(picture, 190, 300, 200))
    g.down(at(picture, 100, 300, 1000))
    g.up(at(picture, 100, 300, 1060))
    expect(taps).toHaveLength(1)
  })

  // A release can reach the window with no press behind it (a gesture that started outside).
  // Counting that as a finger would block every tap after it.
  it('takes a tap after a release that had no press', () => {
    const { taps, g } = gate()
    g.up(at(picture, 100, 300, 0))
    g.down(at(picture, 100, 300, 1000))
    g.up(at(picture, 100, 300, 1060))
    expect(taps).toHaveLength(1)
  })

  // Everything above calls the gate by hand. This one is the wiring: the widget that pans the
  // picture stops the press from bubbling, so it only reaches the window because watchTaps
  // listens in the capture phase. Drop that `true` and the feature stops working while every
  // other test stays green.
  it('takes a tap whose press never bubbles to the window', () => {
    const host = document.createElement('div')
    const picture = document.createElement('img')
    host.appendChild(picture)
    document.body.appendChild(host)
    const stop = (e: Event) => e.stopPropagation()
    picture.addEventListener('pointerdown', stop)
    host.addEventListener('pointerdown', stop)

    let taps = 0
    const dispose = watchTaps({ owns: (t) => t === picture, onTap: () => { taps += 1 } })
    const send = (type: string) =>
      picture.dispatchEvent(new MouseEvent(type, { bubbles: true, clientX: 100, clientY: 300 }))
    send('pointerdown')
    send('pointerup')

    expect(taps).toBe(1)
    dispose()
    picture.removeEventListener('pointerdown', stop)
    host.removeEventListener('pointerdown', stop)
    host.remove()
  })

  // The second half matters as much as the first: a listener that never left the document would
  // block the reader's next tap.
  it('stops the click that follows an accepted tap, then lets clicks through again', () => {
    const surface = document.createElement('div')
    const behind = document.createElement('img')
    document.body.appendChild(surface)
    document.body.appendChild(behind)
    let clicks = 0
    behind.addEventListener('click', () => { clicks += 1 })

    let taps = 0
    const dispose = watchTaps({ owns: () => true, onTap: () => { taps += 1 } })
    const send = (type: string, on: HTMLElement) =>
      on.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, clientX: 40, clientY: 40 }))
    send('pointerdown', surface)
    send('pointerup', surface)
    send('click', behind)
    expect(taps).toBe(1)
    expect(clicks).toBe(0)

    vi.advanceTimersByTime(PAST_WINDOW_MS)
    send('click', behind)
    expect(clicks).toBe(1)

    dispose()
    surface.remove()
    behind.remove()
  })
})
