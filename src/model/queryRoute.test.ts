import { describe, expect, it } from 'vitest'
import { routeFor, shouldAskText, worthAsking, type RouteInput } from './queryRoute'

const base: RouteInput = {
  pictureOn: false, pictureIds: null, semanticOn: true, query: '蓝眼睛', textIds: [],
}

describe('worthAsking', () => {
  it('needs three characters before it leaves the device', () => {
    expect(worthAsking('小狼')).toBe(false)
    expect(worthAsking('小狼人')).toBe(true)
    expect(worthAsking('  小狼  ')).toBe(false)
  })

  it('leaves adoptIds to the local search, which matches them exactly', () => {
    expect(worthAsking('2871')).toBe(false)
    expect(worthAsking('287')).toBe(false)
    expect(worthAsking('12 34')).toBe(false)
    expect(worthAsking('1234，5678')).toBe(false)
    expect(worthAsking('2871/2872')).toBe(false)
    // A number with a word in it is a question again: 2 heads, 4 wings.
    expect(worthAsking('2871 龙')).toBe(true)
  })

  it('counts characters, not UTF-16 units', () => {
    expect(worthAsking('🐉🐉')).toBe(false)
    expect(worthAsking('🐉🐉🐉')).toBe(true)
  })
})

describe('routeFor', () => {
  it('gives the picture the whole list once it has answered', () => {
    expect(routeFor({ ...base, pictureOn: true, pictureIds: [7, 1] }))
      .toEqual({ by: 'picture', ids: [7, 1] })
  })

  // The service said nothing looks like this. That is an answer, so the list goes empty.
  it('follows an empty picture answer', () => {
    expect(routeFor({ ...base, pictureOn: true, pictureIds: [] }))
      .toEqual({ by: 'picture', ids: [] })
  })

  // The neighbors from the sentence stay while the reader picks a file: the local search
  // cannot match that sentence either.
  it('keeps the sentence results while the first picture is on its way', () => {
    expect(routeFor({ ...base, pictureOn: true, pictureIds: null, textIds: [7, 1] }))
      .toEqual({ by: 'text', ids: [7, 1] })
  })

  it('shows the plain list once the box holds nothing worth asking', () => {
    expect(routeFor({ ...base, pictureOn: true, pictureIds: null, query: '' }))
      .toEqual({ by: 'none' })
  })

  // With the enhanced search off, the reader was looking at the plain list, and it stays.
  it('shows the plain list when the enhanced search is off', () => {
    expect(routeFor({ ...base, pictureOn: true, pictureIds: null, semanticOn: false, textIds: [7] }))
      .toEqual({ by: 'none' })
  })

  // A picture outranks the sentence still sitting in the hidden box.
  it('keeps the sentence route off while picture mode is on', () => {
    expect(routeFor({ ...base, pictureOn: true, pictureIds: [7], textIds: [3] }))
      .toEqual({ by: 'picture', ids: [7] })
  })

  it('ranks by the model once the sentence has an answer', () => {
    expect(routeFor({ ...base, textIds: [21, 4] })).toEqual({ by: 'text', ids: [21, 4] })
  })

  it('leaves the list alone while the switch is off', () => {
    expect(routeFor({ ...base, semanticOn: false, textIds: [21] })).toEqual({ by: 'none' })
  })

  it('leaves a bare number to the local search', () => {
    expect(routeFor({ ...base, query: '2871', textIds: [21] })).toEqual({ by: 'none' })
  })
})

describe('shouldAskText', () => {
  it('asks only for a sentence the local search cannot answer exactly', () => {
    expect(shouldAskText({ pictureOn: false, semanticOn: true, query: '蓝眼睛' })).toBe(true)
    expect(shouldAskText({ pictureOn: false, semanticOn: true, query: '2871' })).toBe(false)
    expect(shouldAskText({ pictureOn: false, semanticOn: false, query: '蓝眼睛' })).toBe(false)
    // The service takes one upload at a time: the picture holds the slot.
    expect(shouldAskText({ pictureOn: true, semanticOn: true, query: '蓝眼睛' })).toBe(false)
  })
})
