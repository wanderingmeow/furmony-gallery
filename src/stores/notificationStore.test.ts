// Tests for notifyListingChanges. No network, no rendering: a signal can be read outside a
// component, so the diff can be called directly.
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AdoptListing } from '../types'

let mod: typeof import('./notificationStore')
beforeEach(async () => {
  vi.resetModules() // fresh module → the queue and uid counter start empty
  mod = await import('./notificationStore')
})

function listing(overrides: Partial<AdoptListing> = {}): AdoptListing {
  return { adoptId: 1, paintersId: 1, productId: 0, adoptName: '墨牙', nonrecurringExpense: 30800, ...overrides }
}

// run a diff and return whatever it queued (one diff per test — the queue accumulates)
function diff(oldRows: AdoptListing[], newRows: AdoptListing[]) {
  mod.notifyListingChanges(oldRows, newRows)
  return mod.getNotifications()
}

describe('notifyListingChanges', () => {
  it('reports a lock flip and a price change as two separate notifications', () => {
    const out = diff(
      [listing({ isLock: 0, nonrecurringExpense: 30800 })],
      [listing({ isLock: 2, nonrecurringExpense: 33000 })],
    )
    expect(out).toMatchObject([{ kind: 'lock', isLocked: true }, { kind: 'price', from: 30800, to: 33000 }])
  })

  it('says nothing when the price is the same', () => {
    expect(diff([listing()], [listing()])).toHaveLength(0)
  })

  it('ignores allcost and earnest — only the price on the card counts', () => {
    const out = diff(
      [listing({ allcost: 33000, earnest: 6600 })],
      [listing({ allcost: 40000, earnest: 8000 })],
    )
    expect(out).toHaveLength(0)
  })

  it('says nothing for a row that just appeared, which has no previous price', () => {
    expect(diff([listing({ adoptId: 99 })], [listing({ adoptId: 2831, nonrecurringExpense: 99999 })])).toHaveLength(0)
  })

  it('says nothing when one side has no price at all (displayPrice reads it as 0)', () => {
    expect(diff([listing({ nonrecurringExpense: undefined })], [listing()])).toHaveLength(0)
  })
})
