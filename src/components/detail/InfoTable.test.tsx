// The 详细描述 row keeps a paragraph's worth of space while an answer is on its way, and the text
// is translated when it is not in the language on screen. Both are about the same row: the reader
// should not watch it resize, and should not have to read a language they did not pick.
import { afterEach, describe, expect, it, vi } from 'vitest'
import { render } from 'solid-js/web'
import type { AdoptListing } from '../../model/types'
import { setLocale } from '../../i18n'
import { rememberWords } from '../../model/translatedText'
import { InfoTable } from './InfoTable'

// Made-up words about nothing. The translation cache is keyed by text, so each listing carries its
// own id and one test cannot read another test's answer.
const words = (id: number) => `这一段介绍是编出来的，只用来测试翻译。${id}`.repeat(3)
const wordsTraditional = '這一段介紹是編出來的，只用來測試翻譯。'

const row = (adoptId: number): AdoptListing =>
  ({
    adoptId,
    adoptName: '测试设定',
    detailDescription: words(adoptId),
    paintersId: 3,
    productId: 1,
    raceId: 2,
    allcost: 12345,
    harmonyPainterVo: { painterid: 7, painterName: '测试画师' },
    harmonyAdoptDetails: [],
  }) as AdoptListing

/** Stand in for the translation endpoint. Returns the sections it was sent, one per call. */
function endpoint(lines: string[] | null) {
  const sent: string[][] = []
  vi.stubGlobal(
    'fetch',
    vi.fn(async (_url: string, init: RequestInit) => {
      sent.push(JSON.parse(String(init.body))[0][0])
      return lines === null ? { ok: false, status: 503 } : { ok: true, json: async () => [lines] }
    }),
  )
  return sent
}

/**
 * Stand in for the endpoint with the answer held back, so a test can act while a request is on its
 * way. `sent` holds one signal per call, and `release` answers every call that is waiting. A call
 * that was called off fails the way `fetch` fails, so it stores nothing.
 */
function waiting() {
  const sent: AbortSignal[] = []
  let release: (lines: string[]) => void = () => {}
  const answer = new Promise<string[]>((resolve) => {
    release = resolve
  })
  vi.stubGlobal(
    'fetch',
    vi.fn(async (_url: string, init: RequestInit) => {
      const signal = init.signal as AbortSignal
      sent.push(signal)
      const lines = await answer
      if (signal.aborted) throw new DOMException('called off', 'AbortError')
      return { ok: true, json: async () => [lines] }
    }),
  )
  return { sent, release }
}

/** Let the request promise settle and Solid repaint. */
const settle = () => new Promise((resolve) => setTimeout(resolve, 0))

let dispose: (() => void) | undefined
// Solid hands clicks to a listener on the document, so a host that never reached the page never
// sees one.
let hosts: HTMLElement[] = []
afterEach(() => {
  dispose?.()
  dispose = undefined
  hosts.forEach((host) => host.remove())
  hosts = []
  setLocale('zh')
  vi.unstubAllGlobals()
})

/** Draw the table for a listing whose words the shelf has already answered. One table at a time,
 *  so a render the test has moved on from does not answer to the next language. */
function draw(l: AdoptListing, lang: 'en' | 'ja' | 'zh' | 'zh_tw') {
  dispose?.()
  rememberWords([l], lang)
  setLocale(lang)
  const host = document.createElement('div')
  document.body.appendChild(host)
  hosts.push(host)
  dispose = render(() => <InfoTable listing={l} />, host)
  const label = [...host.querySelectorAll('span')].find((s) => s.textContent === 'Description')
  return { host, body: () => label!.parentElement! }
}

describe('the description row', () => {
  it('holds three lines of their own length while the shelf answer is on its way', () => {
    const { body } = draw(row(1), 'en')

    const bars = [...body().querySelectorAll('span[aria-hidden="true"]')]
    expect(bars).toHaveLength(3)
    const widths = bars.map((b) => /(?:^|\s)(w-\S+)/.exec(b.className)?.[1] ?? '')
    expect(new Set(widths).size, `three lengths, got ${widths.join(' ')}`).toBe(3)
  })

  it('writes what the shelf answered when it already fits the screen', () => {
    const english = { ...row(2), detailDescription: 'Some made-up English words about nothing.' }
    const { body } = draw(english, 'en')
    expect(body().textContent).toContain('Some made-up English words')
    expect(body().querySelector('button'), 'nothing to translate, so no button').toBeNull()
  })

  it('asks for the translation on its own and keeps the placeholder while it waits', async () => {
    const sent = endpoint(['Some made-up words.'])
    const { body } = draw(row(3), 'en')
    expect(sent, 'the row translates itself without being asked').toHaveLength(1)
    expect(body().querySelectorAll('span[aria-hidden="true"]'), 'placeholder while it waits').toHaveLength(3)
    await settle()
  })

  it('is lit while the request is on its way, and a tap calls it off', async () => {
    const { sent, release } = waiting()
    const { body } = draw(row(4), 'en')
    const button = body().querySelector('button')!

    expect(button.className, 'the offer is on from the start').toContain('bg-accent/15')
    expect(button.getAttribute('title'), 'a tap shows the shelf words').toContain('original')

    button.click()
    expect(body().querySelectorAll('span[aria-hidden="true"]'), 'the placeholder is gone').toHaveLength(0)
    expect(body().textContent).toContain(words(4))

    release(['Some made-up words.'])
    await settle()
    expect(body().textContent, 'an answer the reader called off stays off the row').not.toContain('Some made-up')

    button.click()
    await settle()
    expect(sent, 'a later tap asks again').toHaveLength(2)
    expect(body().textContent, 'the new answer is shown').toContain('Some made-up words.')
  })

  it('shows the answer, marks it, and hands the row back on a tap', async () => {
    const sent = endpoint(['Some made-up words, kept short.'])
    const { body } = draw(row(5), 'en')
    await settle()

    expect(body().textContent).toContain('Some made-up words, kept short.')
    expect(body().textContent, 'machine words are labelled as such').toContain('Machine translation')
    const button = body().querySelector('button')!
    expect(button.className, 'the button is lit while the translation is on screen').toContain('bg-accent/15')

    button.click()
    expect(body().textContent).toContain(words(5))
    expect(body().textContent).not.toContain('Machine translation')

    button.click()
    await settle()
    expect(body().textContent).toContain('Some made-up words, kept short.')
    expect(sent, 'the answer is kept, so no second request').toHaveLength(1)
  })

  it('keeps the shelf words and turns the button red when the request fails', async () => {
    const sent = endpoint(null)
    const { body } = draw(row(6), 'en')
    await settle()

    expect(body().textContent).toContain(words(6))
    expect(body().querySelectorAll('span[aria-hidden="true"]')).toHaveLength(0)
    const button = body().querySelector('button')!
    expect(button.className).toContain('text-red-600')
    expect(button.getAttribute('title'), 'the button says what a tap does').toContain('again')

    button.click()
    expect(sent, 'the tap that asked for it sends the request again').toHaveLength(2)
  })

  it('leaves 简体中文 alone, and asks 繁體中文 about simplified words', () => {
    endpoint(['答案'])
    const traditional = { ...row(7), detailDescription: wordsTraditional }
    const simplified = row(8)

    const zhButtons = draw(simplified, 'zh').host.querySelectorAll('button').length
    const twButtons = draw(traditional, 'zh_tw').host.querySelectorAll('button').length
    const twSimplified = draw(simplified, 'zh_tw')

    expect(zhButtons, 'a 简体中文 screen reads the shelf as it is').toBe(0)
    expect(twButtons, 'traditional words need no translation').toBe(0)
    expect([...twSimplified.host.querySelectorAll('button')], 'simplified words do').toHaveLength(1)
  })
})
