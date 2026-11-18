// The empty list has to name the reason it is empty and offer the one thing that fixes it, so
// these tests set the facts, read the words, and press the button.
import { afterEach, describe, expect, it, vi } from 'vitest'
import { render } from 'solid-js/web'
import { EmptyState } from './EmptyState'

const facts = vi.hoisted(() => ({
  loadFailed: false,
  asking: false,
  noSocial: false,
  remaining: 0,
  total: 0,
  tab: 'all',
  saved: 0,
  query: '',
  matchesAlone: false,
  colors: new Set<string>(),
  races: new Set<string>(),
  pictureOn: false,
  pictureMeaning: 'nothing',
  sentenceFailed: false,
}))

const calls = vi.hoisted(() => [] as string[])
const navigate = vi.hoisted(() => vi.fn())

vi.mock('@solidjs/router', () => ({ useNavigate: () => navigate }))

vi.mock('../../store', () => ({
  fetchFailed: () => facts.loadFailed,
  semanticPending: () => facts.asking,
  noSocialOnly: () => facts.noSocial,
  remainingLocked: () => facts.remaining,
  countLocked: () => facts.total,
  tab: () => facts.tab,
  wishlistCount: () => facts.saved,
  searchText: () => facts.query,
  matchesWithoutPicks: () => facts.matchesAlone,
  askFailure: () => facts.sentenceFailed,
  retryAsk: () => { calls.push('retryAsk') },
  selectedColors: () => facts.colors,
  selectedRaces: () => facts.races,
  picture: { on: () => facts.pictureOn },
  pictureMeaning: () => facts.pictureMeaning as 'working' | 'failed' | 'noMatch' | 'nothing',
  setSearchText: (v: string) => calls.push(`search:${v}`),
  setSelectedColors: (v: Set<string>) => calls.push(`colors:${v.size}`),
  setSelectedRaces: (v: Set<string>) => calls.push(`races:${v.size}`),
  setNoSocialOnly: (v: boolean) => calls.push(`noSocial:${v}`),
  loadData: () => { calls.push('load') },
}))

let dispose: (() => void) | undefined
let host: HTMLDivElement

function say(over: Partial<typeof facts> = {}): void {
  Object.assign(facts, {
    loadFailed: false, asking: false, noSocial: false, remaining: 0, total: 0, tab: 'all', saved: 0,
    query: '', matchesAlone: false, colors: new Set<string>(), races: new Set<string>(), pictureOn: false,
    pictureMeaning: 'nothing', sentenceFailed: false,
  }, over)
  calls.length = 0
  host = document.createElement('div')
  document.body.appendChild(host)
  dispose = render(() => <EmptyState />, host)
}

function words(): string {
  return host.textContent ?? ''
}

function press(): void {
  host.querySelector('button')!.dispatchEvent(new MouseEvent('click', { bubbles: true }))
}

afterEach(() => {
  dispose?.()
  host?.remove()
})

describe('EmptyState', () => {
  it('waits for the enhanced search before saying anything', () => {
    say({ asking: true, query: '机械狼' })
    expect(words()).toBe('')
    expect(host.querySelector('svg')).toBe(null)
  })

  it('names a failed enhanced search and retries the same sentence', () => {
    say({ query: '机械狼', sentenceFailed: true })
    expect(words()).toContain('增强搜索失败')
    press()
    expect(calls).toEqual(['retryAsk'])
  })

  it('stays empty while the picture search is still running', () => {
    say({ pictureOn: true, pictureMeaning: 'working', query: '机械狼' })
    expect(words()).toBe('')
  })

  it('names a picture search that found nothing similar', () => {
    say({ pictureOn: true, pictureMeaning: 'noMatch' })
    expect(words()).toContain('没有很像的')
  })

  it('names a failed load and retries', () => {
    say({ loadFailed: true })
    expect(words()).toContain('没能载入设定')
    press()
    expect(calls).toEqual(['load'])
  })

  it('counts what the debug filter left, and clears both halves', () => {
    say({ noSocial: true, remaining: 0, total: 521 })
    expect(words()).toContain('剩余 0 / 共 521')
    press()
    expect(calls).toEqual(['noSocial:false'])
    expect(navigate).toHaveBeenCalledWith('/', { scroll: false, replace: true })
  })

  it('says an empty wishlist with words alone', () => {
    say({ tab: 'wishlist' })
    expect(words()).toBe('还没有收藏')
    expect(host.querySelector('button')).toBe(null)
  })

  it('clears a search that found nothing', () => {
    say({ query: '机械狼' })
    expect(words()).toContain('没有「机械狼」相关设定')
    press()
    expect(calls).toEqual(['search:'])
  })

  it('clears the picks and keeps the words when the picks are the reason', () => {
    say({ query: '狼', colors: new Set(['黑']), matchesAlone: true })
    expect(words()).toContain('当前筛选下没有设定')
    press()
    expect(calls).toEqual(['colors:0', 'races:0'])
  })

  it('clears the search when even the picks off leaves nothing', () => {
    say({ query: '机械狼', colors: new Set(['黑']), matchesAlone: false })
    expect(words()).toContain('没有「机械狼」相关设定')
    press()
    expect(calls).toEqual(['search:'])
  })

  it('clears both filter kinds at once', () => {
    say({ colors: new Set(['黑', '白']), races: new Set(['狼']) })
    expect(words()).toContain('当前筛选下没有设定')
    press()
    expect(calls).toEqual(['colors:0', 'races:0'])
  })

  it('shows no button when there is nothing to press', () => {
    say()
    expect(words()).toContain('没有可显示的设定')
    expect(host.querySelector('button')).toBe(null)
  })

  it('draws a picture for the reason', () => {
    say({ tab: 'wishlist' })
    expect(host.querySelector('svg')).not.toBe(null)
  })
})
