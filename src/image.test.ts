// Functional tests for the signed-image URL map (image.ts). No network, no rendering.
// fake-indexeddb provides a real-ish IndexedDB; localStorage comes from jsdom.
import { beforeEach, describe, expect, it, vi } from 'vitest'

type ImageModule = typeof import('./image')

// fresh module per test → module-level imageUrlMap/dirtyPaths state is isolated
let img: ImageModule
beforeEach(async () => {
  vi.resetModules()
  img = await import('./image')
})

describe('stableImageUrl (img_url_map)', () => {
  it('maps a signed URL (with ?) and remembers the first-seen URL', () => {
    const first = img.stableImageUrl('https://a.jpg?sig=1')
    // same path with a different signature returns the remembered one
    expect(img.stableImageUrl('https://a.jpg?sig=999')).toBe('https://a.jpg?sig=1')
    expect(first).toBe('https://a.jpg?sig=1')
  })

  it('bypasses no-query URLs entirely (nothing stored, raw returned)', () => {
    expect(img.stableImageUrl('https://plain.jpg')).toBe('https://plain.jpg')
  })

  it('passes undefined through', () => {
    expect(img.stableImageUrl(undefined)).toBeUndefined()
  })

  it('persists dirty entries to IndexedDB and reloads them on a fresh module', async () => {
    img.stableImageUrl('https://a.jpg?x=1')
    await img.flushImageUrlMap()
    // seed a stale legacy localStorage copy that init should remove
    localStorage.setItem('furmony_image_url_map', '{"https://a.jpg":"https://a.jpg?legacy=1"}')

    vi.resetModules()
    img = await import('./image')
    await img.initImageUrlMap()

    // remembered URL from DB wins over the fresh signature
    expect(img.stableImageUrl('https://a.jpg?y=2')).toBe('https://a.jpg?x=1')
    expect(localStorage.getItem('furmony_image_url_map')).toBeNull()
  })
})
