// The shipped socials.json is hand-typed from links people send, so these tests read the
// real file. A wrong adoptId or a pasted URL instead of a handle is invisible until someone
// opens that detail sheet and the chip is missing.
import { describe, expect, it } from 'vitest'
import { parseSocials, toSearchMap } from './socials'
import raw from '../../public/socials.json'

const entries = parseSocials(raw)

describe('the shipped socials.json', () => {
  it('parses every entry — nothing is silently dropped', () => {
    expect(entries.size).toBe(Object.keys(raw).length)
  })

  it('gives every entry at least one renderable account', () => {
    for (const [id, entry] of toSearchMap(entries)) {
      expect(entry.hasSocial, `#${id} has no usable platform`).toBe(true)
    }
  })

  // The usual mistake when typing an entry from a link: the whole URL ends up in the field.
  // buildUrl() would then produce https://x.com/https://x.com/handle.
  it('stores handles, not URLs', () => {
    for (const [id, entry] of entries) {
      for (const key of ['x', 'tiktok', 'bilibili'] as const) {
        const value = entry.platforms[key]
        if (typeof value === 'string') {
          expect(value, `#${id} ${key}`).not.toMatch(/^(https?:)?\/\/|@|\/|\s/)
        }
      }
    }
  })
})

// The listings sample is gitignored, so this half runs only where the copies exist.
const fixtures = import.meta.glob('../../agent/*_sample.json')
const haveFixtures = Object.keys(fixtures).length >= 2

describe.skipIf(!haveFixtures)('socials.json points at listings the app can show', () => {
  it('every adoptId is in the listings sample', async () => {
    const ids = new Set<number>()
    for (const load of Object.values(fixtures)) {
      const mod = (await load()) as { default?: { rows?: { adoptId: number }[] } }
      for (const row of mod.default?.rows ?? []) ids.add(row.adoptId)
    }
    for (const id of Object.keys(raw)) {
      expect(ids.has(Number(id)), `#${id} is not in the listings`).toBe(true)
    }
  })
})
