// The zoom has one hard rule: the whole picture may arrive at any moment, and the view must not
// move. That holds because Panzoom drives the wrapper that both layers sit in.
//
// This file replaces Panzoom. It decides which element gets the transform, and the fake writes that
// transform onto whatever element the component passes in, so a binding to the picture puts the
// transform on the wrong element. The real library measures layout that a test environment does not
// provide.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render } from 'solid-js/web'

const bound = vi.hoisted(() => [] as string[])

vi.mock('@panzoom/panzoom', () => ({
  default: (elem: HTMLElement) => {
    bound.push(elem.className)
    return {
      destroy: () => {},
      getScale: () => 2,
      zoomWithWheel: () => {
        elem.style.transform = 'matrix(2, 0, 0, 2, 0, 0)'
      },
    }
  },
}))

const { FullScreenZoom } = await import('./FullScreenZoom')

const RESIZED = 'https://bucket.invalid/a.jpg?sign=1&imageMogr2/thumbnail/1300x%3E'
const WHOLE = 'https://bucket.invalid/a.jpg?sign=1'

// The whole picture is downloaded by an Image object, which no test environment can load, so the
// fake answers as soon as the component sets its src. decode returns a promise, the way the
// browser's does.
class FakeImage {
  onload: (() => void) | null = null
  decode = (): Promise<void> => Promise.resolve()
  private loaded = ''
  set src(value: string) {
    this.loaded = value
    queueMicrotask(() => this.onload?.())
  }
  get src(): string {
    return this.loaded
  }
}

class SilentImage extends FakeImage {
  set src(_value: string) {}
  get src(): string {
    return ''
  }
}

let disposeApp: (() => void) | undefined
let host: HTMLDivElement

function mount(): { container: HTMLDivElement; stage: HTMLElement } {
  host = document.createElement('div')
  document.body.appendChild(host)
  disposeApp = render(
    () => <FullScreenZoom imageUrl={RESIZED} fullUrl={WHOLE} count={1} index={() => 0} onClose={() => {}} />,
    host,
  )
  const container = host.querySelector('.fixed') as HTMLDivElement
  return { container, stage: container.querySelector('div.relative') as HTMLElement }
}

const settle = () => new Promise((resolve) => setTimeout(resolve, 0))

/** The reader zooms with the wheel, so that is how these tests get a transform to check. */
const wheel = (container: HTMLDivElement): void => {
  container.dispatchEvent(new WheelEvent('wheel', { deltaY: -240, bubbles: true, cancelable: true }))
}

beforeEach(() => {
  bound.length = 0
  vi.stubGlobal('Image', FakeImage)
})

afterEach(() => {
  disposeApp?.()
  host?.remove()
  vi.unstubAllGlobals()
})

describe('the whole picture arriving over the resized one', () => {
  it('binds the wrapper that holds both layers', () => {
    mount()
    expect(bound).toEqual(['relative w-full h-full'])
  })

  it('keeps the transform on the wrapper, and off both pictures', async () => {
    const { container, stage } = mount()
    wheel(container)
    await settle()
    expect(stage.style.transform).toBe('matrix(2, 0, 0, 2, 0, 0)')
    for (const img of stage.querySelectorAll('img')) expect(img.style.transform).toBe('')
  })

  it('leaves the view exactly where it was', async () => {
    const { container, stage } = mount()
    wheel(container)
    await settle()
    const before = stage.style.transform
    await settle()
    expect(stage.querySelectorAll('img')).toHaveLength(2)
    expect(stage.style.transform).toBe(before)
  })

  // Both layers share one transform, so they have to be the same box: the same class on both.
  it('puts both layers in the same box', async () => {
    const { container } = mount()
    await settle()
    const classes = [...container.querySelectorAll('img')].map((img) => img.className)
    expect(classes).toHaveLength(2)
    for (const className of classes) expect(className).toContain('absolute inset-0 w-full h-full object-contain')
  })

  it('keeps the resized picture when the whole one never arrives', async () => {
    vi.stubGlobal('Image', SilentImage)
    const { container } = mount()
    await settle()
    await settle()
    const imgs = container.querySelectorAll('img')
    expect(imgs).toHaveLength(1)
    expect(imgs[0].getAttribute('src')).toBe(RESIZED)
  })
})

describe('one tap closing the viewer', () => {
  // A plain event is enough: the gate reads only the target, the position, and the time.
  const tap = (el: HTMLElement): void => {
    for (const type of ['pointerdown', 'pointerup']) {
      el.dispatchEvent(new MouseEvent(type, { bubbles: true, clientX: 40, clientY: 40 }))
    }
  }

  function mountWithClose(onClose: () => void): HTMLDivElement {
    host = document.createElement('div')
    document.body.appendChild(host)
    disposeApp = render(
      () => <FullScreenZoom imageUrl={RESIZED} fullUrl={WHOLE} count={1} index={() => 0} onClose={onClose} />,
      host,
    )
    return host.querySelector('.fixed') as HTMLDivElement
  }

  it('closes on a single tap', () => {
    let closes = 0
    tap(mountWithClose(() => { closes++ }))
    expect(closes).toBe(1)
  })
})
