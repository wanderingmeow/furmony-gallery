// The words the shelf translates live apart from the row, so a new language can change the text
// while the card keeps its object and its picture. These check the answers on both sides of a
// `rememberWords` call, the row that the table knows nothing about, and the space between a pick
// and the answer that fills it.
import { beforeEach, describe, expect, it } from 'vitest'
import { setLocale } from '../i18n/locale'
import type { AdoptListing } from './types'
import {
  listingDescription, listingName, listingPainterName, rememberWords, wordsPending,
} from './translatedText'

function row(over: Partial<AdoptListing> = {}): AdoptListing {
  return {
    adoptId: 7,
    paintersId: 3,
    productId: 1,
    adoptName: '蓝色猫',
    detailDescription: '一只猫',
    harmonyPainterVo: { painterid: 7, painterName: '画师甲' },
    ...over,
  }
}

beforeEach(() => {
  // The table and the language are module level, so each test starts from 简体中文 with the shelf
  // having answered nothing.
  setLocale('zh')
  rememberWords([], 'zh')
})

describe('a row the table has never been told about', () => {
  it('answers with the words the row carries', () => {
    const l = row()
    expect(listingName(l)).toBe('蓝色猫')
    expect(listingDescription(l)).toBe('一只猫')
    expect(listingPainterName(l)).toBe('画师甲')
  })
})

describe('after the shelf answers in another language', () => {
  it('answers with those words', () => {
    rememberWords([row({ adoptName: 'Blue cat', detailDescription: 'A cat', harmonyPainterVo: { painterid: 7, painterName: 'Painter A' } })], 'en')
    const l = row()
    expect(listingName(l)).toBe('Blue cat')
    expect(listingDescription(l)).toBe('A cat')
    expect(listingPainterName(l)).toBe('Painter A')
  })

  it('follows the row by its id, since that is all the two visits share', () => {
    rememberWords([row({ adoptId: 8, adoptName: '別の設定' })], 'ja')
    expect(listingName(row())).toBe('蓝色猫')
    expect(listingName(row({ adoptId: 8 }))).toBe('別の設定')
  })

  it('leaves a field the shelf left out to the row', () => {
    rememberWords([row({ adoptName: 'Blue cat', detailDescription: undefined })], 'en')
    const l = row()
    expect(listingName(l)).toBe('Blue cat')
    expect(listingDescription(l)).toBe('一只猫')
  })

  it('replaces the whole table, so a screen never mixes two languages', () => {
    rememberWords([row({ adoptName: 'Blue cat' })], 'en')
    rememberWords([row({ adoptName: '青い猫' })], 'ja')
    expect(listingName(row())).toBe('青い猫')
  })
})

describe('the space between a pick and the answer', () => {
  it('says nothing is waiting before the shelf has answered', () => {
    expect(wordsPending()).toBe(false)
  })

  it('says the words are on their way once the screen has moved on', () => {
    rememberWords([row()], 'zh')
    setLocale('ja')
    expect(wordsPending()).toBe(true)
  })

  it('stops saying so when the answer in the new language lands', () => {
    setLocale('ja')
    rememberWords([row({ adoptName: '青い猫' })], 'ja')
    expect(wordsPending()).toBe(false)
  })
})
