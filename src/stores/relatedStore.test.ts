// The row holds a placeholder up until relatedLoaded() flips, so the flag has to be told
// about the two ways a load can end, not just the good one.
import { afterEach, expect, it, vi } from 'vitest'

afterEach(() => vi.unstubAllGlobals())

async function openSheet(body: string, ok = true) {
  vi.resetModules()
  vi.stubGlobal('fetch', () =>
    Promise.resolve(new Response(body, {
      status: ok ? 200 : 404,
      headers: { 'content-type': 'application/json' },
    })))
  return await import('./relatedStore')
}

const table = JSON.stringify({ topN: 8, neighbors: { 7: [8, 9, 10] } })

it('holds the placeholder until the table arrives', async () => {
  const { loadRelated, related, relatedLoaded } = await openSheet(table)
  expect(relatedLoaded()).toBe(false)
  await loadRelated()
  expect(relatedLoaded()).toBe(true)
  expect(related().neighbors.get(7)).toEqual([8, 9, 10])
})

// A 404 is an ending. Leaving the flag false would spin over a row that is never coming.
it('releases the placeholder when the table never arrives', async () => {
  const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
  const { loadRelated, related, relatedLoaded } = await openSheet('not json', false)
  expect(relatedLoaded()).toBe(false)
  await loadRelated()
  expect(relatedLoaded()).toBe(true)
  expect(related().neighbors.size).toBe(0)
  spy.mockRestore()
})
