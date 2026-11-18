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

const picture = (): HTMLImageElement =>
  ({ naturalWidth: 1000, naturalHeight: 500, complete: true }) as HTMLImageElement

const job = (): { ready: Promise<HTMLImageElement>; cancel: () => void } => ({
  ready: Promise.resolve(picture()),
  cancel: vi.fn(),
})

function mount(): { host: HTMLElement; done: () => void } {
  const host = document.createElement('div')
  document.body.appendChild(host)
  const dispose = render(
    () => <Gallery images={URLS} index={() => 0} setIndex={() => {}} onOpenFull={() => {}} />,
    host,
  )
  return {
    host,
    done: () => { dispose(); host.remove() },
  }
}

const mainPic = (host: HTMLElement): HTMLImageElement | null => host.querySelector('img')
// The thumbnail boxes use the same fill, so this looks for the placeholder height.
const skeletonBlock = (host: HTMLElement): Element | null => host.querySelector('.sk-bar.h-72')

afterEach(() => {
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
