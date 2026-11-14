import { describe, expect, it } from 'vitest'
import { createScrollLock, type ScrollTarget } from './scrollLock'

function fakeDoc(): ScrollTarget {
  const docEl = { style: { overflow: '' } }
  const body = { style: { overflow: '' } }
  return { documentElement: docEl, body }
}

describe('createScrollLock', () => {
  it('first acquire pins both elements and bumps count', () => {
    const doc = fakeDoc()
    const lock = createScrollLock(doc)
    lock.acquire()
    expect(lock.count).toBe(1)
    expect(doc.documentElement.style.overflow).toBe('hidden')
    expect(doc.body.style.overflow).toBe('hidden')
  })

  it('nested acquire only bumps count, does not re-pin', () => {
    const doc = fakeDoc()
    const lock = createScrollLock(doc)
    lock.acquire()
    lock.acquire()
    expect(lock.count).toBe(2)
    expect(doc.documentElement.style.overflow).toBe('hidden')
  })

  it('stays pinned while nested, releases only on last release', () => {
    const doc = fakeDoc()
    const lock = createScrollLock(doc)
    const r1 = lock.acquire()
    const r2 = lock.acquire()
    r1()
    expect(lock.count).toBe(1)
    expect(doc.documentElement.style.overflow).toBe('hidden')
    r2()
    expect(lock.count).toBe(0)
    expect(doc.documentElement.style.overflow).toBe('')
    expect(doc.body.style.overflow).toBe('')
  })

  it('release is idempotent and never goes negative', () => {
    const doc = fakeDoc()
    const lock = createScrollLock(doc)
    const r = lock.acquire()
    r()
    expect(lock.count).toBe(0)
    r() // second release is a no-op
    expect(lock.count).toBe(0)
    expect(doc.documentElement.style.overflow).toBe('')
  })

  it('attaches a touchmove blocker on acquire and removes it on release', () => {
    const listeners: Record<string, ((e: any) => void)[]> = {}
    const doc: ScrollTarget = {
      documentElement: { style: { overflow: '' } },
      body: { style: { overflow: '' } },
      addEventListener: (type, h) => { (listeners[type] ??= []).push(h) },
      removeEventListener: (type, h) => { const a = listeners[type] ?? []; a.splice(a.indexOf(h), 1) },
    }
    const lock = createScrollLock(doc)
    const r = lock.acquire()
    expect(listeners.touchstart?.length).toBe(1)
    expect(listeners.touchmove?.length).toBe(1)
    expect(listeners.touchend?.length).toBe(1)
    expect(listeners.touchcancel?.length).toBe(1)
    r()
    expect(listeners.touchmove?.length).toBe(0)
  })

  it('restores the prior overflow values on release', () => {
    const docEl = { style: { overflow: 'auto' } }
    const body = { style: { overflow: 'auto' } }
    const doc: ScrollTarget = { documentElement: docEl, body }
    const lock = createScrollLock(doc)
    const r = lock.acquire()
    expect(docEl.style.overflow).toBe('hidden')
    expect(body.style.overflow).toBe('hidden')
    r()
    expect(docEl.style.overflow).toBe('auto')
    expect(body.style.overflow).toBe('auto')
  })

  it('touchmove blocker prevents document scroll outside the sheet scroller, allows inside', () => {
    let start: ((e: any) => void) | null = null
    let move: ((e: any) => void) | null = null
    const inner = { tag: 'inner' }
    const outer = { tag: 'outer' }
    const scrollable = {
      contains: (n: any) => n === inner,
      scrollTop: 0,
      clientHeight: 500,
      scrollHeight: 1000,
    }
    const doc: ScrollTarget = {
      documentElement: { style: { overflow: '' } },
      body: { style: { overflow: '' } },
      addEventListener: (type, h) => {
        if (type === 'touchstart') start = h
        if (type === 'touchmove') move = h
      },
      removeEventListener: () => {},
    }
    const lock = createScrollLock(doc)
    lock.acquire({ getScrollable: () => scrollable as any })
    expect(move).not.toBeNull()
    const prevented: number[] = []
    const ev = (target: any, x: number, y: number) => ({
      target,
      cancelable: true,
      touches: [{ clientX: x, clientY: y }],
      preventDefault: () => { prevented.push(1) },
    })
    // outside the scroller → blocked
    start!(ev(outer, 10, 10))
    move!(ev(outer, 10, 40))
    expect(prevented.length).toBe(1)
    // inside the scroller, at its top edge, finger UP (dy<0) → allowed (scroll content down)
    start!(ev(inner, 10, 100))
    move!(ev(inner, 10, 80))
    expect(prevented.length).toBe(1)
    // inside the scroller, at its top edge, finger DOWN (dy>0) → blocked (overscroll up)
    start!(ev(inner, 10, 50))
    move!(ev(inner, 10, 70))
    expect(prevented.length).toBe(2)
    // inside the scroller, at its bottom edge, finger DOWN (dy>0) → allowed (scroll content up)
    scrollable.scrollTop = 500
    start!(ev(inner, 10, 50))
    move!(ev(inner, 10, 70))
    expect(prevented.length).toBe(2)
    // inside the scroller, at its bottom edge, finger UP (dy<0) → blocked (overscroll down)
    start!(ev(inner, 10, 100))
    move!(ev(inner, 10, 80))
    expect(prevented.length).toBe(3)
  })
})
