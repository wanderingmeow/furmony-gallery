// The panel the corner button opens: what a press sends to the stores, and what the panel draws
// from what the stores answer.
import { afterEach, describe, expect, it, vi } from 'vitest'
import { render } from 'solid-js/web'
import { ArrowUpOutlined, ClockCircleOutlined, DollarOutlined } from '@ant-design/icons-svg'
import { FilterPanel, priceIcon, timeIcon } from './FilterPanel'

const facts = vi.hoisted(() => ({
  colors: new Set<string>(),
  races: new Set<string>(),
  sort: 'timeDesc' as 'timeDesc' | 'timeAsc' | 'priceAsc' | 'priceDesc',
  semantic: false,
  // The state behind the stores this panel reads and writes.
  filterOn: false,
  ready: true,
  canReset: false,
}))

const calls = vi.hoisted(() => [] as string[])

vi.mock('../../stores/derivedStore', () => ({
  availableColors: () => ['红', '蓝'],
  availableRaces: () => ['狼', '龙'],
  panelHasChanges: () => facts.canReset,
  resetPanel: () => calls.push('reset'),
  socialCount: () => 87,
  socialFilterOn: () => facts.filterOn,
  socialsReady: () => facts.ready,
}))
vi.mock('../../stores/filterStore', () => ({
  selectedColors: () => facts.colors,
  // The mocks write what the real store writes, so a press changes what the panel reads next.
  setSelectedColors: (v: Set<string>) => { facts.colors = new Set(v); calls.push(`colors:${[...v].join(',')}`) },
  selectedRaces: () => facts.races,
  setSelectedRaces: (v: Set<string>) => { facts.races = new Set(v); calls.push(`races:${[...v].join(',')}`) },
  sortMode: () => facts.sort,
  setSortMode: (v: string) => { facts.sort = v as typeof facts.sort; calls.push(`sort:${v}`) },
  setSocialOnly: (v: boolean) => calls.push(`socialOnly:${v}`),
}))
vi.mock('../../stores/displayStore', () => ({
  priceMode: () => 'once',
  setPriceMode: (v: string) => calls.push(`price:${v}`),
  setSemanticSearch: (v: boolean) => calls.push(`semantic:${v}`),
}))
vi.mock('../../stores/semanticStore', () => ({
  searchConfigured: true,
  semanticActive: () => facts.semantic,
  semanticOn: () => false,
}))
// The price block draws a histogram and a slider from the derived store, and its own file tests
// what it does with them.
vi.mock('./PriceRange', () => ({ PriceRangeBlock: () => null }))

let dispose: (() => void) | undefined
let host: HTMLDivElement

function draw() {
  // Calling it twice replaces what is on screen, so a test can change the facts and look again.
  dispose?.()
  host?.remove()
  host = document.createElement('div')
  document.body.appendChild(host)
  dispose = render(() => FilterPanel(), host)
}

const press = (text: string) => {
  const button = Array.from(host.querySelectorAll<HTMLButtonElement>('button'))
    .find((b) => b.textContent?.trim() === text)
  if (!button) throw new Error(`no button labeled ${text}`)
  button.click()
}

const pressed = (text: string) =>
  Array.from(host.querySelectorAll<HTMLButtonElement>('button'))
    .find((b) => b.textContent?.trim() === text)
    ?.getAttribute('aria-pressed')

const disabled = (text: string) =>
  !!Array.from(host.querySelectorAll<HTMLButtonElement>('button'))
    .find((b) => b.textContent?.trim() === text)
    ?.disabled

/** The fold rows, as `title:true` or `title:false`. The count sits inside a row's text, so it is
 *  cut off to leave the title. */
const folds = () =>
  Array.from(host.querySelectorAll<HTMLButtonElement>('button[aria-expanded]'))
    .map((b) => `${(b.textContent ?? '').replace(/\d+\/\d+/, '').trim()}`
      + `:${b.getAttribute('aria-expanded')}`)

const chip = (text: string) => {
  const button = Array.from(host.querySelectorAll<HTMLButtonElement>('button'))
    .find((b) => b.textContent?.trim() === text)
  if (!button) throw new Error(`no chip labeled ${text}`)
  button.click()
}

/** The panel has more than one switch, so a test picks the one it needs by name. */
const switchByLabel = (label: string) => {
  const sw = host.querySelector<HTMLButtonElement>(`button[role="switch"][aria-label="${label}"]`)
  if (!sw) throw new Error(`no switch labeled ${label}`)
  return sw
}

const reset = () => {
  const button = Array.from(host.querySelectorAll<HTMLButtonElement>('button'))
    .find((b) => b.textContent?.trim() === '重置')
  if (!button) throw new Error('no reset row')
  return button
}

const foldRows = () => Array.from(host.querySelectorAll<HTMLButtonElement>('button[aria-expanded]'))

const fold = (title: string) => {
  const button = foldRows().find((b) => b.textContent?.trim().startsWith(title))
  if (!button) throw new Error(`no fold row titled ${title}`)
  button.click()
}

afterEach(() => {
  dispose?.()
  host?.remove()
  calls.length = 0
  facts.colors = new Set()
  facts.races = new Set()
  facts.sort = 'timeDesc'
  facts.semantic = false
  facts.filterOn = false
  facts.ready = true
  facts.canReset = false
})

describe('FilterPanel', () => {
  it('marks the chip that matches the current order', () => {
    draw()
    expect(pressed('价格')).toBe('false')
    expect(pressed('时间')).toBe('true')
  })

  it('walks the price group and never cancels back to time', () => {
    draw()
    press('价格')
    expect(calls).toEqual(['sort:priceAsc'])
    press('价格')
    expect(calls).toContain('sort:priceDesc')
    press('价格')
    expect(calls).toContain('sort:priceAsc')
  })

  it('enters the time group at newest first', () => {
    facts.sort = 'priceAsc'
    draw()
    press('时间')
    expect(calls).toEqual(['sort:timeDesc'])
    press('时间')
    expect(calls).toContain('sort:timeAsc')
  })

  it('grays the order buttons while a search answer is on screen', () => {
    facts.semantic = true
    draw()
    expect(disabled('价格')).toBe(true)
    expect(disabled('时间')).toBe(true)
    press('价格')
    expect(calls).toEqual([])
  })

  it('shows what a press would choose, not a direction, while a search answer is on screen', () => {
    facts.sort = 'priceAsc'
    expect(priceIcon()).toBe(ArrowUpOutlined)
    facts.sort = 'timeAsc'
    expect(timeIcon()).toBe(ArrowUpOutlined)
    facts.semantic = true
    expect(priceIcon()).toBe(DollarOutlined)
    expect(timeIcon()).toBe(ClockCircleOutlined)
  })

  it('reads top to bottom: order, colors, species, price display, search switch', () => {
    draw()
    const text = host.textContent ?? ''
    const at = ['排序', '颜色', '物种', '只显示有主人账号的', '价格显示', '设定搜索增强', '重置']
      .map((s) => text.indexOf(s))
    expect(at.every((i) => i >= 0)).toBe(true)
    expect(at).toEqual([...at].sort((a, b) => a - b))
  })

  it('opens a section at the start only when it already holds a pick', () => {
    draw()
    expect(folds()).toEqual(['颜色:false', '物种:false'])
    facts.colors = new Set(['红'])
    draw()
    expect(folds()).toEqual(['颜色:true', '物种:false'])
  })

  it('flips the 主人账号 filter through the store', () => {
    draw()
    const sw = switchByLabel('只显示有主人账号的')
    expect(sw.getAttribute('aria-checked')).toBe('false')
    expect(sw.disabled).toBe(false)
    sw.click()
    expect(calls).toEqual(['socialOnly:true'])
  })

  it('names how many listings have an account', () => {
    draw()
    expect(host.textContent).toContain('查得到主人账号的只有 87 只，列表会短很多。')
  })

  // Why the switch reads off even when the stored flag is on: see `socialFilterOn`.
  it('grays the 主人账号 switch when the socials table is not there', () => {
    facts.ready = false
    draw()
    const sw = switchByLabel('只显示有主人账号的')
    expect(sw.disabled).toBe(true)
    expect(sw.getAttribute('aria-checked')).toBe('false')
    expect(host.textContent).toContain('主人账号的资料没有加载成功，这个筛选暂时用不了。')
    sw.click()
    expect(calls).toEqual([])
  })

  it('ends the list with 重置, gray while the store has nothing to give back', () => {
    draw()
    expect(reset().disabled).toBe(true)
    expect(reset().className).toContain('text-faint')
  })

  it('重置 hands the clearing to the store', () => {
    facts.canReset = true
    draw()
    expect(reset().disabled).toBe(false)
    reset().click()
    expect(calls).toEqual(['reset'])
  })

  it('folds from the whole row, count included', () => {
    draw()
    expect(foldRows().length).toBe(2)
    for (const row of foldRows()) {
      expect(row.textContent).toMatch(/\d+\/\d+/)
    }
    expect(folds()).toEqual(['颜色:false', '物种:false'])
    fold('颜色')
    expect(folds()).toEqual(['颜色:true', '物种:false'])
  })

  it('keeps a section open after its last pick goes away', () => {
    draw()
    fold('颜色')
    chip('红')
    chip('红')
    expect(folds()).toEqual(['颜色:true', '物种:false'])
  })
})
