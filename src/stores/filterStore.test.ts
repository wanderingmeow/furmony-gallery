import { beforeEach, describe, expect, it } from 'vitest'
import { loadFilters, searchText, setSearchText, setSocialOnly, socialOnly } from './filterStore'

const KEY = 'furmony_filter'

describe('the stored query', () => {
  beforeEach(() => {
    localStorage.removeItem(KEY)
    setSearchText('')
  })

  it('restores the query the reader left behind', () => {
    localStorage.setItem(KEY, JSON.stringify({ search: '蓝色的猫' }))
    loadFilters()
    expect(searchText()).toBe('蓝色的猫')
  })

  // A query stored before the input gate existed: the box can hold syllables nobody committed.
  it('drops a stored query that still holds uncommitted syllables', () => {
    setSearchText('苍雪蓝眼睛')
    localStorage.setItem(KEY, JSON.stringify({ search: 'cang\u2006xue\u2006lan' }))
    loadFilters()
    expect(searchText()).toBe('苍雪蓝眼睛')
  })
})

describe('the stored 主人账号 switch', () => {
  beforeEach(() => {
    localStorage.removeItem(KEY)
    setSocialOnly(false)
  })

  it('restores the switch the reader left behind', () => {
    localStorage.setItem(KEY, JSON.stringify({ socialOnly: true }))
    loadFilters()
    expect(socialOnly()).toBe(true)
  })
})
