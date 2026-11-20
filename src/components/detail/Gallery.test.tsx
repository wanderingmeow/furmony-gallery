// The gallery opens in one of two ways, and `readyNow` is the switch.
import { afterEach, describe, expect, it, vi } from 'vitest'
import { render } from 'solid-js/web'
import { Gallery } from './Gallery'

const { imageReady, preloadImage } = vi.hoisted(() => ({
  imageReady: vi.fn((): boolean => false),
  preloadImage: vi.fn(),
}))

vi.mock('../../data/image', async (importOriginal) => {
  const real = await importOriginal<Record<string, unknown>>()
  return { ...real, imageReady, preloadImage }
})

const URLS = ['https://bucket.test/one.png', 'https://bucket.test/two.png']
// What a panel hands the art: a height to fill, and the ceiling a sheet would have used.
const PANEL = { maxH: 240, fillH: 548 }

const picture = (): HTMLImageElement =>
  ({ naturalWidth: 1000, naturalHeight: 500, complete: true }) as HTMLImageElement

const job = (): { ready: Promise<HTMLImageElement>; cancel: () => void } => ({
  ready: Promise.resolve(picture()),
  cancel: vi.fn(),
})

function mount(props: { maxH?: number; fillH?: number } = {}): { host: HTMLElement; done: () => void } {
  const host = document.createElement('div')
  document.body.appendChild(host)
  const dispose = render(
    () => (
      <Gallery
        images={URLS}
        index={() => 0}
        setIndex={() => {}}
        onOpenFull={() => {}}
        {...props}
      />
    ),
    host,
  )
  return {
    host,
    done: () => { dispose(); host.remove() },
  }
}

const mainPic = (host: HTMLElement): HTMLImageElement | null => host.querySelector('img')
// The thumbnail boxes use the same fill, so this looks for the placeholder height.
const skeletonBlock = (host: HTMLElement): HTMLElement | null => host.querySelector('.sk-bar.h-72')

afterEach(() => {
  vi.unstubAllGlobals()
  vi.clearAllMocks()
  imageReady.mockReturnValue(false)
  preloadImage.mockReturnValue(job())
})

describe('Gallery first picture', () => {
  it('opens straight to the picture the browser already holds', () => {
    imageReady.mockReturnValue(true)
    const { host, done } = mount()
    expect(imageReady).toHaveBeenCalledWith(URLS[0])
    expect(skeletonBlock(host)).toBeNull()
    const pic = mainPic(host)
    expect(pic).not.toBeNull()
    expect(pic!.style.opacity).toBe('1')
    // The layout gives this picture its height, so nothing has to grow into place.
    expect(pic!.style.height).toBe('auto')
    done()
  })

  it('asks the browser only about the picture it is about to show', () => {
    const { done } = mount()
    expect(imageReady).toHaveBeenCalledTimes(1)
    expect(imageReady).toHaveBeenCalledWith(URLS[0])
    done()
  })

  it('holds the space with a skeleton while the first picture is downloaded', async () => {
    const { host, done } = mount()
    expect(skeletonBlock(host)).not.toBeNull()
    await vi.waitFor(() => expect(mainPic(host)).not.toBeNull())
    expect(skeletonBlock(host)).toBeNull()
    done()
  })
})

describe('The box a panel hands to the art', () => {
  it('fills the height it was given', () => {
    imageReady.mockReturnValue(true)
    const { host, done } = mount(PANEL)
    const pic = mainPic(host)!
    expect(pic.parentElement!.style.height).toBe('548px')
    expect(pic.style.height).toBe('100%')
    // The ceiling has nothing left to say here: the box is the height, not a limit on it.
    expect(pic.style.maxHeight).toBe('')
    done()
  })

  it('holds the same box with the skeleton, so the first picture does not arrive smaller', () => {
    const { host, done } = mount(PANEL)
    const bar = skeletonBlock(host)!
    expect(bar.style.height).toBe('548px')
    expect(bar.style.maxHeight).toBe('')
    done()
  })
})

describe('A container that changes width', () => {
  // The height the picture holds is pixels one width produced, so a new width must redo it.
  const watchers: (() => void)[] = []
  const stubObserver = () => {
    vi.stubGlobal(
      'ResizeObserver',
      class {
        constructor(cb: () => void) { watchers.push(cb) }
        observe() {}
        disconnect() {}
      },
    )
  }
  const widen = (el: HTMLElement, px: number) =>
    Object.defineProperty(el, 'clientWidth', { value: px, configurable: true })
  // The element the gallery measures is the one in the document, not the job's stand-in.
  const withSource = (pic: HTMLImageElement, w: number, h: number) => {
    Object.defineProperty(pic, 'naturalWidth', { value: w, configurable: true })
    Object.defineProperty(pic, 'naturalHeight', { value: h, configurable: true })
  }

  it('redoes the height when the container gets wider', () => {
    imageReady.mockReturnValue(true)
    stubObserver()
    const { host, done } = mount()
    const pic = mainPic(host)!
    widen(pic.parentElement!, 300)
    withSource(pic, 1000, 500)
    pic.style.height = '242px' // the height a sideways screen left behind
    watchers.at(-1)!()
    // The source is 1000x500, so 300 of width stands 150 tall.
    expect(pic.style.height).toBe('150px')
    done()
  })

  it('leaves the height to the box a panel handed over', () => {
    imageReady.mockReturnValue(true)
    stubObserver()
    const { host, done } = mount(PANEL)
    const pic = mainPic(host)!
    widen(pic.parentElement!, 300)
    withSource(pic, 1000, 500)
    watchers.at(-1)!()
    expect(pic.style.height).toBe('100%')
    done()
  })
})
