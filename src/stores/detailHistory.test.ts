// Those detail → detail hops use router `replace`, so browser history never contains
// them and ← has to keep its own trail. These tests cover what that trail records.
import { beforeEach, describe, expect, it } from 'vitest'
import { canGoBack, clearDetailHistory, markRelatedNav, onDetailShow, popBack } from './detailHistory'

// One hop through the related row: mark `from`, then show the new setting.
function hop(from: string, to: string) {
  markRelatedNav(from)
  onDetailShow(to)
}

beforeEach(() => { clearDetailHistory() })

describe('detailHistory', () => {
  it('starts empty, so the back button is not drawn at all', () => {
    onDetailShow('100')
    expect(canGoBack()).toBe(false)
    expect(popBack()).toBeNull()
  })

  it('keeps the hop you came through', () => {
    onDetailShow('100')
    hop('100', '200')
    expect(canGoBack()).toBe(true)
    expect(popBack()).toBe('100')
    expect(canGoBack()).toBe(false)
  })

  it('stacks, so back walks the whole trail in reverse', () => {
    onDetailShow('1')
    hop('1', '2')
    hop('2', '3')
    expect(popBack()).toBe('2')
    expect(popBack()).toBe('1')
    expect(popBack()).toBeNull()
  })

  it('starts a fresh trail when you open a detail from the grid', () => {
    onDetailShow('1')
    hop('1', '2')
    onDetailShow('900') // no pending hop: opened from the grid or a link
    expect(canGoBack()).toBe(false)
  })

  it('keeps the rest of the trail when you go back one', () => {
    onDetailShow('1')
    hop('1', '2')
    hop('2', '3')
    const to = popBack()
    onDetailShow(to!) // the back hop arrives
    expect(popBack()).toBe('1')
  })

  it('records a hop back to something already in the trail, like a browser does', () => {
    // 1 → 2 → 1: the reader walked this trail, so ← retraces it rather than jumping
    // back to the grid
    onDetailShow('1')
    hop('1', '2')
    hop('2', '1')
    expect(popBack()).toBe('2')
    expect(popBack()).toBe('1')
    expect(canGoBack()).toBe(false)
  })

  it('never records a hop that stays on the same detail', () => {
    onDetailShow('1')
    hop('1', '1')
    expect(canGoBack()).toBe(false)
  })

  it('does not grow past the cap', () => {
    onDetailShow('0')
    for (let i = 1; i <= 80; i++) hop(String(i - 1), String(i))
    let n = 0
    while (popBack() !== null) n++
    expect(n).toBe(50)
  })
})
