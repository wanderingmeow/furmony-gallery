// These check the two 排序 buttons, the order they walk through, and what happens when the list
// is a search answer.
import { afterEach, describe, expect, it, vi } from 'vitest'
import { render } from 'solid-js/web'
import { ArrowUpOutlined, ClockCircleOutlined, DollarOutlined } from '@ant-design/icons-svg'
import { FilterPanel, priceIcon, timeIcon } from './FilterPanel'

const facts = vi.hoisted(() => ({
  colors: new Set<string>(),
  races: new Set<string>(),
  sort: 'timeDesc' as 'timeDesc' | 'timeAsc' | 'priceAsc' | 'priceDesc',
  semantic: false,
}))

const calls = vi.hoisted(() => [] as string[])

vi.mock('../../store', () => ({
  availableColors: () => ['红', '蓝'],
  availableRaces: () => ['狼', '龙'],
  selectedColors: () => facts.colors,
  // The mocks write what the real store writes, so a press changes what the panel reads next.
  setSelectedColors: (v: Set<string>) => { facts.colors = new Set(v); calls.push(`colors:${[...v].join(',')}`) },
  selectedRaces: () => facts.races,
  setSelectedRaces: (v: Set<string>) => { facts.races = new Set(v); calls.push(`races:${[...v].join(',')}`) },
  priceMode: () => 'once',
  setPriceMode: (v: string) => calls.push(`price:${v}`),
  searchConfigured: true,
  semanticActive: () => facts.semantic,
  semanticOn: () => false,
  setSemanticSearch: (v: boolean) => calls.push(`semantic:${v}`),
  sortMode: () => facts.sort,
  setSortMode: (v: string) => { facts.sort = v as typeof facts.sort; calls.push(`sort:${v}`) },
}))

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

/** The fold rows carry the state of their own section. */
const folds = () =>
  Array.from(host.querySelectorAll<HTMLButtonElement>('button[aria-expanded]'))
    .map((b) => `${b.textContent?.trim()}:${b.getAttribute('aria-expanded')}`)

const chip = (text: string) => {
  const button = Array.from(host.querySelectorAll<HTMLButtonElement>('button'))
    .find((b) => b.textContent?.trim() === text)
  if (!button) throw new Error(`no chip labeled ${text}`)
  button.click()
}

const fold = (title: string) => {
  const button = Array.from(host.querySelectorAll<HTMLButtonElement>('button[aria-expanded]'))
    .find((b) => b.textContent?.trim() === title)
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
    const at = ['排序', '颜色', '物种', '价格显示', '设定搜索增强'].map((s) => text.indexOf(s))
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

  it('keeps a section open after its last pick goes away', () => {
    draw()
    fold('颜色')
    chip('红')
    chip('红')
    expect(folds()).toEqual(['颜色:true', '物种:false'])
  })
})
