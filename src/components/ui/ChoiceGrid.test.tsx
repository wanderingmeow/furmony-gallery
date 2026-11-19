// The 界面语言 row in the filter panel is built on this control, so these check what that row
// relies on: one cell marked, the picked value handed out, and a group a screen reader can name.
import { createSignal } from 'solid-js'
import { afterEach, describe, expect, it } from 'vitest'
import { render } from 'solid-js/web'
import { ChoiceGrid, type Choice } from './ChoiceGrid'

const ITEMS: Choice<string>[] = [
  { value: 'zh', label: '简体中文' },
  { value: 'zh_tw', label: '繁體中文' },
  { value: 'ja', label: '日本語' },
  { value: 'en', label: 'English' },
]

let dispose: (() => void) | undefined
let host: HTMLDivElement

function draw(value = 'zh', over: Record<string, unknown> = {}): (v?: string) => unknown {
  const [v, setV] = createSignal<string>(value)
  host = document.createElement('div')
  document.body.appendChild(host)
  dispose = render(
    () => <ChoiceGrid value={v} onChange={setV} items={ITEMS} label="界面语言" {...over} />,
    host,
  )
  return setV
}

/** The same, with the caller's own listener, so a test can watch what the grid reports. */
function drawWithReport(value: string, onChange: (v: string) => void): void {
  const [v, setV] = createSignal<string>(value)
  host = document.createElement('div')
  document.body.appendChild(host)
  dispose = render(
    () => (
      <ChoiceGrid
        value={v}
        onChange={(n) => { onChange(n); setV(n) }}
        items={ITEMS}
        label="界面语言"
      />
    ),
    host,
  )
}

const cells = () => Array.from(host.querySelectorAll<HTMLInputElement>('input[type="radio"]'))
const ticks = () => host.querySelectorAll('label svg')

const pick = (i: number): void => {
  const el = cells()[i]
  el.checked = true
  el.dispatchEvent(new Event('change', { bubbles: true }))
}

afterEach(() => {
  dispose?.()
  host?.remove()
  dispose = undefined
})

describe('one cell at a time', () => {
  it('marks the chosen value and nothing else', () => {
    draw('ja')
    expect(cells().map((i) => i.checked)).toEqual([false, false, true, false])
    expect(ticks()).toHaveLength(1)
  })

  it('hands the picked value to onChange and moves the tick', () => {
    const seen: string[] = []
    drawWithReport('zh', (n) => seen.push(n))
    pick(3)
    expect(seen).toEqual(['en'])
    expect(cells().filter((i) => i.checked).map((i) => i.value)).toEqual(['en'])
    expect(ticks()).toHaveLength(1)
  })
})

describe('what a screen reader hears', () => {
  it('is one radio group named after the row', () => {
    draw()
    const group = host.querySelector<HTMLElement>('[role="group"]')!
    expect(group.getAttribute('aria-label')).toBe('界面语言')
    expect(new Set(cells().map((i) => i.name))).toEqual(new Set(['界面语言']))
    expect(cells().map((i) => i.value)).toEqual(['zh', 'zh_tw', 'ja', 'en'])
  })

  it('keeps the tick out of what is read', () => {
    draw('en')
    for (const span of Array.from(host.querySelectorAll('span[aria-hidden]'))) {
      expect(span.textContent).toBe('')
    }
  })
})

describe('the shape of the grid', () => {
  it('takes two rows of two when nothing is asked for', () => {
    draw()
    expect(host.querySelector('[role="group"]')!.className).toContain('grid-cols-2')
  })

  it('takes three to a row when asked', () => {
    draw('zh', { columns: 3 })
    expect(host.querySelector('[role="group"]')!.className).toContain('grid-cols-3')
  })
})
