// Functional tests for the price-display rules (domain.ts). All numbers are FAKE.
import { describe, expect, it } from 'vitest'
import type { AdoptListing } from './types'
import { installmentTotal, monthlyPayment, priceParts, type PriceMode } from './domain'

// The fake setting: 30000 across 12 periods (allcost), a 6000 deposit (earnest), and
// 24000 to settle once (nonrecurringExpense), which is 8折 of the total.
function fake(over: Partial<AdoptListing> = {}): AdoptListing {
  return {
    adoptId: 1, paintersId: 2, productId: 3,
    nonrecurringExpense: 24000, allcost: 30000, earnest: 6000, ...over,
  }
}

const modes: PriceMode[] = ['once', 'installment', 'hidden']

/** The two modes are two types, so each test claims the one it wants. A wrong claim is
 *  a bug, so throw instead of papering over it with `!`. */
function onceParts(l: AdoptListing) {
  const p = priceParts(l, 'once')
  if (p?.mode !== 'once') throw new Error(`想要一口价，拿到 ${JSON.stringify(p)}`)
  return p
}
function planParts(l: AdoptListing) {
  const p = priceParts(l, 'installment')
  if (p?.mode !== 'installment') throw new Error(`想要分期，拿到 ${JSON.stringify(p)}`)
  return p
}

describe('installmentTotal', () => {
  it('is the 12-period total, i.e. allcost', () => {
    expect(installmentTotal(fake())).toBe(30000)
  })

  it('falls back to the 一口价 when allcost was never filled in', () => {
    expect(installmentTotal(fake({ allcost: undefined }))).toBe(24000)
    expect(installmentTotal(fake({ allcost: 0 }))).toBe(24000)
  })
})

describe('monthlyPayment', () => {
  it('splits what is LEFT after the deposit', () => {
    // (30000 − 6000) / 12
    expect(monthlyPayment(fake())).toBe(2000)
  })

  it('matches the real case it was built for', () => {
    // 28500 to settle once, 30600 across 12 periods, a 6120 deposit: a 6120 down
    // payment and 2040 a month.
    const l = fake({ nonrecurringExpense: 28500, allcost: 30600, earnest: 6120 })
    const p = planParts(l)
    expect(p.down).toBe(6120)
    expect(p.main).toBe(2040)
    expect(p.total).toBe(30600)
  })

  it('rounds UP, so a card never promises less than the real instalment', () => {
    expect(monthlyPayment(fake({ allcost: 1000, earnest: 0 }))).toBe(84)
  })

  it('works without a deposit', () => {
    expect(monthlyPayment(fake({ earnest: 0 }))).toBe(2500)
  })

  it('has no opinion when the deposit already covers everything', () => {
    expect(monthlyPayment(fake({ earnest: 30000 }))).toBeNull()
    expect(monthlyPayment(fake({ nonrecurringExpense: 0, allcost: 0, earnest: 0 }))).toBeNull()
  })
})

describe('priceParts — once', () => {
  it('keeps the historical display: price + strikethrough + discount', () => {
    const p = onceParts(fake())
    expect(p.mode).toBe('once')
    expect(p.main).toBe(24000)
    expect(p.secondary).toBe(30000)
    expect(p.discount).toBeCloseTo(8)
    expect(p.card).toEqual({ label: null, value: 24000 })
  })

  it('drops the second number when there is nothing to discount', () => {
    // The pay-once price equals the 12-period total, so a second number would repeat
    // the first one.
    const same = onceParts(fake({ nonrecurringExpense: 30000 }))
    expect(same.discount).toBe(0)
    expect(same.secondary).toBeNull()

    // The pay-once price sits above the 12-period total (#578: 21000 / 19680). The old
    // condition drew a number below the price with no strike-through and no badge.
    const worse = onceParts(fake({ nonrecurringExpense: 21000, allcost: 19680 }))
    expect(worse.main).toBe(21000)
    expect(worse.secondary).toBeNull()
    expect(worse.discount).toBe(0)
  })

  it('draws ¥0 rather than nothing, exactly as before', () => {
    expect(onceParts(fake({ nonrecurringExpense: undefined })).main).toBe(0)
  })
})

describe('priceParts — installment', () => {
  it('leads with the deposit, then the monthly detail', () => {
    const p = planParts(fake())
    expect(p.mode).toBe('installment')
    expect(p.down).toBe(6000)          // the first row, the one it highlights
    expect(p.main).toBe(2000)          // the second row: monthly
    expect(p.mainLabel).toBe('月供')
    expect(p.note).toBe('×12期')
    expect(p.total).toBe(30000)        // the second row: total
    expect(p.card).toEqual({ label: '首付', value: 6000 })
  })

  it('puts the deposit on the card and nothing else', () => {
    expect(planParts(fake()).card).toEqual({ label: '首付', value: 6000 })
  })

  it('falls back to the monthly amount on the card when there is no deposit', () => {
    const p = planParts(fake({ earnest: 0 }))
    // null means "this setting has no deposit", which is not 0. The detail sheet picks
    // its rows on this. Falling back to 0 told the user nobody had to pay a deposit:
    // #848 and the five others drew 首付¥0 and 定金¥0 in the same sheet.
    expect(p.down).toBeNull()
    expect(p.card).toEqual({ label: '月供', value: 2500 })
  })

  it('draws nothing for a free listing', () => {
    const p = planParts(fake({ nonrecurringExpense: 0, allcost: 0, earnest: 0 }))
    expect(p.main).toBeNull()
    expect(p.down).toBeNull()
    expect(p.total).toBeNull()
    expect(p.card).toBeNull()
    // Nothing to report, so no words either: "月供" and "×12期" behind a null would
    // stand there on their own.
    expect(p.mainLabel).toBeNull()
    expect(p.note).toBeNull()
  })

  it('still reports the total when allcost was never filled in', () => {
    // With no allcost, the total falls back to the pay-once price, and the monthly
    // amount spreads over that number.
    const p = planParts(fake({ allcost: undefined }))
    expect(p.total).toBe(24000)
    expect(p.main).toBe(1500)
  })
})

describe('priceParts — hidden', () => {
  it('returns nothing at all', () => {
    // null, not an object with every field empty: <Show when={parts()}> then draws
    // nothing at all.
    expect(priceParts(fake(), 'hidden')).toBeNull()
  })
})

describe('priceParts — every mode', () => {
  it('never leaks a negative or NaN amount', () => {
    for (const mode of modes) {
      for (const over of [
        {}, { nonrecurringExpense: 0 }, { allcost: -5 }, { earnest: 999999 },
        { nonrecurringExpense: 7, allcost: undefined, earnest: undefined },
      ]) {
        const p = priceParts(fake(over), mode)
        if (!p) continue
        const nums = [
          p.main, p.card?.value ?? null,
          ...(p.mode === 'installment' ? [p.down, p.total] : [p.secondary]),
        ]
        for (const n of nums) {
          if (n !== null) expect(Number.isFinite(n) && n >= 0).toBe(true)
        }
      }
    }
  })
})
