import { describe, expect, it } from 'vitest'
import { readFlag, readMode, type StorageLike } from './displayStore'

function fakeStore(items: Record<string, string> = {}): StorageLike {
  const data = new Map(Object.entries(items))
  return {
    getItem: (k) => (data.has(k) ? data.get(k)! : null),
    setItem: (k, v) => void data.set(k, v),
    removeItem: (k) => void data.delete(k),
  }
}

describe('readMode', () => {
  it("defaults to 'once' when nothing is stored", () => {
    expect(readMode(fakeStore())).toBe('once')
  })

  it('reads the price_display key', () => {
    expect(readMode(fakeStore({ price_display: 'installment' }))).toBe('installment')
    expect(readMode(fakeStore({ price_display: 'hidden' }))).toBe('hidden')
  })

  it("falls back to 'once' for an unknown value", () => {
    expect(readMode(fakeStore({ price_display: 'buy-now' }))).toBe('once')
  })
})

describe('readFlag', () => {
  it('treats only "1" as on', () => {
    expect(readFlag(fakeStore({ flag: '1' }), 'flag')).toBe(true)
    expect(readFlag(fakeStore({ flag: '0' }), 'flag')).toBe(false)
    expect(readFlag(fakeStore({ flag: 'true' }), 'flag')).toBe(false)
    expect(readFlag(fakeStore(), 'flag')).toBe(false)
  })
})
