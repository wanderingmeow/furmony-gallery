// src/scrollLock.ts — ref-counted document scroll lock.
//
// Purpose: while a sheet is open the page must not scroll behind it. We pin the
// document (overflow hidden on html + body) and ref-count the lock so stacked
// sheets stay correct — the first open applies it, the last close removes it.
//
// The counter is pure and the DOM target is injected (a seam), so the logic is
// unit-testable without a real document. The app uses the exported `scrollLock`
// singleton with the real `document`; tests create their own instances.

export interface ScrollTarget {
  documentElement: { style: { overflow: string } }
  body: { style: { overflow: string } }
}

export interface ScrollLock {
  lock(target?: ScrollTarget): void
  unlock(target?: ScrollTarget): void
  readonly count: number
}

export function createScrollLock(): ScrollLock {
  let count = 0
  return {
    lock(target?: ScrollTarget): void {
      count++
      // only the FIRST open pins the document; nested opens just bump the count
      if (count === 1 && target) {
        target.documentElement.style.overflow = 'hidden'
        target.body.style.overflow = 'hidden'
      }
    },
    unlock(target?: ScrollTarget): void {
      count = Math.max(0, count - 1)
      // only the LAST close releases the pin; nested closes keep it pinned
      if (count === 0 && target) {
        target.documentElement.style.overflow = ''
        target.body.style.overflow = ''
      }
    },
    get count(): number {
      return count
    },
  }
}

export const scrollLock: ScrollLock = createScrollLock()
