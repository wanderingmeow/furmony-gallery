import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render } from 'solid-js/web'
import { PictureMode } from './PictureSearch'
import { setSemanticSearch } from '../../stores/displayStore'

// The store's tests cover when each state happens. These cover what the row says and offers:
// nothing else checks that 加载中 belongs to the local decode while 上传中 belongs to the wifi.
const sent = vi.hoisted(() => ({
  answer: null as unknown,
  uploaded: null as (() => void) | null,
  // Re-encoding a picture takes a moment on a phone. A test can hold that step open to keep
  // the row in 加载中.
  encodeGate: null as Promise<void> | null,
}))

vi.mock('../../data/searchApi', async (importOriginal) => {
  const real = await importOriginal<typeof import('../../data/searchApi')>()
  return {
    ...real,
    searchConfigured: true,
    askPicture: (_blob: Blob, signal: AbortSignal, onUploaded?: () => void) =>
      new Promise((resolve) => {
        sent.uploaded = onUploaded ?? null
        signal.addEventListener('abort', () => resolve(null))
        void (sent.answer as Promise<unknown> | null)?.then(resolve)
      }),
  }
})

// The canvas work belongs to the browser; the row only needs the bytes to come back.
vi.mock('../../data/pictureInput', () => ({
  prepare: async (file: Blob) => {
    if (sent.encodeGate) await sent.encodeGate
    return { blob: file }
  },
}))

const { picture } = await import('../../store')

let disposeApp: () => void
let host: HTMLDivElement

/** Solid drains its update queue over more than one microtask, so a test settles by a
 *  macrotask boundary. */
const settled = () => new Promise((resolve) => setTimeout(resolve, 0))

const text = () => (host.textContent ?? '').replace(/\s+/g, '')
/** What the reader can press: the name a screen reader would read. */
const names = () =>
  Array.from(host.querySelectorAll('button')).map(
    (b) => b.getAttribute('aria-label') ?? (b.textContent ?? '').trim(),
  )
const spinning = () => !!host.querySelector('.spark-pulse svg')

/** Show a picture and let the row reach the state that this answer describes. */
async function answerWith(body: unknown): Promise<void> {
  sent.answer = Promise.resolve(body)
  void picture.stage(new Blob(['x'], { type: 'image/jpeg' }))
  await settled()
  await settled()
}

beforeEach(() => {
  sent.answer = null
  sent.uploaded = null
  sent.encodeGate = null
  picture.close()
  setSemanticSearch(true)
  host = document.createElement('div')
  document.body.appendChild(host)
  disposeApp = render(() => <PictureMode />, host)
})

afterEach(() => {
  disposeApp()
  host.remove()
  picture.close()
  setSemanticSearch(false)
})

describe('the picture row', () => {
  it('shows the drop zone before any picture', () => {
    expect(text()).toContain('是哪一只毛毛？上传就知道')
    // The row's one control is the picker: the way out is the bar's own circle.
    expect(names()).toHaveLength(1)
    expect(spinning()).toBe(false)
  })

  it('says 加载中 while the browser reads the picture', async () => {
    let release = () => {}
    sent.encodeGate = new Promise<void>((done) => { release = done })
    void picture.stage(new Blob(['x'], { type: 'image/jpeg' }))
    await settled()
    // Neither 上传中 nor 查找中 is true yet: no byte has left the device.
    expect(text()).toContain('加载中')
    expect(spinning()).toBe(true)
    release()
    await settled()
    expect(text()).toContain('上传中')
  })

  it('moves from 上传中 to 查找中 once the bytes have left', async () => {
    sent.answer = new Promise(() => {})
    void picture.stage(new Blob(['x'], { type: 'image/jpeg' }))
    await settled()
    await settled()
    expect(text()).toContain('上传中')
    sent.uploaded?.()
    await settled()
    expect(text()).toContain('查找中')
    expect(spinning()).toBe(true)
  })

  it('names the answer, and stops spinning for it', async () => {
    await answerWith({ ids: [201], box: [0.25, 0.25, 0.5, 0.5] })
    expect(text()).toContain('视觉匹配结果')
    expect(spinning()).toBe(false)
    // The picture itself is the way to choose another.
    expect(names()).toEqual(['换一张'])
  })

  it('offers 换一张 and not 重试 when nothing matched', async () => {
    await answerWith({ ids: [], box: null })
    expect(text()).toContain('没有很像的')
    expect(names()).toEqual(['换一张', '换一张'])
  })

  it('offers 重试 for a reason that could pass next time', async () => {
    await answerWith({ ids: [], box: null, error: 'network', action: 'retry' })
    expect(text()).toContain('没连上服务')
    expect(names()).toEqual(['换一张', '重试'])
  })

  it('keeps a word it was not taught, and offers no button with it', async () => {
    // A reason from a newer service gets no 重试: this build cannot know whether one would help.
    await answerWith({ ids: [], box: null, error: 'from-a-newer-service' })
    expect(text()).toContain('没搜成')
    expect(names()).toEqual(['换一张'])
  })

  it('says 稍后再试 while the service holds its one upload slot', async () => {
    await answerWith({ ids: [], box: null, busy: true })
    expect(text()).toContain('稍后再试')
    expect(names()).toEqual(['换一张'])
  })
})
