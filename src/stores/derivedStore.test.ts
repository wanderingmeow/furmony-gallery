// A photograph's answer belongs to no tab, so the tab does not filter those rows. These tests read
// the filter the grid builds before, during and after a picture answers.
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { settled } from '../testSetup'
import {
  priceMode, semanticSearch, setPriceMode, setSemanticSearch,
} from './displayStore'
import {
  setSocialOnly, setSelectedColors, setSelectedRaces, setSortMode, setTab, sortMode,
} from './filterStore'
import { setListings } from './listingsStore'
import { loadSocials } from './socialsStore'
import type { AdoptListing } from '../model/types'

vi.mock('../data/searchApi', async (importOriginal) => {
  const real = await importOriginal<typeof import('../data/searchApi')>()
  return {
    ...real,
    searchConfigured: true,
    askPicture: () => Promise.resolve({ ids: [201, 7], box: null }),
  }
})

// The re-encode is the browser's work. The store only needs a blob back.
vi.mock('../data/pictureInput', () => ({
  prepare: async (file: Blob) => ({ blob: file }),
}))

const { picture, pictureAnswers } = await import('./semanticStore')
const {
  emptyState, filtersOnCount, listFilterBase, panelHasChanges, resetPanel, socialCount, socialsReady,
} = await import('./derivedStore')

const listing = (id: number): AdoptListing => ({ adoptId: id, paintersId: 1, productId: 1 })

beforeEach(() => {
  picture.close()
  setTab('all')
  setSemanticSearch(true)
})

describe('the tabs a picture answers across', () => {
  it('leaves the tab in charge while the drop zone is still empty', () => {
    setTab('locked')
    picture.open()
    expect(pictureAnswers()).toBe(false)
    expect(listFilterBase().tab).toBe('locked')
  })

  it('opens the tab out once the picture has answered', async () => {
    setTab('locked')
    picture.open()
    await picture.stage(new Blob(['jpeg-ish']))
    await settled()
    expect(pictureAnswers()).toBe(true)
    expect(listFilterBase().tab).toBe('all')
  })

  it('hands the tab back when the picture leaves', async () => {
    setTab('wishlist')
    picture.open()
    await picture.stage(new Blob(['jpeg-ish']))
    await settled()
    picture.close()
    await settled()
    expect(pictureAnswers()).toBe(false)
    expect(listFilterBase().tab).toBe('wishlist')
  })
})

describe('emptyState', () => {
  it('names the wishlist while the tab row is on screen', () => {
    setTab('wishlist')
    expect(emptyState()?.title).toBe('还没有收藏')
  })

  it('speaks for the picture once it answers', async () => {
    setTab('wishlist')
    picture.open()
    await picture.stage(new Blob(['jpeg-ish']))
    await settled()
    expect(emptyState()?.title).toBe('没有可显示的设定')
  })
})

// The owner-account table is fetched at runtime, so this file starts with none of it. That is
// exactly the state where the switch has to refuse to run.
describe('the 主人账号 filter', () => {
  it('does not run while socials.json has brought nothing in', () => {
    setSocialOnly(true)
    expect(socialsReady()).toBe(false)
    expect(listFilterBase().socialOnly).toBe(false)
    // The list is empty for another reason, so the box must not name the switch.
    expect(emptyState()?.action).not.toBe('socialOnly')
  })

  it('runs once the table arrives, and stops when the switch goes off', async () => {
    // One owner with one account we can link to, served the way socials.json is.
    vi.stubGlobal('fetch', () => new Response(
      JSON.stringify({ 164: { ownerName: 'TestOwner', platforms: { x: 'testhandle' } } }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    ))
    await loadSocials()
    expect(socialsReady()).toBe(true)
    expect(listFilterBase().socialOnly).toBe(true)
    expect(emptyState()?.title).toBe('没有查到主人账号的设定')
    expect(emptyState()?.action).toBe('socialOnly')

    setSocialOnly(false)
    expect(listFilterBase().socialOnly).toBe(false)
  })

  // The panel names this number before the switch cuts the list down to it, so it counts only
  // the listings the reader can actually reach.
  it('counts the listings on the shelf that have an account', () => {
    setListings([listing(164), listing(999)])
    expect(socialCount()).toBe(1)
  })

  it('counts the filters the corner number shows', () => {
    setSelectedColors(new Set(['红', '蓝']))
    setSelectedRaces(new Set(['狼']))
    setSocialOnly(true)
    expect(filtersOnCount()).toBe(4)
  })

  // 重置 gives back every row the panel offers, not only the ones the corner number counts. A
  // changed order or price display hides no listing, so the number stays empty without them.
  it('重置 returns every setting the panel holds', () => {
    setSortMode('priceAsc')
    setPriceMode('hidden')
    setSemanticSearch(true)
    expect(panelHasChanges()).toBe(true)

    resetPanel()
    expect(filtersOnCount()).toBe(0)
    expect(sortMode()).toBe('timeDesc')
    expect(priceMode()).toBe('once')
    expect(semanticSearch()).toBe(false)
    // With nothing changed, the row goes gray again.
    expect(panelHasChanges()).toBe(false)
  })
})
