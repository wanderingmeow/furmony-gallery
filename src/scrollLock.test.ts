import { describe, expect, it } from 'vitest'
import { createScrollLock, type ScrollTarget } from './scrollLock'

function fakeDoc(): ScrollTarget {
  const docEl = { style: { overflow: '' } }
  const body = { style: { overflow: '' } }
  return { documentElement: docEl, body }
}

describe('createScrollLock', () => {
  it('first open pins both elements and bumps count', () => {
    const lock = createScrollLock()
    const doc = fakeDoc()
    lock.lock(doc)
    expect(lock.count).toBe(1)
    expect(doc.documentElement.style.overflow).toBe('hidden')
    expect(doc.body.style.overflow).toBe('hidden')
  })

  it('nested open only bumps count, does not re-pin', () => {
    const lock = createScrollLock()
    const doc = fakeDoc()
    lock.lock(doc)
    lock.lock(doc)
    expect(lock.count).toBe(2)
    expect(doc.documentElement.style.overflow).toBe('hidden')
  })

  it('stays pinned while nested, releases only on last close', () => {
    const lock = createScrollLock()
    const doc = fakeDoc()
    lock.lock(doc)
    lock.lock(doc)
    lock.unlock(doc)
    expect(lock.count).toBe(1)
    expect(doc.documentElement.style.overflow).toBe('hidden')
    lock.unlock(doc)
    expect(lock.count).toBe(0)
    expect(doc.documentElement.style.overflow).toBe('')
    expect(doc.body.style.overflow).toBe('')
  })

  it('unlock never goes negative and leaves overflow untouched', () => {
    const lock = createScrollLock()
    const doc = fakeDoc()
    lock.unlock(doc)
    expect(lock.count).toBe(0)
    expect(doc.documentElement.style.overflow).toBe('')
  })

  it('count logic works even without a DOM target', () => {
    const lock = createScrollLock()
    lock.lock()
    expect(lock.count).toBe(1)
    lock.lock()
    expect(lock.count).toBe(2)
    lock.unlock()
    expect(lock.count).toBe(1)
    lock.unlock()
    expect(lock.count).toBe(0)
  })
})
