import { createSignal } from 'solid-js'

/** Whether the app is moving the document for the user. Safari puts the page back where it stood
 *  when a field took focus, and giving up a history entry is a request on the scroll position. The
 *  user's own position is written back until the page has had its say. */
const [pageIsHeld, setHeld] = createSignal(false)

export { pageIsHeld }

/** A move this far from the held position came from a finger, not from the page's own memory. */
const GIVE_UP_PX = 240

/** Long enough to cover the writes that arrive after the blur and the history step they answer to. */
const HOLD_MS = 600

/** What one frame of a hold does with the document. */
export type HoldStep = 'write' | 'hold' | 'done'

/** `hold`: the page is where it should be. `write`: something moved it. `done`: the user moved it
 *  out of reach, or the page's own memory has had its say. */
export function nextHold(at: number, atNow: number, expired: boolean): HoldStep {
  if (expired || Math.abs(atNow - at) > GIVE_UP_PX) return 'done'
  return Math.abs(atNow - at) > 0.6 ? 'write' : 'hold'
}

// A user who is already moving has the page back at once: these are the gestures that mean it.
const GESTURES = ['touchstart', 'wheel', 'keydown'] as const

let token = 0

/** A hold started while another runs takes the page over. The signal goes back two frames after the
 *  last write: a scroll event is dispatched after the frame's animation callbacks. */
export function holdPage(at: number): void {
  const mine = ++token
  setHeld(true)
  const deadline = Date.now() + HOLD_MS

  const giveBack = () => {
    if (token !== mine) return
    token++
    for (const name of GESTURES) window.removeEventListener(name, giveBack)
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        if (token === mine + 1) setHeld(false)
      }),
    )
  }

  const step = () => {
    if (token !== mine) return
    const atNow = window.scrollY
    const next = nextHold(at, atNow, Date.now() >= deadline)
    if (next === 'write') window.scrollTo(0, at)
    if (next === 'done') return giveBack()
    requestAnimationFrame(step)
  }

  for (const name of GESTURES) window.addEventListener(name, giveBack, { passive: true })
  requestAnimationFrame(step)
}
